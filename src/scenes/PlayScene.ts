import Phaser from 'phaser';
import { ROOM_W, ROOM_H, PLAYER_BASE } from '@game/config';
import type { Inventory, Item } from '@game/types';
import { cloneItem } from '@game/items';
import { craft } from '@game/recipes';
import { Monster } from '@game/monster';
import { createHUD, drawHUD, type HudElements } from '@ui/hud';

interface GroundItem extends Phaser.GameObjects.Arc {
  itemId: Item['id'];
  label: Phaser.GameObjects.Text;
}

export class PlayScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  monster!: Monster;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keyPick!: Phaser.Input.Keyboard.Key; keyDrop!: Phaser.Input.Keyboard.Key; keyCraft!: Phaser.Input.Keyboard.Key;

  hp = PLAYER_BASE.hp; inv: Inventory = [null, null];
  itemsGroup!: Phaser.Physics.Arcade.StaticGroup;
  hud!: HudElements;
  private fxDepth = 200;
  private aimAngle = -Math.PI / 2;

  constructor() { super('Play'); }

  preload() {
    // Generate simple placeholder textures so the scene always has visible sprites
    if (!this.textures.exists('player-circle')) {
      const gfx = this.make.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(0x88c0ff, 1);
      gfx.fillCircle(16, 16, 16);
      gfx.generateTexture('player-circle', 32, 32);
      gfx.clear();
      gfx.fillStyle(0xff8844, 1);
      gfx.fillCircle(20, 20, 20);
      gfx.generateTexture('monster-circle', 40, 40);
      gfx.destroy();
    }
  }

  create() {
    // room bg
    this.add.rectangle(ROOM_W/2, ROOM_H/2, ROOM_W, ROOM_H, 0x161a22).setStrokeStyle(2, 0x2a3242);

    // furniture (blocking)
    const blocks = this.physics.add.staticGroup();
    const addBlock = (x:number,y:number,w:number,h:number)=>{
      const r = this.add.rectangle(x,y,w,h,0x222831).setStrokeStyle(1,0x3a4152);
      this.physics.add.existing(r, true);
      blocks.add(r as any);
    };
    addBlock(600, 200, 280, 40); // bed top
    addBlock(600, 240, 280, 40); // bed bottom
    addBlock(240, 520, 180, 60); // desk
    addBlock(980, 520, 120, 60); // dresser
    addBlock(560, 700, 320, 40); // rug edge (as blocker for proto)

    // player
    this.player = this.physics.add.sprite(200, 200, 'player-circle');
    this.player.setDisplaySize(32, 32);
    this.player.setCircle(14, 2, 2);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, blocks);

    // monster
    this.monster = new Monster(this, 900, 700);
    this.monster.setDepth(10);
    this.physics.add.collider(this.monster, blocks);
    this.physics.add.overlap(this.monster, this.player, () => {
      // contact damage once per second (simple throttle)
      if (!(this.player as any)._lastHit || this.time.now - (this.player as any)._lastHit > 1000) {
        (this.player as any)._lastHit = this.time.now; this.damagePlayer(1);
      }
    });

    // input
    this.cursors = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Phaser.Types.Input.Keyboard.CursorKeys;
    this.keyPick = this.input.keyboard!.addKey('E');
    this.keyDrop = this.input.keyboard!.addKey('G');
    this.keyCraft = this.input.keyboard!.addKey('R');

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateAimFromPointer(pointer));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.updateAimFromPointer(pointer);
      if (pointer.leftButtonDown()) this.use(0);
      if (pointer.rightButtonDown()) this.use(1);
    });
    this.updateAimFromPointer();

    // items on ground
    this.itemsGroup = this.physics.add.staticGroup();
    const spawn = (x:number,y:number,id: Item['id']) => {
      const circle = this.add.circle(x,y,8,0x7cc7a1) as GroundItem;
      circle.label = this.add.text(x, y - 18, id, { fontSize: '10px' }).setOrigin(0.5,1);
      circle.itemId = id;
      this.physics.add.existing(circle, true);
      this.configureItemBody(circle);
      this.itemsGroup.add(circle);
    };
    // starter items
    spawn(260, 560, 'knife');
    spawn(980, 560, 'bottle');
    spawn(640, 260, 'soda');
    spawn(720, 260, 'match');
    spawn(380, 720, 'bandaid');
    spawn(680, 720, 'yoyo');

    this.physics.add.overlap(this.player, this.itemsGroup, (_, obj:any) => {
      (this as any)._overItem = obj as GroundItem;
    });

    // player hit listener
    this.player.on('hit', (e: any) => this.damagePlayer(e.dmg||1));

    // HUD
    this.hud = createHUD(this, 5);
  }

  tryPickup() {
    const obj: GroundItem | null = (this as any)._overItem || null; if (!obj) return;
    const id = obj.itemId as Item['id'];
    // find slot
    const idx = this.inv[0]? (this.inv[1]? -1 : 1) : 0;
    if (idx === -1) {
      // swap with slot 0 by default
      const dropped = this.inv[0]!; this.inv[0] = { ...cloneItem(id) };
      obj.itemId = dropped.id; // leave the dropped one on ground
      obj.label.setText(dropped.id);
    } else {
      this.inv[idx] = { ...cloneItem(id) };
      obj.label.destroy();
      obj.destroy();
      (this as any)._overItem = null;
    }
  }

  drop(slot: 0|1) {
    const it = this.inv[slot]; if (!it) return;
    this.inv[slot] = null;
    const circle = this.add.circle(this.player.x + 14, this.player.y + 14, 8, 0x7cc7a1) as GroundItem;
    circle.label = this.add.text(circle.x, circle.y - 18, it.id, { fontSize: '10px' }).setOrigin(0.5, 1);
    circle.itemId = it.id;
    this.physics.add.existing(circle, true);
    this.configureItemBody(circle);
    this.itemsGroup.add(circle);
  }

  use(slot: 0|1) {
    const it = this.inv[slot]; if (!it) return;
    const id = it.id; let consumed = true;
    // minimal effects for stub; numbers per design doc
    switch(id) {
      case 'knife': this.swingKnife(); break;
      case 'yoyo': this.spinYoyo(); break;
      case 'bottle': this.throwBottle(2); break;
      case 'match': this.fanMatches(); break;
      case 'bandaid': this.hp = Math.min(5, this.hp + 1); this.showSelfBuffTelegraph('💗', 0xff8ca3, 480); break;
      case 'soda': this.speedBoost(3000); this.showSelfBuffTelegraph('🥤', 0x9de4ff, 420); this.afterDelay(3000, () => this.gainBottle(slot)); break;
      case 'fire_bottle': this.throwBottle(3, true); break;
      case 'glass_shiv': this.stabWithShiv(); break;
      case 'bladed_yoyo': this.spinBladedYoyo(); break;
      case 'smoke_patch': this.deploySmokeVeil(); break;
      case 'adrenal_patch': this.hp = Math.min(5, this.hp + 1); this.speedBoost(2000); this.showSelfBuffTelegraph('💉', 0xffc26f, 540); break;
      case 'fizz_bomb': this.throwBottle(3, false, true); break;
      default: consumed = false;
    }
    if (consumed) {
      it.uses -= 1; if (it.uses <= 0) this.inv[slot] = null;
    }
  }

  craft() {
    const a = this.inv[0]?.id; const b = this.inv[1]?.id; if (!a || !b) return;
    const out = craft(a, b); if (!out) return;
    // put result into slot 0; clear slot 1 (simple rule for proto)
    this.inv[0] = { ...cloneItem(out) }; this.inv[1] = null;
  }

  private swingKnife() {
    const range = 64;
    const halfAngle = Phaser.Math.DegToRad(45);
    this.showKnifeTelegraph(range, 0xb8e5ff, '🔪', Phaser.Math.DegToRad(90));
    if (this.isMonsterWithinArc(range, halfAngle)) {
      this.hitMonster(2, '💥');
    }
  }

  private fanMatches() {
    const range = 96;
    const halfAngle = Phaser.Math.DegToRad(32);
    this.showMatchTelegraph(range, 70, 0xffa966, '🔥');
    if (this.isMonsterWithinArc(range, halfAngle)) {
      this.hitMonster(1, '🔥');
    }
  }

  private spinYoyo() {
    const inner = 24;
    const outer = 78;
    this.showRingTelegraph(inner, outer, 0x6cc4ff, '🪀');
    if (this.isMonsterWithinRing(inner, outer)) {
      this.hitMonster(2, '💥');
    }
  }

  private spinBladedYoyo() {
    const inner = 28;
    const outer = 92;
    this.showRingTelegraph(inner, outer, 0xffb347, '🌀', true);
    if (this.isMonsterWithinRing(inner, outer)) {
      this.hitMonster(3, '💥');
    }
  }

  private stabWithShiv() {
    const range = 72;
    const halfAngle = Phaser.Math.DegToRad(18);
    const thickness = 16;
    this.showStabTelegraph(range, thickness, 0xfff1b6, '🗡️');
    if (this.isMonsterWithinStrip(range, halfAngle, thickness * 0.5)) {
      this.hitMonster(3, '💥');
    }
  }

  private deploySmokeVeil() {
    this.showSmokeTelegraph(120, 0xcdd6f5, '🌫️');
  }

  private throwBottle(dmg: number, fire = false, stun = false) {
    const range = 360;
    const laneHalfWidth = fire ? 18 : stun ? 10 : 12;
    const color = fire ? 0xff9966 : stun ? 0xc8f1ff : 0x88d5ff;
    const emoji = fire ? '🔥' : stun ? '💨' : '🍾';
    const tailEmoji = fire ? '🔥' : stun ? '💥' : undefined;
    this.showThrowTelegraph(range, color, emoji, fire ? 520 : 420, laneHalfWidth * 2, tailEmoji);

    const aim = this.getAimAngle();
    const aimDir = new Phaser.Math.Vector2(Math.cos(aim), Math.sin(aim));
    const toTarget = new Phaser.Math.Vector2(this.monster.x - this.player.x, this.monster.y - this.player.y);
    const along = toTarget.dot(aimDir);
    const cross = toTarget.x * aimDir.y - toTarget.y * aimDir.x;

    if (along > 0 && along <= range && Math.abs(cross) <= laneHalfWidth) {
      this.hitMonster(dmg, fire ? '🔥' : stun ? '💫' : '💥');
      if (stun) this.monster.setVelocity(0,0);
    }
  }

  private isMonsterWithinArc(range: number, halfAngle: number) {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.monster.x, this.monster.y);
    if (d > range) return false;
    const aim = this.getAimAngle();
    const toTarget = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.monster.x, this.monster.y);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(toTarget - aim));
    return diff <= halfAngle;
  }

  private isMonsterWithinStrip(range: number, halfAngle: number, halfThickness: number) {
    const aim = this.getAimAngle();
    const aimDir = new Phaser.Math.Vector2(Math.cos(aim), Math.sin(aim));
    const toTarget = new Phaser.Math.Vector2(this.monster.x - this.player.x, this.monster.y - this.player.y);
    const along = toTarget.dot(aimDir);
    if (along <= 0 || along > range) return false;
    const angleToTarget = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.monster.x, this.monster.y);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(angleToTarget - aim));
    if (diff > halfAngle) return false;
    const cross = toTarget.x * aimDir.y - toTarget.y * aimDir.x;
    return Math.abs(cross) <= halfThickness;
  }

  private isMonsterWithinRing(inner: number, outer: number) {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.monster.x, this.monster.y);
    return d >= inner && d <= outer;
  }

  gainBottle(slot: 0|1) {
    if (!this.inv[slot]) { this.inv[slot] = { id: 'bottle', label: 'Empty Bottle', uses: 1 }; return; }
    // try other slot
    const other = slot === 0 ? 1 : 0;
    if (!this.inv[other]) { this.inv[other] = { id: 'bottle', label: 'Empty Bottle', uses: 1 }; return; }
    // drop
    const circle = this.add.circle(this.player.x + 8, this.player.y + 8, 8, 0x7cc7a1) as GroundItem;
    circle.label = this.add.text(circle.x, circle.y - 18, 'bottle', { fontSize: '10px' }).setOrigin(0.5,1);
    circle.itemId = 'bottle';
    this.physics.add.existing(circle, true);
    this.configureItemBody(circle);
    this.itemsGroup.add(circle);
  }

  private configureItemBody(item: GroundItem) {
    const body = item.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(16, 16).setOffset(-8, -8);
    body.updateFromGameObject();
  }

  damagePlayer(n: number) {
    this.hp -= n; this.cameras.main.shake(80, 0.004);
    if (this.hp <= 0) this.scene.restart();
  }

  hitMonster(n: number, emoji: string = '💥') {
    this.monster.hp -= n;
    this.monster.refreshHpBar();
    this.monster.setTint(0xffdddd); this.time.delayedCall(80, () => this.monster.clearTint());
    this.spawnFloatingEmoji(this.monster.x, this.monster.y - 30, emoji, 26, 0xfff4d3);
    if (this.monster.hp <= 0) this.scene.restart();
  }

  speedBoost(ms: number) {
    (this.player.body as Phaser.Physics.Arcade.Body).maxSpeed = 360;
    this.time.delayedCall(ms, () => (this.player.body as Phaser.Physics.Arcade.Body).maxSpeed = 260);
    this.spawnFloatingEmoji(this.player.x, this.player.y - 40, '⚡', 24, 0xe8ff9e, ms);
  }

  afterDelay(ms:number, fn:()=>void) { this.time.delayedCall(ms, fn); }

  private updateAimFromPointer(pointer?: Phaser.Input.Pointer) {
    if (!this.player) return;
    const p = pointer ?? this.input.activePointer;
    if (!p) return;
    const worldPoint = this.cameras.main.getWorldPoint(p.x, p.y);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    if (!Number.isNaN(angle)) this.aimAngle = angle;
  }

  private getAimAngle() {
    return this.aimAngle;
  }

  private showKnifeTelegraph(range: number, color: number, emoji: string, sweep = Phaser.Math.DegToRad(90), duration = 320) {
    const baseAngle = this.getAimAngle();
    const start = baseAngle - sweep / 2;
    const end = baseAngle + sweep / 2;
    const thickness = 24;

    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.95);
    gfx.fillStyle(color, 0.22);
    gfx.fillRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);
    gfx.lineStyle(3, color, 0.9);
    gfx.strokeRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.98);

    const update = (angle: number) => {
      const pivotX = this.player.x;
      const pivotY = this.player.y;
      gfx.setPosition(pivotX, pivotY);
      gfx.setRotation(angle);
      const tipX = pivotX + Math.cos(angle) * range;
      const tipY = pivotY + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY);
    };

    update(start);

    this.tweens.addCounter({
      from: start,
      to: end,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => update(tween.getValue()),
      onComplete: () => gfx.destroy(),
    });

    this.tweens.add({
      targets: icon,
      alpha: { from: 0.98, to: 0 },
      scale: { from: 0.95, to: 1.2 },
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => icon.destroy(),
    });
  }

  private showMatchTelegraph(range: number, baseWidth: number, color: number, emoji: string, duration = 360) {
    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.92);
    gfx.fillStyle(color, 0.24);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(range, -baseWidth / 2);
    gfx.lineTo(range * 0.95, -baseWidth * 0.65);
    gfx.lineTo(range * 0.95, baseWidth * 0.65);
    gfx.lineTo(range, baseWidth / 2);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(3, color, 0.9);
    gfx.strokePath();

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '30px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.98);

    const update = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range;
      const tipY = this.player.y + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY - 12);
    };

    update();

    this.tweens.add({
      targets: gfx,
      scale: { from: 0.7, to: 1.05 },
      alpha: { from: 0.92, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.tweens.add({
      targets: icon,
      alpha: { from: 0.98, to: 0 },
      scale: { from: 0.9, to: 1.3 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  private showStabTelegraph(range: number, thickness: number, color: number, emoji: string, duration = 280) {
    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.95);
    gfx.fillStyle(color, 0.28);
    gfx.fillRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);
    gfx.lineStyle(2, color, 0.9);
    gfx.strokeRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '24px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.96);

    const update = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range;
      const tipY = this.player.y + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY - 10);
    };

    update();

    this.tweens.add({
      targets: gfx,
      scaleX: { from: 0.6, to: 1 },
      alpha: { from: 0.95, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.tweens.add({
      targets: icon,
      alpha: { from: 0.96, to: 0 },
      scale: { from: 0.85, to: 1.2 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  private showRingTelegraph(inner: number, outer: number, color: number, emoji: string, saw = false, duration = 420) {
    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.9);
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(0, 0, outer);
    gfx.fillStyle(0x161a22, 1);
    gfx.fillCircle(0, 0, inner);
    gfx.lineStyle(3, color, 0.9).strokeCircle(0, 0, outer);
    gfx.lineStyle(2, color, 0.5).strokeCircle(0, 0, inner);

    if (saw) {
      gfx.lineStyle(2, color, 0.7);
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const sx = Math.cos(angle) * inner;
        const sy = Math.sin(angle) * inner;
        const ex = Math.cos(angle) * (outer + 8);
        const ey = Math.sin(angle) * (outer + 8);
        gfx.beginPath();
        gfx.moveTo(sx, sy);
        gfx.lineTo(ex, ey);
        gfx.strokePath();
      }
    }

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '30px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.95);

    const update = (t?: number) => {
      gfx.setPosition(this.player.x, this.player.y);
      icon.setPosition(this.player.x, this.player.y);
      if (typeof t === 'number') {
        const angle = t * Math.PI * 2;
        icon.setPosition(
          this.player.x + Math.cos(angle) * outer * 0.75,
          this.player.y + Math.sin(angle) * outer * 0.75
        );
      }
    };

    update();

    this.tweens.add({
      targets: gfx,
      alpha: { from: 0.9, to: 0 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: () => update(),
      onComplete: () => gfx.destroy(),
    });

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Linear',
      onUpdate: (tween) => update(tween.getValue()),
      onComplete: () => icon.destroy(),
    });
  }

  private showSelfBuffTelegraph(emoji: string, color: number, duration = 420) {
    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.85);
    gfx.lineStyle(3, color, 0.8);
    for (let i = 0; i < 3; i += 1) {
      gfx.beginPath();
      gfx.arc(0, 0, 26 + i * 8, Math.PI * 0.15, Math.PI * 1.85, false);
      gfx.strokePath();
    }

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.95);

    const update = (t?: number) => {
      gfx.setPosition(this.player.x, this.player.y);
      if (typeof t === 'number') {
        const angle = t * Math.PI * 2;
        icon.setPosition(
          this.player.x + Math.cos(angle) * 18,
          this.player.y + Math.sin(angle) * 18 - 10
        );
      } else {
        icon.setPosition(this.player.x, this.player.y - 10);
      }
    };

    update();

    this.tweens.add({
      targets: gfx,
      alpha: { from: 0.85, to: 0 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: () => update(),
      onComplete: () => gfx.destroy(),
    });

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => update(tween.getValue()),
      onComplete: () => icon.destroy(),
    });
  }

  private showSmokeTelegraph(radius: number, color: number, emoji: string, duration = 520) {
    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.8);
    gfx.fillStyle(color, 0.18).fillCircle(0, 0, radius);
    gfx.lineStyle(2, color, 0.55).strokeCircle(0, 0, radius);

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '30px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.9);

    const update = () => {
      gfx.setPosition(this.player.x, this.player.y);
      icon.setPosition(this.player.x, this.player.y - 18);
    };

    update();

    this.tweens.add({
      targets: gfx,
      scale: { from: 0.5, to: 1 },
      alpha: { from: 0.8, to: 0 },
      duration,
      ease: 'Quad.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.tweens.add({
      targets: icon,
      alpha: { from: 0.9, to: 0 },
      duration,
      ease: 'Quad.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  private showThrowTelegraph(range: number, color: number, emoji: string, duration = 420, thickness = 24, tailEmoji?: string) {
    const rect = this.add.rectangle(this.player.x, this.player.y, range, thickness, color, 0.2)
      .setDepth(this.fxDepth)
      .setOrigin(0, 0.5)
      .setAlpha(0.9)
      .setScale(0.05, 1);

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.95)
      .setScale(0.85);

    const burst = tailEmoji
      ? this.add.text(this.player.x, this.player.y, tailEmoji, { fontSize: '22px' })
          .setOrigin(0.5)
          .setDepth(this.fxDepth + 1)
          .setAlpha(0)
      : null;

    const updatePositions = () => {
      const angle = this.getAimAngle();
      rect.setPosition(this.player.x, this.player.y);
      rect.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range;
      const tipY = this.player.y + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY);
      if (burst && burst.active) burst.setPosition(tipX, tipY);
    };

    updatePositions();

    this.tweens.add({
      targets: rect,
      scaleX: { from: 0.05, to: 1 },
      alpha: { from: 0.9, to: 0 },
      ease: 'Cubic.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => rect.destroy(),
    });

    this.tweens.add({
      targets: icon,
      alpha: { from: 0.95, to: 0 },
      scale: { from: 0.85, to: 1.2 },
      ease: 'Sine.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => icon.destroy(),
    });

    if (burst) {
      this.tweens.add({
        targets: burst,
        alpha: { from: 0, to: 0.9 },
        scale: { from: 0.8, to: 1.3 },
        ease: 'Quad.easeOut',
        duration: duration * 0.6,
        yoyo: true,
        onUpdate: updatePositions,
        onComplete: () => burst.destroy(),
      });
    }
  }

  private spawnFloatingEmoji(x: number, y: number, emoji: string, fontSize = 24, tint = 0xffffff, duration = 480) {
    const label = this.add.text(x, y, emoji, {
      fontSize: `${fontSize}px`,
    }).setOrigin(0.5).setDepth(this.fxDepth + 2);

    label.setTint(tint);

    this.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0 },
      y: y - 20,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  update(time: number, delta: number) {
    this.updateAimFromPointer();

    // movement
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = 260; body.setVelocity(0,0);
    if (this.cursors.left?.isDown) body.setVelocityX(-speed);
    if (this.cursors.right?.isDown) body.setVelocityX(speed);
    if (this.cursors.up?.isDown) body.setVelocityY(-speed);
    if (this.cursors.down?.isDown) body.setVelocityY(speed);

    const overItem: GroundItem | null = (this as any)._overItem || null;
    if (overItem && (!overItem.active || !this.physics.overlap(this.player, overItem as any))) {
      (this as any)._overItem = null;
    }

    // interaction
    if (Phaser.Input.Keyboard.JustDown(this.keyPick)) this.tryPickup();
    if (Phaser.Input.Keyboard.JustDown(this.keyDrop)) this.drop(0);
    if (Phaser.Input.Keyboard.JustDown(this.keyCraft)) this.craft();

    // monster update
    this.monster.update(delta/1000, this.player);

    // HUD
    drawHUD(this.hud, this.hp, 5, this.inv);
  }
}

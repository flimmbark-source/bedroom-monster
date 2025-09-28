import Phaser from 'phaser';
import { ROOM_W, ROOM_H, PLAYER_BASE } from '@game/config';
import type { Inventory, Item } from '@game/types';
import { cloneItem } from '@game/items';
import { craft } from '@game/recipes';
import { Monster } from '@game/monster';
import { createHUD, drawHUD, type HudElements } from '@ui/hud';

export class PlayScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  monster!: Monster;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keyUse1!: Phaser.Input.Keyboard.Key; keyUse2!: Phaser.Input.Keyboard.Key;
  keyPick!: Phaser.Input.Keyboard.Key; keyDrop!: Phaser.Input.Keyboard.Key; keyCraft!: Phaser.Input.Keyboard.Key;

  hp = PLAYER_BASE.hp; inv: Inventory = [null, null];
  itemsGroup!: Phaser.Physics.Arcade.StaticGroup;
  hud!: HudElements;

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
    this.physics.add.collider(this.player, blocks);

    // monster
    this.monster = new Monster(this, 900, 700);
    this.physics.add.collider(this.monster, blocks);
    this.physics.add.overlap(this.monster, this.player, () => {
      // contact damage once per second (simple throttle)
      if (!(this.player as any)._lastHit || this.time.now - (this.player as any)._lastHit > 1000) {
        (this.player as any)._lastHit = this.time.now; this.damagePlayer(1);
      }
    });

    // input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyUse1 = this.input.keyboard!.addKey('ONE');
    this.keyUse2 = this.input.keyboard!.addKey('TWO');
    this.keyPick = this.input.keyboard!.addKey('E');
    this.keyDrop = this.input.keyboard!.addKey('G');
    this.keyCraft = this.input.keyboard!.addKey('R');

    // items on ground
    this.itemsGroup = this.physics.add.staticGroup();
    const spawn = (x:number,y:number,id: Item['id']) => {
      const circle = this.add.circle(0,0,8,0x7cc7a1);
      const label = this.add.text(0,-18,id,{fontSize:'10px'}).setOrigin(0.5,1);
      const container = this.add.container(x,y,[circle,label]);
      this.physics.add.existing(container, true);
      this.configureItemBody(container);
      (container as any).itemId = id;
      this.itemsGroup.add(container as any);
    };
    // starter items
    spawn(260, 560, 'knife');
    spawn(980, 560, 'bottle');
    spawn(640, 260, 'soda');
    spawn(720, 260, 'match');
    spawn(380, 720, 'bandaid');
    spawn(680, 720, 'yoyo');

    this.physics.add.overlap(this.player, this.itemsGroup, (_, obj:any) => {
      (this as any)._overItem = obj;
    });

    // player hit listener
    this.player.on('hit', (e: any) => this.damagePlayer(e.dmg||1));

    // HUD
    this.hud = createHUD(this, 5);
  }

  tryPickup() {
    const obj: any = (this as any)._overItem; if (!obj) return;
    const id = obj.itemId as Item['id'];
    // find slot
    const idx = this.inv[0]? (this.inv[1]? -1 : 1) : 0;
    if (idx === -1) {
      // swap with slot 0 by default
      const dropped = this.inv[0]!; this.inv[0] = { ...cloneItem(id) };
      (obj as any).itemId = dropped.id; // leave the dropped one on ground
      (obj.list[1] as Phaser.GameObjects.Text).setText(dropped.id);
    } else {
      this.inv[idx] = { ...cloneItem(id) };
      obj.destroy();
      (this as any)._overItem = null;
    }
  }

  drop(slot: 0|1) {
    const it = this.inv[slot]; if (!it) return;
    this.inv[slot] = null;
    const circle = this.add.circle(0,0,8,0x7cc7a1);
    const label = this.add.text(0,-18,it.id,{fontSize:'10px'}).setOrigin(0.5,1);
    const container = this.add.container(this.player.x+14,this.player.y+14,[circle,label]);
    this.physics.add.existing(container, true);
    this.configureItemBody(container);
    (container as any).itemId = it.id;
    this.itemsGroup.add(container as any);
  }

  use(slot: 0|1) {
    const it = this.inv[slot]; if (!it) return;
    const id = it.id; let consumed = true;
    // minimal effects for stub; numbers per design doc
    switch(id) {
      case 'knife': this.tryMelee(2, 48); break;
      case 'yoyo': this.tryMelee(2, 72); break;
      case 'bottle': this.throwBottle(2); break;
      case 'match': this.tryMelee(1, 40, true); break;
      case 'bandaid': this.hp = Math.min(5, this.hp + 1); break;
      case 'soda': this.speedBoost(3000); this.afterDelay(3000, () => this.gainBottle(slot)); break;
      case 'fire_bottle': this.throwBottle(3, true); break;
      case 'glass_shiv': this.tryMelee(3, 44); break;
      case 'bladed_yoyo': this.tryMelee(3, 80); break;
      case 'smoke_patch': /* escape utility placeholder */ break;
      case 'adrenal_patch': this.hp = Math.min(5, this.hp + 1); this.speedBoost(2000); break;
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

  tryMelee(dmg: number, range: number, fire = false) {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.monster.x, this.monster.y);
    if (d <= range) this.hitMonster(dmg);
    if (fire) {/* could apply DoT in later pass */}
  }

  throwBottle(dmg: number, fire = false, stun = false) {
    // instant line check for proto
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.monster.x, this.monster.y);
    if (d < 360) {
      this.hitMonster(dmg);
      if (stun) this.monster.setVelocity(0,0);
    }
  }

  gainBottle(slot: 0|1) {
    if (!this.inv[slot]) { this.inv[slot] = { id: 'bottle', label: 'Empty Bottle', uses: 1 }; return; }
    // try other slot
    const other = slot === 0 ? 1 : 0;
    if (!this.inv[other]) { this.inv[other] = { id: 'bottle', label: 'Empty Bottle', uses: 1 }; return; }
    // drop
    const circle = this.add.circle(0,0,8,0x7cc7a1);
    const label = this.add.text(0,-18,'bottle',{fontSize:'10px'}).setOrigin(0.5,1);
    const container = this.add.container(this.player.x+8,this.player.y+8,[circle,label]);
    this.physics.add.existing(container, true);
    this.configureItemBody(container);
    (container as any).itemId = 'bottle';
    this.itemsGroup.add(container as any);
  }

  private configureItemBody(container: Phaser.GameObjects.Container) {
    const body = container.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(16, 16).setOffset(-8, -8);
    body.updateFromGameObject();
  }

  damagePlayer(n: number) {
    this.hp -= n; this.cameras.main.shake(80, 0.004);
    if (this.hp <= 0) this.scene.restart();
  }

  hitMonster(n: number) {
    this.monster.hp -= n;
    this.monster.setTint(0xffdddd); this.time.delayedCall(80, () => this.monster.clearTint());
    if (this.monster.hp <= 0) this.scene.restart();
  }

  speedBoost(ms: number) {
    (this.player.body as Phaser.Physics.Arcade.Body).maxSpeed = 360;
    this.time.delayedCall(ms, () => (this.player.body as Phaser.Physics.Arcade.Body).maxSpeed = 260);
  }

  afterDelay(ms:number, fn:()=>void) { this.time.delayedCall(ms, fn); }

  update(time: number, delta: number) {
    // movement
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = 260; body.setVelocity(0,0);
    if (this.cursors.left?.isDown) body.setVelocityX(-speed);
    if (this.cursors.right?.isDown) body.setVelocityX(speed);
    if (this.cursors.up?.isDown) body.setVelocityY(-speed);
    if (this.cursors.down?.isDown) body.setVelocityY(speed);

    const overItem: Phaser.GameObjects.Container | null = (this as any)._overItem || null;
    if (overItem && (!overItem.active || !this.physics.overlap(this.player, overItem as any))) {
      (this as any)._overItem = null;
    }

    // interaction
    if (Phaser.Input.Keyboard.JustDown(this.keyPick)) this.tryPickup();
    if (Phaser.Input.Keyboard.JustDown(this.keyDrop)) this.drop(0);
    if (Phaser.Input.Keyboard.JustDown(this.keyUse1)) this.use(0);
    if (Phaser.Input.Keyboard.JustDown(this.keyUse2)) this.use(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyCraft)) this.craft();

    // monster update
    this.monster.update(delta/1000, this.player);

    // HUD
    drawHUD(this.hud, this.hp, 5, this.inv);
  }
}

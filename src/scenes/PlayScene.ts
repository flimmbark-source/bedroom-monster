import Phaser from 'phaser';
import { MONSTER_SPRITES } from '@content/monsterSprites';
import { PLAYER_BASE } from '@game/config';
import { ITEM_ICON_SOURCES, type Item } from '@game/items';
import { DoorSystem, resetDoors } from '@game/doors';
import { resetKeys } from '@game/keys';
import type { DoorDefinition, RoomId } from '@game/world';
import { Monster, type TelegraphImpact, type MonsterHitbox } from '@game/monster';
import { createHUD, drawHUD, type HudElements } from '@ui/hud';
import { createEndCard, type EndCardElements } from '@ui/endCard';
import { InputSystem } from '../systems/InputSystem';
import { InventorySystem, type GroundItem } from '../systems/InventorySystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { SearchSystem, type SpawnEmojiFn } from '../systems/SearchSystem';
import { TelegraphSystem, type MonsterDamageEvent } from '../systems/TelegraphSystem';

type TelegraphSfxKey = 'whoosh' | 'rise' | 'crack' | 'thud';
import { pickWeightedValue } from '@content/rooms';
import { RoomLoader, type LoadedRoom } from './RoomLoader';

const DEFAULT_ROOM_ID: RoomId = 'hallway';

export class PlayScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  monster!: Monster;
  hud!: HudElements;
  endCard!: EndCardElements;

  private hp = PLAYER_BASE.hp;
  private inputSystem!: InputSystem;
  private inventorySystem!: InventorySystem;
  private spawnerSystem!: SpawnerSystem;
  private searchSystem!: SearchSystem;
  private telegraphSystem!: TelegraphSystem;
  private doorSystem?: DoorSystem;
  private fxDepth = 200;
  private overItem: GroundItem | null = null;
  private playerIFrameUntil = 0;
  private playerSlowUntil = 0;
  private playerSlowFactor = 1;
  private playerSpeedBoostUntil = 0;
  private playerSpeedBoostMultiplier = 1;
  private playerKnockbackUntil = 0;
  private playerShoveCooldownUntil = 0;
  private readonly playerShoveCooldown = 8000;
  private hitstopUntil = 0;
  private hitstopActive = false;
  private storedPlayerVelocity = new Phaser.Math.Vector2();
  private storedMonsterVelocity = new Phaser.Math.Vector2();
  private pendingPostHitstop: (() => void)[] = [];
  private playerBlinkEvent?: Phaser.Time.TimerEvent;
  private playerAnimPausedByHitstop = false;
  private monsterAnimPausedByHitstop = false;
  private runEnded = false;
  private runStartAt = 0;
  private runStats: { damageDealt: number; itemsUsed: number; craftsMade: number } = {
    damageDealt: 0,
    itemsUsed: 0,
    craftsMade: 0,
  };
  private roomLoader!: RoomLoader;
  private roomState!: LoadedRoom;
  private transitioningRoom = false;
  private monsterFurnitureCollider?: Phaser.Physics.Arcade.Collider;
  private spawnEmojiFn!: SpawnEmojiFn;
  constructor() { super('Play'); }

  preload() {
    this.load.image('bg_hallway', 'assets/bg_hallway.png');
    this.load.image('bg_infirmary', 'assets/bg_infirmary.png');
    this.load.image('bg_office', 'assets/bg_office.png');
    this.load.image('bg_kitchen', 'assets/bg_kitchen.png');
    this.load.image('bg_entrance', 'assets/bg_entrance.png');
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 102,
      frameHeight: 152,
    });
    const monsterSpriteConfigs = new Map(
      Object.values(MONSTER_SPRITES).map((sprite) => [sprite.textureKey, sprite]),
    );
    monsterSpriteConfigs.forEach((sprite) => {
      this.load.spritesheet(sprite.textureKey, sprite.texturePath, {
        frameWidth: sprite.frame.width,
        frameHeight: sprite.frame.height,
        margin: sprite.frame.margin ?? 0,
        spacing: sprite.frame.spacing ?? 0,
      });
    });

    this.load.atlasJSONHash('furniture', 'assets/furniture_sheet.png', 'assets/furniture_atlas.json');
    this.load.atlasJSONHash('doors_windows', 'assets/doors_windows_sheet.png', 'assets/doors_windows_atlas.json');

    Object.entries(ITEM_ICON_SOURCES).forEach(([key, source]) => {
      if (source.type === 'sheet') {
        this.load.spritesheet(key, source.path, {
          frameWidth: source.frameWidth,
          frameHeight: source.frameHeight,
        });
      } else {
        this.load.image(key, source.path);
      }
    });

  }

  create() {
    resetKeys();
    resetDoors();

    this.resetPlayerState();
    this.createAnimations();

    this.runEnded = false;
    this.runStats = { damageDealt: 0, itemsUsed: 0, craftsMade: 0 };
    this.runStartAt = this.time.now;

    this.spawnEmojiFn = (x, y, emoji, fontSize, tint, duration) =>
      this.spawnFloatingEmoji(x, y, emoji, fontSize, tint, duration);
    this.inventorySystem = new InventorySystem(this);
    this.searchSystem = new SearchSystem(this, this.inventorySystem, this.spawnEmojiFn, this.fxDepth);
    this.roomLoader = new RoomLoader(this, this.searchSystem, this.inventorySystem);
    this.inputSystem = new InputSystem(this, {
      onUse: (slot) => this.use(slot),
      onPickup: () => this.tryPickup(),
      onStartSearch: () => this.searchSystem.tryStartSearch(this.player),
      onDrop: (slot) => this.drop(slot),
      onCraft: () => this.craft(),
      onSearchInterrupted: () => this.searchSystem.endSearch(),
      onShove: () => this.tryShove(),
    });

    this.inventorySystem.reset();
    this.searchSystem.reset();
    this.hp = PLAYER_BASE.hp;
    this.overItem = null;

    this.roomState = this.roomLoader.load(DEFAULT_ROOM_ID);

    const { width: roomWidth, height: roomHeight } = this.roomState.size;

    this.player = this.physics.add.sprite(roomWidth / 2, roomHeight / 2, 'player', 8);
    this.player.setScale(0.5);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const playerScaleX = Math.abs(this.player.scaleX) || 1;
    const playerScaleY = Math.abs(this.player.scaleY) || 1;
    const playerBodyWidth = 38;
    const playerBodyHeight = 48;
    const playerBodyOffsetX = 13;
    const playerBodyOffsetY = 50;
    playerBody.setSize(playerBodyWidth / playerScaleX, playerBodyHeight / playerScaleY);
    playerBody.setOffset(playerBodyOffsetX / playerScaleX, playerBodyOffsetY / playerScaleY);
    playerBody.maxSpeed = 260;
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.anims.play('player-idle-down');

    this.doorSystem = new DoorSystem(this, this.player, {
      onDoorOpened: (door) => this.handleDoorOpened(door),
    });
    this.roomLoader.setDoorSystem(this.doorSystem);

    this.inputSystem.setPlayer(this.player);
    this.inputSystem.create();

    const furniture = this.searchSystem.furnitureGroup;
    this.physics.add.collider(
      this.player,
      furniture,
      this.searchSystem.handlePlayerFurnitureCollision,
      undefined,
      this.searchSystem,
    );
    this.physics.add.collider(furniture, furniture);

    this.spawnMonsterForCurrentRoom();
    this.telegraphSystem = new TelegraphSystem(
      this,
      this.player,
      this.monster,
      this.inputSystem,
      this.fxDepth,
      this.spawnEmojiFn,
      () => this.handleRunEnd('victory'),
      (event) => this.handleMonsterDamaged(event),
    );

    this.events.on('play-sfx', this.playStubSfx, this);
    this.events.once('shutdown', () => {
      this.events.off('play-sfx', this.playStubSfx, this);
      this.doorSystem?.destroy();
    });

    this.setupSpawnerForCurrentRoom();

    this.physics.add.overlap(this.player, this.inventorySystem.itemsGroup, (_, obj) => {
      this.overItem = obj as GroundItem;
    });

    this.player.on('hit', (e: any) => this.damagePlayer(e.dmg || 1));

    this.hud = createHUD(this, 5);
    this.endCard = createEndCard(this);
  }

  private setupSpawnerForCurrentRoom() {
    this.spawnerSystem?.destroy();
    this.spawnerSystem = new SpawnerSystem(
      this,
      this.inventorySystem,
      this.roomState.restockPoints.map((point) => ({ ...point })),
      this.roomState.spawns.items.map((entry) => ({ ...entry })),
    );
    this.spawnerSystem.spawnInitialItems([...this.roomState.starterItems]);
    this.spawnerSystem.scheduleRestock(this.roomState.spawns.restock);
  }

  private spawnMonsterForCurrentRoom() {
    this.monster?.destroy();
    this.monsterFurnitureCollider?.destroy();
    this.monsterFurnitureCollider = undefined;

    const { width: roomWidth, height: roomHeight } = this.roomState.size;
    const monsterSpawnX = roomWidth + 120;
    const monsterSpawnY = roomHeight / 2;
    const monsterId = pickWeightedValue(
      this.roomState.spawns.monsters,
      () => Phaser.Math.FloatBetween(0, 1),
    );
    const isMiniElite = Phaser.Math.FloatBetween(0, 1) < 0.2;

    this.monster = new Monster(this, monsterSpawnX, monsterSpawnY, monsterId);
    if (isMiniElite) {
      this.monster.promoteToMiniElite();
    }
    this.monster.setDepth(10);
    this.monster.startSpawnBurst({ x: -1, y: 0 }, 900, 0.3);
    this.monsterFurnitureCollider = this.physics.add.collider(
      this.monster,
      this.searchSystem.furnitureGroup,
      this.searchSystem.handleMonsterFurnitureCollision,
      undefined,
      this.searchSystem,
    );
  }

  tryPickup(): boolean {
    if (this.runEnded) return false;
    if (this.doorSystem?.tryInteract()) {
      return true;
    }
    if (!this.overItem) return false;
    const success = this.inventorySystem.tryPickup(this.overItem);
    if (success && (!this.overItem.active || !this.physics.overlap(this.player, this.overItem as any))) {
      this.overItem = null;
    }
    return success;
  }

  drop(slot: 0 | 1) {
    if (this.runEnded) return;
    this.inventorySystem.drop(slot, this.player.x + 14, this.player.y + 14);
  }

  craft() {
    if (this.runEnded) return;
    const crafted = this.inventorySystem.craft();
    if (crafted) {
      this.runStats.craftsMade += 1;
      this.refreshHUD();
    }
  }

  private tryShove() {
    if (this.runEnded) return;
    const now = this.time.now;
    if (now < this.playerShoveCooldownUntil) return;
    const facing = this.inputSystem.getFacing();
    const shoved = this.searchSystem.tryPlayerShove(this.player, facing, now);
    if (shoved) {
      this.playerShoveCooldownUntil = now + this.playerShoveCooldown;
    }
  }

  use(slot: 0 | 1) {
    if (this.runEnded) return;
    const item = this.inventorySystem.getItem(slot);
    if (!item) return;
    const consumed = this.useItemByVerb(item, slot);
    if (consumed) {
      this.runStats.itemsUsed += 1;
      this.inventorySystem.consume(slot);
      this.refreshHUD();
    }
  }

  private useItemByVerb(item: Item, slot: 0 | 1): boolean {
    switch (item.verb) {
      case 'slash':
        this.swingKnife();
        return true;
      case 'swing':
        this.spinYoyo();
        return true;
      case 'throw':
        this.throwBottle(2);
        return true;
      case 'ignite':
        this.fanMatches();
        return true;
      case 'heal':
        this.hp = Math.min(5, this.hp + 1);
        this.telegraphSystem.showSelfBuffTelegraph('💗', 0xff8ca3, 480);
        return true;
      case 'drink':
        this.speedBoost(3000);
        this.telegraphSystem.showSelfBuffTelegraph('🥤', 0x9de4ff, 420);
        this.afterDelay(3000, () => this.gainBottle(slot));
        return true;
      case 'hurl':
        this.throwBottle(3, true);
        return true;
      case 'stab':
        this.stabWithShiv();
        return true;
      case 'reap':
        this.spinBladedYoyo();
        return true;
      case 'mask':
        this.deploySmokeVeil();
        return true;
      case 'boost':
        this.hp = Math.min(5, this.hp + 1);
        this.speedBoost(2000);
        this.telegraphSystem.showSelfBuffTelegraph('💉', 0xffc26f, 540);
        return true;
      case 'detonate':
        this.throwBottle(3, false, true);
        return true;
      default:
        return false;
    }
  }

  private swingKnife() {
    const range = 64;
    const halfAngle = Phaser.Math.DegToRad(45);
    this.telegraphSystem.showKnifeTelegraph(range, 0xb8e5ff, '🔪', Phaser.Math.DegToRad(90));
    const hits = this.telegraphSystem.getMonsterHitboxesWithinArc(range, halfAngle);
    if (hits.length) {
      this.telegraphSystem.hitMonster(2, '💥', hits);
    }
  }

  private fanMatches() {
    const range = 96;
    const halfAngle = Phaser.Math.DegToRad(32);
    this.telegraphSystem.showMatchTelegraph(range, 70, 0xffa966, '🔥');
    const hits = this.telegraphSystem.getMonsterHitboxesWithinArc(range, halfAngle);
    if (hits.length) {
      this.telegraphSystem.hitMonster(1, '🔥', hits);
    }
  }

  private spinYoyo() {
    const inner = 24;
    const outer = 78;
    this.telegraphSystem.showRingTelegraph(inner, outer, 0x6cc4ff, '🪀');
    const hits = this.telegraphSystem.getMonsterHitboxesWithinRing(inner, outer);
    if (hits.length) {
      this.telegraphSystem.hitMonster(2, '💥', hits);
    }
  }

  private spinBladedYoyo() {
    const inner = 28;
    const outer = 92;
    this.telegraphSystem.showRingTelegraph(inner, outer, 0xffb347, '🌀', true);
    const hits = this.telegraphSystem.getMonsterHitboxesWithinRing(inner, outer);
    if (hits.length) {
      this.telegraphSystem.hitMonster(3, '💥', hits);
    }
  }

  private stabWithShiv() {
    const range = 72;
    const halfAngle = Phaser.Math.DegToRad(18);
    const thickness = 16;
    this.telegraphSystem.showStabTelegraph(range, thickness, 0xfff1b6, '🗡️');
    const hits = this.telegraphSystem.getMonsterHitboxesWithinStrip(range, halfAngle, thickness * 0.5);
    if (hits.length) {
      this.telegraphSystem.hitMonster(3, '💥', hits);
    }
  }

  private deploySmokeVeil() {
    this.telegraphSystem.showSmokeTelegraph(120, 0xcdd6f5, '🌫️');
  }

  private throwBottle(dmg: number, fire = false, stun = false) {
    const range = 360;
    const laneHalfWidth = fire ? 18 : stun ? 10 : 12;
    const color = fire ? 0xff9966 : stun ? 0xc8f1ff : 0x88d5ff;
    const emoji = fire ? '🔥' : stun ? '💨' : '🍾';
    const tailEmoji = fire ? '🔥' : stun ? '💥' : undefined;
    this.telegraphSystem.showThrowTelegraph(range, color, emoji, fire ? 520 : 420, laneHalfWidth * 2, tailEmoji);
    const hits = this.telegraphSystem.getMonsterHitboxesWithinLane(range, laneHalfWidth);
    if (hits.length) {
      const upfrontDamage = fire ? 1 : dmg;
      const dealt = this.telegraphSystem.hitMonster(upfrontDamage, fire ? '🔥' : stun ? '💫' : '💥', hits);
      if (fire && dealt > 0) {
        this.monster.applyBurning(4000);
        const remainingBase = Math.max(dmg - upfrontDamage, 0);
        if (remainingBase > 0) {
          this.applyBurningDamage(remainingBase, hits);
        }
      }
      if (stun) this.monster.setVelocity(0, 0);
    }
  }

  private gainBottle(slot: 0 | 1) {
    this.inventorySystem.gainBottle(slot, this.player.x + 8, this.player.y + 8);
  }

  damagePlayer(
    n: number,
    options: { shake?: { duration: number; intensity: number }; isDot?: boolean } = {},
  ) {
    if (this.runEnded) return;
    if (n <= 0) return;
    const shake = options.shake ?? { duration: 80, intensity: 0.004 };
    const isDot = Boolean(options.isDot);
    if (shake && !isDot) {
      this.cameras.main.shake(shake.duration, shake.intensity);
    }
    if (!isDot) {
      this.startHitstop(Phaser.Math.Between(60, 90));
    }
    this.startPlayerIFrames(150);
    if (!isDot) {
      this.events.emit('play-sfx', 'thud');
    }
    this.spawnDamageNumber(this.player.x, this.player.y - 24, n, { isDot });
    this.hp -= n;
    this.hp = Math.max(this.hp, 0);
    this.refreshHUD();
    if (this.hp <= 0) {
      this.handleRunEnd('defeat');
    }
  }

  private handleRunEnd(outcome: 'defeat' | 'victory') {
    if (this.runEnded) return;
    this.runEnded = true;
    this.endHitstop(true);

    this.searchSystem.endSearch();
    this.physics.world.pause();

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (playerBody) {
      playerBody.setVelocity(0, 0);
      playerBody.moves = false;
    }
    const monsterBody = this.monster.body as Phaser.Physics.Arcade.Body | undefined;
    if (monsterBody) {
      monsterBody.setVelocity(0, 0);
      monsterBody.moves = false;
    }

    if (this.player.anims?.isPlaying) {
      this.player.anims.pause();
    }
    if (this.monster.anims?.isPlaying) {
      this.monster.anims.pause();
    }

    this.refreshHUD();

    const summary = {
      outcome,
      timeSurvivedMs: Math.max(this.time.now - this.runStartAt, 0),
      damageDealt: this.runStats.damageDealt,
      itemsUsed: this.runStats.itemsUsed,
      craftsMade: this.runStats.craftsMade,
    };
    this.endCard.show(summary);

    this.time.delayedCall(500, () => {
      if (!this.runEnded) return;
      this.endCard.showPrompt();
      this.setupRunRestartHandlers();
    });
  }

  private setupRunRestartHandlers() {
    let handled = false;
    const restart = () => {
      if (!this.runEnded || handled) return;
      handled = true;
      this.physics.world.resume();
      this.endCard.hide();
      this.scene.restart();
    };

    const keyboard = this.input.keyboard;
    keyboard?.once('keydown-SPACE', restart);
    keyboard?.once('keydown-ENTER', restart);
    keyboard?.once('keydown-R', restart);
    this.input.once('pointerdown', restart);
  }

  private playStubSfx(key: TelegraphSfxKey) {
    if (this.sound.locked) return;
    const existing = this.sound.get(key);
    if (existing) {
      existing.play();
      return;
    }
    console.debug?.(`[sfx:${key}]`);
  }

  private handleMonsterDamaged(event: MonsterDamageEvent) {
    if (this.runEnded) return;
    if (!event || event.damage <= 0) return;
    if (!event.isDot) {
      this.startHitstop(Phaser.Math.Between(40, 70));
      this.events.emit('play-sfx', 'thud');
    }
    this.runStats.damageDealt += event.damage;
  }

  private startHitstop(duration: number) {
    if (duration <= 0) return;
    const now = this.time.now;
    this.hitstopUntil = Math.max(this.hitstopUntil, now + duration);
    if (this.hitstopActive) {
      return;
    }
    this.hitstopActive = true;

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (playerBody) {
      this.storedPlayerVelocity.set(playerBody.velocity.x, playerBody.velocity.y);
      playerBody.setVelocity(0, 0);
      playerBody.moves = false;
    }
    this.playerAnimPausedByHitstop = Boolean(this.player.anims.isPlaying);
    if (this.playerAnimPausedByHitstop) {
      this.player.anims.pause();
    }

    const monsterBody = this.monster.body as Phaser.Physics.Arcade.Body | undefined;
    if (monsterBody) {
      this.storedMonsterVelocity.set(monsterBody.velocity.x, monsterBody.velocity.y);
      monsterBody.setVelocity(0, 0);
      monsterBody.moves = false;
    }
    this.monsterAnimPausedByHitstop = Boolean(this.monster.anims.isPlaying);
    if (this.monsterAnimPausedByHitstop) {
      this.monster.anims.pause();
    }
  }

  private endHitstop(skipTasks = false) {
    if (!this.hitstopActive) {
      this.hitstopUntil = 0;
      if (skipTasks) this.pendingPostHitstop.length = 0;
      return;
    }

    this.hitstopActive = false;
    this.hitstopUntil = 0;

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (playerBody) {
      playerBody.moves = true;
      playerBody.setVelocity(this.storedPlayerVelocity.x, this.storedPlayerVelocity.y);
    }
    if (this.playerAnimPausedByHitstop && this.player.anims.currentAnim) {
      this.player.anims.resume();
    }
    this.playerAnimPausedByHitstop = false;

    const monsterBody = this.monster.body as Phaser.Physics.Arcade.Body | undefined;
    if (monsterBody) {
      monsterBody.moves = true;
      monsterBody.setVelocity(this.storedMonsterVelocity.x, this.storedMonsterVelocity.y);
    }
    if (this.monsterAnimPausedByHitstop && this.monster.anims.currentAnim) {
      this.monster.anims.resume();
    }
    this.monsterAnimPausedByHitstop = false;

    const tasks = this.pendingPostHitstop.splice(0);
    if (!skipTasks) {
      tasks.forEach((fn) => fn());
    } else {
      this.pendingPostHitstop.length = 0;
    }
  }

  private queueAfterHitstop(callback: () => void) {
    if (this.hitstopActive) {
      this.pendingPostHitstop.push(callback);
    } else {
      callback();
    }
  }

  private startPlayerIFrames(duration = 150) {
    const now = this.time.now;
    this.playerIFrameUntil = Math.max(this.playerIFrameUntil, now + duration);

    if (this.playerBlinkEvent) {
      this.playerBlinkEvent.destroy();
      this.playerBlinkEvent = undefined;
    }

    this.player.setAlpha(0.45);
    this.playerBlinkEvent = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this.time.now >= this.playerIFrameUntil) {
          this.player.setAlpha(1);
          this.playerBlinkEvent?.destroy();
          this.playerBlinkEvent = undefined;
          return;
        }
        const isDim = this.player.alpha > 0.8;
        this.player.setAlpha(isDim ? 0.45 : 1);
      },
    });
  }

  private spawnDamageNumber(
    x: number,
    y: number,
    amount: number,
    options: { tint?: number; isDot?: boolean } = {},
  ) {
    const label = this.add
      .text(x, y, `-${Math.round(amount)}`, {
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 3)
      .setScale(0.9);

    const tint = options.isDot ? 0xffb066 : options.tint ?? 0xff5f5f;
    label.setTint(tint);

    this.tweens.add({
      targets: label,
      y: y - 20,
      alpha: { from: 1, to: 0 },
      duration: options.isDot ? 500 : 360,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private applyBurningDamage(totalBaseDamage: number, hitboxes: MonsterHitbox[]) {
    if (totalBaseDamage <= 0) return;
    const ticks = Math.max(1, Math.round(totalBaseDamage));
    const perTickBase = totalBaseDamage / ticks;
    for (let i = 1; i <= ticks; i++) {
      this.time.delayedCall(450 * i, () => {
        if (!this.monster.active || this.monster.hp <= 0) return;
        this.telegraphSystem.hitMonster(perTickBase, '🔥', hitboxes, { isDot: true });
      });
    }
  }

  private applyKnockbackImpulse(strength: number) {
    if (strength <= 0) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.monster.x, this.monster.y, this.player.x, this.player.y);
    const velocity = this.physics.velocityFromRotation(angle, strength);
    body.setVelocity(velocity.x, velocity.y);
    this.playerKnockbackUntil = this.time.now + 220;
  }

  private applyMonsterImpact(impact: TelegraphImpact) {
    if (impact.damage > 0) {
      this.damagePlayer(impact.damage, { shake: impact.screenShake });
    } else if (impact.screenShake) {
      this.cameras.main.shake(impact.screenShake.duration, impact.screenShake.intensity);
    }

    if (impact.knockback) {
      this.applyKnockback(impact.knockback);
    }

    if (impact.slowDuration && impact.slowMultiplier) {
      this.applyPlayerSlow(impact.slowDuration, impact.slowMultiplier);
    }
  }

  private applyPlayerSlow(duration: number, multiplier: number) {
    const now = this.time.now;
    const until = now + duration;
    this.playerSlowUntil = Math.max(this.playerSlowUntil, until);
    this.playerSlowFactor = Math.min(this.playerSlowFactor, multiplier);
  }

  private applyKnockback(strength: number) {
    if (strength <= 0) return;
    this.queueAfterHitstop(() => this.applyKnockbackImpulse(strength));
  }

  speedBoost(ms: number) {
    const now = this.time.now;
    const boostMultiplier = 360 / 260;
    this.playerSpeedBoostUntil = Math.max(this.playerSpeedBoostUntil, now + ms);
    this.playerSpeedBoostMultiplier = Math.max(this.playerSpeedBoostMultiplier, boostMultiplier);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.maxSpeed = 260 * this.playerSpeedBoostMultiplier;
    this.spawnFloatingEmoji(this.player.x, this.player.y - 40, '⚡', 24, 0xe8ff9e, ms);
  }

  afterDelay(ms:number, fn:()=>void) { this.time.delayedCall(ms, fn); }

  private resetPlayerState() {
    this.hp = PLAYER_BASE.hp;
    this.playerIFrameUntil = 0;
    this.playerSlowUntil = 0;
    this.playerSlowFactor = 1;
    this.playerSpeedBoostUntil = 0;
    this.playerSpeedBoostMultiplier = 1;
    this.playerKnockbackUntil = 0;
    this.playerShoveCooldownUntil = 0;
    this.overItem = null;
    if (this.hitstopActive) {
      this.endHitstop(true);
    } else {
      this.hitstopUntil = 0;
      this.pendingPostHitstop.length = 0;
      const playerBody = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
      const monsterBody = this.monster?.body as Phaser.Physics.Arcade.Body | undefined;
      if (playerBody) playerBody.moves = true;
      if (monsterBody) monsterBody.moves = true;
    }
    if (this.playerBlinkEvent) {
      this.playerBlinkEvent.destroy();
      this.playerBlinkEvent = undefined;
    }
    this.player?.setAlpha(1);
    this.inputSystem?.reset();
    const playerBody = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
    if (playerBody) {
      playerBody.maxSpeed = 260;
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

  private async handleDoorOpened(door: DoorDefinition) {
    this.events.emit('door-opened', door);
    if (this.runEnded || this.transitioningRoom) {
      return;
    }

    this.transitioningRoom = true;
    this.searchSystem.endSearch();
    this.overItem = null;
    this.inputSystem.reset();

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (playerBody) {
      playerBody.setVelocity(0, 0);
    }

    this.spawnerSystem?.destroy();
    this.monster?.destroy();
    this.monsterFurnitureCollider?.destroy();
    this.monsterFurnitureCollider = undefined;

    const nextRoom = await this.roomLoader.transitionTo(door.target);
    this.roomState = nextRoom;

    const { width: roomWidth, height: roomHeight } = this.roomState.size;
    this.player.setPosition(roomWidth / 2, roomHeight / 2);
    if (playerBody) {
      playerBody.reset(this.player.x, this.player.y);
    }

    this.spawnMonsterForCurrentRoom();
    this.telegraphSystem = new TelegraphSystem(
      this,
      this.player,
      this.monster,
      this.inputSystem,
      this.fxDepth,
      this.spawnEmojiFn,
      () => this.handleRunEnd('victory'),
      (event) => this.handleMonsterDamaged(event),
    );

    this.setupSpawnerForCurrentRoom();
    this.refreshHUD();
    this.transitioningRoom = false;
  }

  private refreshHUD() {
    const now = this.time.now;
    const shoveRemaining = Math.max(this.playerShoveCooldownUntil - now, 0);
    drawHUD(this.hud, this.hp, PLAYER_BASE.hp, this.inventorySystem.getInventory(), {
      shoveCooldown: {
        remainingMs: shoveRemaining,
        durationMs: this.playerShoveCooldown,
      },
    });
  }

  update(time: number, delta: number) {
    this.doorSystem?.update();
    if (this.runEnded || this.transitioningRoom) {
      return;
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const now = this.time.now;
    if (this.hitstopActive && now >= this.hitstopUntil) {
      this.endHitstop();
    }

    if (now >= this.playerSpeedBoostUntil && this.playerSpeedBoostMultiplier !== 1) {
      this.playerSpeedBoostMultiplier = 1;
      body.maxSpeed = 260;
    }
    if (now >= this.playerSlowUntil && this.playerSlowFactor !== 1) {
      this.playerSlowFactor = 1;
    }
    let speedMultiplier = this.playerSpeedBoostMultiplier;
    if (now < this.playerSlowUntil) {
      speedMultiplier *= this.playerSlowFactor;
    }
    const baseSpeed = 260 * speedMultiplier;
    const hitstopActive = this.hitstopActive;
    const speed = hitstopActive ? 0 : baseSpeed;
    const knockbackActive = now < this.playerKnockbackUntil;

    const inputResult = this.inputSystem.update(this.player, {
      speed,
      searching: this.searchSystem.isSearching(),
      knockbackActive: knockbackActive || hitstopActive,
    });

    if (this.overItem && (!this.overItem.active || !this.physics.overlap(this.player, this.overItem as any))) {
      this.overItem = null;
    }

    this.searchSystem.settleFurnitureAfterMonsterPush(now);
    this.searchSystem.updateFurnitureVisuals();
    this.searchSystem.updateSearch(delta, this.player);

    if (!hitstopActive) {
      this.monster.update(delta / 1000, this.player);
    }
    this.playerIFrameUntil = this.telegraphSystem.resolveTelegraphCollisions(
      now,
      this.playerIFrameUntil,
      (impact) => this.applyMonsterImpact(impact),
    );

    const playerAnim = `player-${inputResult.moving ? 'walk' : 'idle'}-${inputResult.facing}` as const;
    this.player.anims.play(playerAnim, true);

    this.refreshHUD();
    this.searchSystem.updateFurnitureIndicators(this.player);
  }

  private createAnimations() {
    const ensureAnimation = (key: string, config: Phaser.Types.Animations.Animation) => {
      if (!this.anims.exists(key)) this.anims.create(config);
    };

    const playerDirections: Record<'up' | 'down' | 'left' | 'right', number> = {
      down: 0,
      up: 1,
      right: 3,
      left: 2,
    };

    Object.entries(playerDirections).forEach(([dir, row]) => {
      const base = row * 4;
      ensureAnimation(`player-idle-${dir}`, {
        key: `player-idle-${dir}`,
        frames: [{ key: 'player', frame: base }],
        frameRate: 1,
        repeat: -1,
      });
      const walkFrames = this.anims
        .generateFrameNumbers('player', { start: base, end: base + 3 })
        .slice();
      const adjustedWalkFrames = dir === 'up' || dir === 'down' ? walkFrames.reverse() : walkFrames;
      ensureAnimation(`player-walk-${dir}`, {
        key: `player-walk-${dir}`,
        frames: adjustedWalkFrames,
        frameRate: 10,
        repeat: -1,
      });
    });

    Object.values(MONSTER_SPRITES).forEach((sprite) => {
      const { keyPrefix, framesPerDirection, directions } = sprite.animations;
      const idleFrameRate = sprite.frameRates?.idle ?? 1;
      const walkFrameRate = sprite.frameRates?.walk ?? 7;

      Object.entries(directions).forEach(([dir, row]) => {
        const base = row * framesPerDirection;
        ensureAnimation(`${keyPrefix}-idle-${dir}`, {
          key: `${keyPrefix}-idle-${dir}`,
          frames: [{ key: sprite.textureKey, frame: base }],
          frameRate: idleFrameRate,
          repeat: -1,
        });
        ensureAnimation(`${keyPrefix}-walk-${dir}`, {
          key: `${keyPrefix}-walk-${dir}`,
          frames: this.anims.generateFrameNumbers(sprite.textureKey, {
            start: base,
            end: base + framesPerDirection - 1,
          }),
          frameRate: walkFrameRate,
          repeat: -1,
        });
      });
    });
  }
}

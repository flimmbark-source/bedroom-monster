import Phaser from 'phaser';
import { ROOM_W, ROOM_H, PLAYER_BASE } from '@game/config';
import type { Inventory, Item } from '@game/types';
import { cloneItem, ITEM_TEXTURE_PATHS } from '@game/items';
import { craft } from '@game/recipes';
import { Monster, type TelegraphHitCandidate, type TelegraphImpact } from '@game/monster';
import { createHUD, drawHUD, type HudElements } from '@ui/hud';

interface GroundItem extends Phaser.GameObjects.Image {
  itemId: Item['id'];
  label: Phaser.GameObjects.Text;
}

type SearchCheckpoint = { value: number; triggered: boolean };

type FurnitureSpriteOptions = {
  frame: string;
  offsetX?: number;
  offsetY?: number;
  depth?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
  flipY?: boolean;
};

type FurnitureHitboxOptions = {
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  units?: 'frame' | 'world';
};

type FurnitureOptions = {
  searchable?: boolean;
  name?: string;
  searchDuration?: number;
  checkPoints?: number[];
  lootTable?: Item['id'][];
  findChance?: number;
  emoji?: string;
  sprite?: FurnitureSpriteOptions;
  hitbox?: FurnitureHitboxOptions;
};

type SearchableFurniture = {
  name: string;
  rect: Phaser.GameObjects.Rectangle;
  searchDuration: number;
  checkPoints: number[];
  lootTable: Item['id'][];
  findChance: number;
  emoji: string;
  emojiLabel: Phaser.GameObjects.Text;
  labelOffsetY: number;
};

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
  private restockPoints = [
    { x: 420, y: 360 },
    { x: 860, y: 360 },
    { x: 640, y: 440 },
    { x: 260, y: 520 },
    { x: 1020, y: 520 },
    { x: 960, y: 620 },
  ];
  private restockPool: Item['id'][] = ['knife', 'bottle', 'soda', 'match', 'bandaid', 'yoyo'];
  private furniture: SearchableFurniture[] = [];
  private furnitureGroup!: Phaser.Physics.Arcade.Group;
  private searching = false;
  private activeFurniture: SearchableFurniture | null = null;
  private searchElapsed = 0;
  private searchDuration = 0;
  private searchBar?: Phaser.GameObjects.Graphics;
  private searchCheckpoints: SearchCheckpoint[] = [];
  private playerFacing: 'up' | 'down' | 'left' | 'right' = 'down';
  private playerIFrameUntil = 0;
  private playerSlowUntil = 0;
  private playerSlowFactor = 1;
  private playerSpeedBoostUntil = 0;
  private playerSpeedBoostMultiplier = 1;
  private playerKnockbackUntil = 0;
  constructor() { super('Play'); }

  preload() {
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 102,
      frameHeight: 152,
    });
    this.load.spritesheet('monster', 'assets/sprites/monster.png', {
      frameWidth: 184,
      frameHeight: 275,
    });

    this.load.atlas('furniture', 'assets/sprites/furniture.png', 'assets/sprites/furniture.json');

    Object.entries(ITEM_TEXTURE_PATHS).forEach(([key, path]) => {
      this.load.image(key, path);
    });

  }

  create() {
    this.resetPlayerState();
    this.createAnimations();

    this.furniture = [];
    this.searching = false;
    this.activeFurniture = null;
    this.searchElapsed = 0;
    this.searchDuration = 0;
    this.searchCheckpoints = [];

    this.physics.world.setBounds(0, 0, ROOM_W, ROOM_H);

    // room bg
    this.add.rectangle(ROOM_W/2, ROOM_H/2, ROOM_W, ROOM_H, 0x161a22).setStrokeStyle(2, 0x2a3242);

    // furniture (blocking)

    this.furnitureGroup = this.physics.add.group({ allowGravity: false });
    const furniture = this.furnitureGroup;
    this.addFurnitureBlock(furniture, 640, 230, {
      searchable: true,
      name: 'Bed',
      searchDuration: 2600,
      checkPoints: [0.85, 0.55, 0.25],
      findChance: 0.5,
      emoji: '🛏️',
      sprite: {
        frame: 'bed',
        offsetY: -20,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        width: 213,
        height: 273,
        offsetX: -1.5,
        offsetY: 0,
      },
    });
    this.addFurnitureBlock(furniture, 480, 360, {
      searchable: true,
      name: 'Nightstand',
      searchDuration: 2000,
      checkPoints: [0.7, 0.35],
      findChance: 0.6,
      emoji: '🛋️',
      sprite: {
        frame: 'dresser',
        offsetY: -40,
        depth: 2,
        scale: 0.65,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    });
    this.addFurnitureBlock(furniture, 800, 360, {
      searchable: true,
      name: 'Nightstand',
      searchDuration: 2000,
      checkPoints: [0.7, 0.35],
      findChance: 0.6,
      emoji: '🛋️',
      sprite: {
        frame: 'dresser',
        offsetY: -40,
        depth: 2,
        scale: 0.65,
        flipX: true,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    });
    this.addFurnitureBlock(furniture, 1060, 280, {
      searchable: true,
      name: 'Desk',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🪑',
      sprite: {
        frame: 'desk',
        offsetY: -30,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        width: 204,
        height: 123,
        offsetX: 1.5,
      },
    });
    this.addFurnitureBlock(furniture, 280, 560, {
      searchable: true,
      name: 'Dresser',
      searchDuration: 2400,
      checkPoints: [0.7, 0.35],
      findChance: 0.55,
      emoji: '🧺',
      sprite: {
        frame: 'dresser',
        offsetY: -50,
        depth: 2,
        scale: 0.85,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    });
    this.addFurnitureBlock(furniture, 960, 580, {
      searchable: true,
      name: 'Vanity',
      searchDuration: 2100,
      checkPoints: [0.8, 0.45],
      findChance: 0.58,
      emoji: '💄',
      sprite: {
        frame: 'desk',
        offsetY: -30,
        depth: 2,
        scale: 0.8,
        flipX: true,
      },
      hitbox: {
        width: 204,
        height: 123,
        offsetX: 1.5,
      },
    });
    // player
    this.player = this.physics.add.sprite(200, 200, 'player', 8);
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
    this.physics.add.collider(
      this.player,
      furniture,
      this.handlePlayerFurnitureCollision,
      undefined,
      this,
    );
    this.physics.add.collider(furniture, furniture);

    // monster
    this.monster = new Monster(this, 900, 700);
    this.monster.setDepth(10);
    this.physics.add.collider(
      this.monster,
      furniture,
      this.handleMonsterFurnitureCollision,
      undefined,
      this,
    );
    this.physics.add.overlap(this.monster, this.player, () => {
      if (this.time.now < this.playerIFrameUntil) return;
      // contact damage once per second (simple throttle)
      if (!(this.player as any)._lastHit || this.time.now - (this.player as any)._lastHit > 1000) {
        (this.player as any)._lastHit = this.time.now;
        this.damagePlayer(1);
        this.playerIFrameUntil = this.time.now + 150;
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
    // starter items
    this.createGroundItem(420, 360, 'knife');
    this.createGroundItem(860, 360, 'bottle');
    this.createGroundItem(640, 440, 'soda');
    this.createGroundItem(260, 520, 'match');
    this.createGroundItem(1020, 520, 'bandaid');
    this.createGroundItem(960, 620, 'yoyo');

    this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => this.restockFurniture(),
    });

    this.physics.add.overlap(this.player, this.itemsGroup, (_, obj:any) => {
      (this as any)._overItem = obj as GroundItem;
    });

    // player hit listener
    this.player.on('hit', (e: any) => this.damagePlayer(e.dmg||1));

    // HUD
    this.hud = createHUD(this, 5);

    if (this.searchBar) {
      this.searchBar.destroy();
    }
    this.searchBar = this.add.graphics();
    this.searchBar.setDepth(this.fxDepth + 10);
    this.searchBar.setVisible(false);
  }

  private addFurnitureBlock(
    blocks: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    options: FurnitureOptions = {}
  ) {
    const spriteOptions = options.sprite;
    const { width, height, offsetX, offsetY } = this.resolveFurnitureHitbox(
      spriteOptions,
      options.hitbox
    );

    const rectX = x + (spriteOptions?.offsetX ?? 0) + offsetX;
    const rectY = y + (spriteOptions?.offsetY ?? 0) + offsetY;

    const rect = this.add
      .rectangle(rectX, rectY, width, height, 0x222831)
      .setStrokeStyle(1, 0x3a4152);
    rect.setVisible(false);
    rect.setFillStyle(0x222831, 0);
    rect.setStrokeStyle(0);
    this.physics.add.existing(rect);
    rect.setDataEnabled();
    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(false);
    body.setMass(4);
    body.setDamping(true);
    body.setDrag(1600, 1600);
    body.setMaxSpeed(45);
    body.setCollideWorldBounds(true);
    blocks.add(rect as any);

    let sprite: Phaser.GameObjects.Image | undefined;
    let spriteOffsetX = 0;
    let spriteOffsetY = 0;

    if (spriteOptions) {
      const {
        frame,
        offsetX = 0,
        offsetY = 0,
        depth = 3,
        scale,
        scaleX,
        scaleY,
        flipX = false,
        flipY = false,
      } = spriteOptions;
      sprite = this.add.image(x + offsetX, y + offsetY, 'furniture', frame);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(depth);
      sprite.setFlip(flipX, flipY);
      if (typeof scale === 'number') {
        sprite.setScale(scale);
      } else {
        const sx = scaleX ?? 1;
        const sy = scaleY ?? scaleX ?? 1;
        sprite.setScale(sx, sy);
      }
      spriteOffsetX = sprite.x - rectX;
      spriteOffsetY = sprite.y - rectY;
    }

    rect.setData('spriteRef', sprite ?? null);
    rect.setData('spriteOffsetX', spriteOffsetX);
    rect.setData('spriteOffsetY', spriteOffsetY);

    if (!options.searchable) return;

    const checkpoints = [...(options.checkPoints ?? [0.8, 0.5, 0.2])]
      .filter((v) => v > 0 && v < 1)
      .sort((a, b) => b - a);

    const name = options.name ?? 'Furniture';
    const emoji = options.emoji ?? this.getFurnitureEmoji(name);
    const labelY = rectY - height / 2 - 10;
    const emojiLabel = this.add
      .text(rectX, labelY, emoji, {
        fontFamily: 'monospace',
        fontSize: '20px',
      })
      .setOrigin(0.5, 1)
      .setDepth(6)
      .setAlpha(0.3);
    emojiLabel.setShadow(0, 2, '#000000', 6, true, true);

    this.furniture.push({
      name,
      rect,
      searchDuration: options.searchDuration ?? 2400,
      checkPoints: checkpoints,
      lootTable: options.lootTable ?? this.restockPool,
      findChance: options.findChance ?? 0.5,
      emoji,
      emojiLabel,
      labelOffsetY: labelY - rectY,
    });
  }

  private resolveFurnitureHitbox(
    spriteOptions: FurnitureSpriteOptions | undefined,
    hitbox: FurnitureHitboxOptions | undefined
  ) {
    const { scaleX, scaleY } = this.getFurnitureScale(spriteOptions);
    const texture = spriteOptions?.frame ? this.textures.get('furniture') : null;
    const frame =
      spriteOptions?.frame && texture?.has(spriteOptions.frame)
        ? texture.get(spriteOptions.frame)
        : null;

    const fallbackFrameWidth = frame?.width ?? 64;
    const fallbackFrameHeight = frame?.height ?? 64;
    const units = hitbox?.units ?? 'frame';

    const widthValue =
      units === 'world'
        ? hitbox?.width ?? fallbackFrameWidth * scaleX
        : (hitbox?.width ?? fallbackFrameWidth) * scaleX;
    const heightValue =
      units === 'world'
        ? hitbox?.height ?? fallbackFrameHeight * scaleY
        : (hitbox?.height ?? fallbackFrameHeight) * scaleY;

    let offsetXValue =
      units === 'world'
        ? hitbox?.offsetX ?? 0
        : (hitbox?.offsetX ?? 0) * scaleX;
    let offsetYValue =
      units === 'world'
        ? hitbox?.offsetY ?? 0
        : (hitbox?.offsetY ?? 0) * scaleY;

    if (spriteOptions?.flipX) offsetXValue *= -1;
    if (spriteOptions?.flipY) offsetYValue *= -1;

    const width = Math.max(1, Math.abs(widthValue));
    const height = Math.max(1, Math.abs(heightValue));

    return {
      width,
      height,
      offsetX: offsetXValue,
      offsetY: offsetYValue,
    };
  }

  private handlePlayerFurnitureCollision(
    playerObj: Phaser.GameObjects.GameObject,
    furnitureObj: Phaser.GameObjects.GameObject,
  ) {
    const furnitureBody = (furnitureObj.body as Phaser.Physics.Arcade.Body) ?? null;
    const playerBody = (playerObj.body as Phaser.Physics.Arcade.Body) ?? null;
    if (!furnitureBody || !playerBody) return;

    this.applyFurniturePush(furnitureBody, playerBody);
  }

  private handleMonsterFurnitureCollision(
    monsterObj: Phaser.GameObjects.GameObject,
    furnitureObj: Phaser.GameObjects.GameObject,
  ) {
    const rect = furnitureObj as Phaser.GameObjects.Rectangle;
    const furnitureBody = rect.body as Phaser.Physics.Arcade.Body | undefined;
    const monster = monsterObj as Monster;
    const monsterBody = monster.body as Phaser.Physics.Arcade.Body | undefined;
    if (!furnitureBody || !monsterBody) return;

    const isBeingPushed = this.applyFurniturePush(furnitureBody, monsterBody);
    if (isBeingPushed) {
      monster.applyPushSlow(0.3);
    }
  }

  private applyFurniturePush(
    furnitureBody: Phaser.Physics.Arcade.Body,
    sourceBody: Phaser.Physics.Arcade.Body,
  ) {
    const pushVector = new Phaser.Math.Vector2(sourceBody.velocity.x, sourceBody.velocity.y);
    if (pushVector.lengthSq() < 100) {
      furnitureBody.setVelocity(0, 0);
      return false;
    }

    pushVector.normalize().scale(35);

    furnitureBody.velocity.x = Phaser.Math.Linear(furnitureBody.velocity.x, pushVector.x, 0.18);
    furnitureBody.velocity.y = Phaser.Math.Linear(furnitureBody.velocity.y, pushVector.y, 0.18);

    return true;
  }

  private getFurnitureScale(spriteOptions: FurnitureSpriteOptions | undefined) {
    const baseScale =
      typeof spriteOptions?.scale === 'number' ? spriteOptions.scale : 1;
    const scaleX = Math.abs(
      typeof spriteOptions?.scaleX === 'number'
        ? spriteOptions.scaleX
        : baseScale
    );
    const scaleY = Math.abs(
      typeof spriteOptions?.scaleY === 'number'
        ? spriteOptions.scaleY
        : baseScale
    );

    return { scaleX, scaleY };
  }

  private getFurnitureEmoji(name: string) {
    const key = name.trim().toLowerCase();
    switch (key) {
      case 'bed':
        return '🛏️';
      case 'desk':
        return '🪑';
      case 'dresser':
        return '🧺';
      case 'nightstand':
        return '🛋️';
      case 'vanity':
        return '💄';
      default:
        return '🔎';
    }
  }

  tryPickup(): boolean {
    const obj: GroundItem | null = (this as any)._overItem || null; if (!obj) return false;
    const id = obj.itemId as Item['id'];
    // find slot
    const idx = this.inv[0]? (this.inv[1]? -1 : 1) : 0;
    if (idx === -1) {
      // swap with slot 0 by default
      const dropped = this.inv[0]!;
      this.inv[0] = { ...cloneItem(id) };
      obj.itemId = dropped.id; // leave the dropped one on ground
      obj.setTexture(dropped.icon);
      obj.label.setText(dropped.label);
    } else {
      this.inv[idx] = { ...cloneItem(id) };
      obj.label.destroy();
      obj.destroy();
      (this as any)._overItem = null;
    }
    return true;
  }

  private hasEmptyInventorySlot() {
    return this.inv.some((slot) => slot === null);
  }

  private giveItemToInventory(id: Item['id']) {
    const idx = this.inv.findIndex((slot) => slot === null);
    if (idx === -1) return false;
    this.inv[idx] = cloneItem(id);
    return true;
  }

  drop(slot: 0|1) {
    const it = this.inv[slot]; if (!it) return;
    this.inv[slot] = null;
    this.createGroundItem(this.player.x + 14, this.player.y + 14, it.id);
  }

  private tryStartSearch() {
    if (this.searching) return;
    const furniture = this.getNearbyFurniture();
    if (!furniture) return;
    if (!this.hasEmptyInventorySlot()) {
      this.spawnFloatingEmoji(this.player.x, this.player.y - 44, '📦', 20, 0xff8383, 420);
      return;
    }
    this.beginSearch(furniture);
  }

  private getNearbyFurniture() {
    const maxDistance = 64;
    let closest: SearchableFurniture | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const furniture of this.furniture) {
      if (!furniture.rect.active) continue;
      const dist = this.distanceToRectangle(this.player.x, this.player.y, furniture.rect);
      if (dist <= maxDistance && dist < bestDistance) {
        bestDistance = dist;
        closest = furniture;
      }
    }
    return closest;
  }

  private distanceToRectangle(px: number, py: number, rect: Phaser.GameObjects.Rectangle) {
    const bounds = rect.getBounds();
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;
    const dx = Math.max(Math.abs(px - bounds.centerX) - halfW, 0);
    const dy = Math.max(Math.abs(py - bounds.centerY) - halfH, 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private beginSearch(furniture: SearchableFurniture) {
    this.searching = true;
    this.activeFurniture = furniture;
    this.searchElapsed = 0;
    this.searchDuration = furniture.searchDuration;
    this.searchCheckpoints = (furniture.checkPoints.length > 0
      ? furniture.checkPoints
      : [0.5])
      .slice()
      .sort((a, b) => b - a)
      .map((value) => ({ value, triggered: false }));
    this.drawSearchBar(1);
    this.searchBar?.setVisible(true);
    this.spawnFloatingEmoji(this.player.x, this.player.y - 48, '🔍', 22, 0xfff3a5, 520);
  }

  private updateSearch(delta: number) {
    if (!this.searching || !this.activeFurniture) return;
    if (!this.hasEmptyInventorySlot()) {
      this.endSearch();
      return;
    }

    this.searchElapsed += delta;
    const remaining = Math.max(this.searchDuration - this.searchElapsed, 0);
    const progress = this.searchDuration > 0 ? remaining / this.searchDuration : 0;

    for (const checkpoint of this.searchCheckpoints) {
      if (!checkpoint.triggered && progress <= checkpoint.value) {
        checkpoint.triggered = true;
        this.tryAwardSearchLoot();
        if (!this.searching) return;
      }
    }

    this.drawSearchBar(progress);

    if (remaining <= 0) {
      this.endSearch();
    }
  }

  private drawSearchBar(progress: number) {
    if (!this.searchBar) return;
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    const width = 96;
    const height = 14;
    const innerWidth = width - 6;
    const innerHeight = height - 6;

    this.searchBar.clear();
    this.searchBar.setPosition(this.player.x, this.player.y - 58);
    this.searchBar.fillStyle(0x101621, 0.75);
    this.searchBar.fillRoundedRect(-width / 2, -height / 2, width, height, 6);

    if (clamped > 0) {
      this.searchBar.fillStyle(0x5daeff, 0.95);
      this.searchBar.fillRect(-innerWidth / 2, -innerHeight / 2, innerWidth * clamped, innerHeight);
    }

    this.searchBar.lineStyle(1, 0xffffff, 0.85);
    this.searchBar.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);

    for (const checkpoint of this.searchCheckpoints) {
      const markerX = Phaser.Math.Clamp(checkpoint.value, 0, 1) * width - width / 2;
      const color = checkpoint.triggered ? 0x7effa5 : 0xffffff;
      this.searchBar.lineStyle(1.5, color, 0.9);
      this.searchBar.beginPath();
      this.searchBar.moveTo(markerX, -height / 2 - 2);
      this.searchBar.lineTo(markerX, height / 2 + 2);
      this.searchBar.strokePath();
    }

    this.searchBar.setVisible(true);
  }

  private updateFurnitureVisuals() {
    if (!this.furnitureGroup) return;
    this.furnitureGroup.children.each((child) => {
      const rect = child as Phaser.GameObjects.Rectangle;
      const sprite = rect.getData('spriteRef') as Phaser.GameObjects.Image | null;
      if (sprite) {
        const offsetX = (rect.getData('spriteOffsetX') as number) ?? 0;
        const offsetY = (rect.getData('spriteOffsetY') as number) ?? 0;
        sprite.setPosition(rect.x + offsetX, rect.y + offsetY);
      }
    });
  }

  private updateFurnitureIndicators() {
    for (const furniture of this.furniture) {
      if (!furniture.emojiLabel.active) continue;

      furniture.emojiLabel.setPosition(
        furniture.rect.x,
        furniture.rect.y + furniture.labelOffsetY,
      );

      const dist = this.distanceToRectangle(this.player.x, this.player.y, furniture.rect);
      const isActive = this.activeFurniture === furniture && this.searching;
      const hasInventorySpace = this.hasEmptyInventorySlot();
      const nearby = dist <= 96;
      const close = dist <= 56;

      const targetAlpha = isActive ? 1 : close ? 0.95 : nearby ? 0.6 : 0.25;
      furniture.emojiLabel.setAlpha(targetAlpha);

      const targetScale = isActive ? 1.15 : close ? 1 : 0.9;
      furniture.emojiLabel.setScale(targetScale);

      if (hasInventorySpace) {
        furniture.emojiLabel.setTint(0xffffff);
      } else {
        furniture.emojiLabel.setTint(0xff8383);
      }

      const text = isActive ? `🔎${furniture.emoji}` : furniture.emoji;
      if (furniture.emojiLabel.text !== text) {
        furniture.emojiLabel.setText(text);
      }
    }
  }

  private tryAwardSearchLoot() {
    if (!this.activeFurniture || !this.hasEmptyInventorySlot()) {
      this.endSearch();
      return;
    }

    if (Phaser.Math.FloatBetween(0, 1) > this.activeFurniture.findChance) return;

    const itemId = Phaser.Utils.Array.GetRandom(this.activeFurniture.lootTable);
    if (!itemId) return;

    if (this.giveItemToInventory(itemId)) {
      this.spawnFloatingEmoji(this.player.x, this.player.y - 52, '✨', 24, 0xfff7c5, 560);
      if (!this.hasEmptyInventorySlot()) {
        this.endSearch();
      }
    }
  }

  private endSearch() {
    this.searching = false;
    this.activeFurniture = null;
    this.searchElapsed = 0;
    this.searchDuration = 0;
    this.searchCheckpoints = [];
    if (this.searchBar) {
      this.searchBar.clear();
      this.searchBar.setVisible(false);
    }
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
    if (!this.inv[slot]) { this.inv[slot] = cloneItem('bottle'); return; }
    // try other slot
    const other = slot === 0 ? 1 : 0;
    if (!this.inv[other]) { this.inv[other] = cloneItem('bottle'); return; }
    // drop
    this.createGroundItem(this.player.x + 8, this.player.y + 8, 'bottle');
  }

  private createGroundItem(x: number, y: number, id: Item['id']) {
    const template = cloneItem(id);
    const sprite = this.add.image(x, y, template.icon) as GroundItem;
    sprite.setDisplaySize(28, 28);
    sprite.setDepth(6);
    sprite.itemId = template.id;

    const label = this.add
      .text(x, y - 18, template.label, { fontSize: '10px' })
      .setOrigin(0.5, 1);
    label.setDepth(6);
    sprite.label = label;
    sprite.on('destroy', () => {
      if (label.active) {
        label.destroy();
      }
    });

    this.physics.add.existing(sprite, true);
    this.configureItemBody(sprite);
    this.itemsGroup.add(sprite);
    return sprite;
  }

  private configureItemBody(item: GroundItem) {
    const body = item.body as Phaser.Physics.Arcade.StaticBody;
    const width = item.displayWidth * 0.8;
    const height = item.displayHeight * 0.8;
    body.setSize(width, height).setOffset(-width / 2, -height / 2);
    body.updateFromGameObject();
  }

  private restockFurniture() {
    const items = this.itemsGroup.getChildren().filter((child) => child.active) as GroundItem[];
    if (items.length >= 4) return;

    const needed = Math.min(4 - items.length, this.restockPoints.length);
    const availablePoints = this.restockPoints.filter((point) =>
      !items.some((item) => Phaser.Math.Distance.Between(item.x, item.y, point.x, point.y) < 18)
    );

    for (let i = 0; i < needed && availablePoints.length > 0; i += 1) {
      const index = Phaser.Math.Between(0, availablePoints.length - 1);
      const point = availablePoints.splice(index, 1)[0];
      const itemId = Phaser.Utils.Array.GetRandom(this.restockPool);
      this.createGroundItem(point.x, point.y, itemId);
    }
  }

  damagePlayer(n: number, options: { shake?: { duration: number; intensity: number } } = {}) {
    if (n <= 0) return;
    const shake = options.shake ?? { duration: 80, intensity: 0.004 };
    if (shake) {
      this.cameras.main.shake(shake.duration, shake.intensity);
    }
    this.hp -= n;
    if (this.hp <= 0) {
      this.resetPlayerState();
      this.scene.restart();
    }
  }

  private resolveTelegraphCollisions() {
    if (!this.player || !this.monster) return;
    const candidates = this.monster.getTelegraphHitCandidates(this.player);
    if (!candidates.length) return;

    const priority: Record<TelegraphHitCandidate['priority'], number> = {
      rush: 3,
      smash: 2,
      sweep: 1,
      roar: 0,
    };

    candidates.sort((a, b) => priority[b.priority] - priority[a.priority]);

    const now = this.time.now;
    if (now >= this.playerIFrameUntil) {
      this.applyMonsterImpact(candidates[0].impact);
      this.playerIFrameUntil = now + 150;
    }

    this.monster.resolveTelegraphHits(candidates.map((candidate) => candidate.id));
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
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.monster.x, this.monster.y, this.player.x, this.player.y);
    const velocity = this.physics.velocityFromRotation(angle, strength);
    body.setVelocity(velocity.x, velocity.y);
    this.playerKnockbackUntil = this.time.now + 160;
  }

  hitMonster(n: number, emoji: string = '💥') {
    this.monster.hp -= n;
    this.monster.refreshHpBar();
    this.monster.setTint(0xffdddd); this.time.delayedCall(80, () => this.monster.clearTint());
    this.spawnFloatingEmoji(this.monster.x, this.monster.y - 30, emoji, 26, 0xfff4d3);
    if (this.monster.hp <= 0) {
      this.resetPlayerState();
      this.scene.restart();
    }
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
    this.playerFacing = 'down';
    this.playerIFrameUntil = 0;
    this.playerSlowUntil = 0;
    this.playerSlowFactor = 1;
    this.playerSpeedBoostUntil = 0;
    this.playerSpeedBoostMultiplier = 1;
    this.playerKnockbackUntil = 0;
    if (this.player?.body) {
      (this.player.body as Phaser.Physics.Arcade.Body).maxSpeed = 260;
    }
  }

  private showMeleeTelegraph(range: number, color: number, emoji: string, duration = 300) {
    const spread = Phaser.Math.DegToRad(120);
    const gfx = this.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.85).setScale(0.45);
    gfx.fillStyle(color, 0.22);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, range, -spread / 2, spread / 2, false);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(3, color, 0.95);
    gfx.beginPath();
    gfx.arc(0, 0, range, -spread / 2, spread / 2, false);
    gfx.strokePath();

    const icon = this.add.text(this.player.x, this.player.y, emoji, { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.95)
      .setScale(0.9);

    const updatePositions = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range * 0.92;
      const tipY = this.player.y + Math.sin(angle) * range * 0.92;
      if (icon.active) icon.setPosition(tipX, tipY - 18);
    };

    updatePositions();

    this.tweens.add({
      targets: gfx,
      scale: { from: 0.45, to: 1 },
      alpha: { from: 0.85, to: 0 },
      ease: 'Cubic.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => gfx.destroy(),
    });

    this.tweens.add({
      targets: icon,
      alpha: { from: 0.95, to: 0 },
      scale: { from: 0.9, to: 1.3 },
      ease: 'Sine.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => icon.destroy(),
    });
  }


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
    const now = this.time.now;
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
    const speed = 260 * speedMultiplier;
    const knockbackActive = now < this.playerKnockbackUntil;
    if (knockbackActive) {
      body.velocity.scale(0.9);
    } else {
      body.setVelocity(0,0);
    }
    const attemptingMovement = !!(
      this.cursors.left?.isDown ||
      this.cursors.right?.isDown ||
      this.cursors.up?.isDown ||
      this.cursors.down?.isDown
    );

    if (this.searching && attemptingMovement) {
      this.endSearch();
    }
    if (!this.searching && !knockbackActive) {
      if (this.cursors.left?.isDown) body.setVelocityX(-speed);
      if (this.cursors.right?.isDown) body.setVelocityX(speed);
      if (this.cursors.up?.isDown) body.setVelocityY(-speed);
      if (this.cursors.down?.isDown) body.setVelocityY(speed);
    }

    const moving = body.deltaAbsX() > 0.5 || body.deltaAbsY() > 0.5;
    if (moving) {
      const absX = Math.abs(body.velocity.x);
      const absY = Math.abs(body.velocity.y);
      if (absX > absY) {
        this.playerFacing = body.velocity.x > 0 ? 'right' : 'left';
      } else if (absY > 0) {
        this.playerFacing = body.velocity.y > 0 ? 'down' : 'up';
      }
    } else if (attemptingMovement) {
      if (this.cursors.left?.isDown) this.playerFacing = 'left';
      else if (this.cursors.right?.isDown) this.playerFacing = 'right';
      else if (this.cursors.up?.isDown) this.playerFacing = 'up';
      else if (this.cursors.down?.isDown) this.playerFacing = 'down';
    }

    const playerAnim = `player-${moving ? 'walk' : 'idle'}-${this.playerFacing}` as const;
    this.player.anims.play(playerAnim, true);

    const overItem: GroundItem | null = (this as any)._overItem || null;
    if (overItem && (!overItem.active || !this.physics.overlap(this.player, overItem as any))) {
      (this as any)._overItem = null;
    }

    // interaction
    if (!this.searching) {
      if (Phaser.Input.Keyboard.JustDown(this.keyPick)) {
        const pickedUp = this.tryPickup();
        if (!pickedUp) this.tryStartSearch();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyDrop)) this.drop(0);
      if (Phaser.Input.Keyboard.JustDown(this.keyCraft)) this.craft();
    }

    this.updateFurnitureVisuals();
    this.updateSearch(delta);

    // monster update
    this.monster.update(delta/1000, this.player);
    this.resolveTelegraphCollisions();

    // HUD
    drawHUD(this.hud, this.hp, PLAYER_BASE.hp, this.inv);
    this.updateFurnitureIndicators();
  }

  private createAnimations() {
    const ensureAnimation = (key: string, config: Phaser.Types.Animations.Animation) => {
      if (!this.anims.exists(key)) this.anims.create(config);
    };

    const playerDirections: Record<'up' | 'down' | 'left' | 'right', number> = {
      up: 0,
      down: 1,
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
      ensureAnimation(`player-walk-${dir}`, {
        key: `player-walk-${dir}`,
        frames: this.anims.generateFrameNumbers('player', { start: base, end: base + 3 }),
        frameRate: 10,
        repeat: -1,
      });
    });

    const monsterDirections: Record<'up' | 'down' | 'left' | 'right', number> = {
      down: 0,
      left: 2,
      right: 1,
      up: 3,
    };

    Object.entries(monsterDirections).forEach(([dir, row]) => {
      const base = row * 4;
      ensureAnimation(`monster-idle-${dir}`, {
        key: `monster-idle-${dir}`,
        frames: [{ key: 'monster', frame: base }],
        frameRate: 1,
        repeat: -1,
      });
      ensureAnimation(`monster-walk-${dir}`, {
        key: `monster-walk-${dir}`,
        frames: this.anims.generateFrameNumbers('monster', { start: base, end: base + 3 }),
        frameRate: 7,
        repeat: -1,
      });
    });
  }
}

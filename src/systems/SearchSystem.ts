import Phaser from 'phaser';

import type { Item } from '@game/types';

import { InventorySystem } from './InventorySystem';

export type FurnitureSpriteOptions = {
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

export type FurnitureHitboxOptions = {
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  units?: 'frame' | 'world';
};

export type FurnitureOptions = {
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

export type FurnitureLayoutEntry = {
  x: number;
  y: number;
  options: FurnitureOptions;
};

export type SearchableFurniture = {
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

type SearchCheckpoint = { value: number; triggered: boolean };

export type SpawnEmojiFn = (
  x: number,
  y: number,
  emoji: string,
  fontSize?: number,
  tint?: number,
  duration?: number,
) => void;

export class SearchSystem {
  readonly furnitureGroup: Phaser.Physics.Arcade.Group;

  private furniture: SearchableFurniture[] = [];
  private searching = false;
  private activeFurniture: SearchableFurniture | null = null;
  private searchElapsed = 0;
  private searchDuration = 0;
  private searchBar: Phaser.GameObjects.Graphics;
  private searchCheckpoints: SearchCheckpoint[] = [];
  private readonly monsterFurnitureReleaseDelay = 60;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: InventorySystem,
    private readonly spawnFloatingEmoji: SpawnEmojiFn,
    private readonly fxDepth: number,
  ) {
    this.furnitureGroup = this.scene.physics.add.group({ allowGravity: false });
    this.searchBar = this.scene.add.graphics();
    this.searchBar.setDepth(this.fxDepth + 10);
    this.searchBar.setVisible(false);
  }

  reset() {
    this.furniture = [];
    this.searching = false;
    this.activeFurniture = null;
    this.searchElapsed = 0;
    this.searchDuration = 0;
    this.searchCheckpoints = [];
    this.searchBar.clear();
    this.searchBar.setVisible(false);
  }

  isSearching() {
    return this.searching;
  }

  addFurnitureBlock(x: number, y: number, options: FurnitureOptions = {}) {
    const spriteOptions = options.sprite;
    const { width, height, offsetX, offsetY } = this.resolveFurnitureHitbox(
      spriteOptions,
      options.hitbox,
    );

    const rectX = x + (spriteOptions?.offsetX ?? 0) + offsetX;
    const rectY = y + (spriteOptions?.offsetY ?? 0) + offsetY;

    const rect = this.scene.add
      .rectangle(rectX, rectY, width, height, 0x222831)
      .setStrokeStyle(1, 0x3a4152);
    rect.setVisible(false);
    rect.setFillStyle(0x222831, 0);
    rect.setStrokeStyle(0);
    this.scene.physics.add.existing(rect);
    rect.setDataEnabled();
    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(false);
    body.pushable = true;
    body.setMass(4);
    body.setDamping(true);
    body.setDrag(220, 220);
    body.setMaxSpeed(45);
    body.setCollideWorldBounds(true);
    this.furnitureGroup.add(rect as any);

    let sprite: Phaser.GameObjects.Image | undefined;
    let spriteOffsetX = 0;
    let spriteOffsetY = 0;

    if (spriteOptions) {
      const {
        frame,
        offsetX: spriteOffsetXValue = 0,
        offsetY: spriteOffsetYValue = 0,
        depth = 3,
        scale,
        scaleX,
        scaleY,
        flipX = false,
        flipY = false,
      } = spriteOptions;
      sprite = this.scene.add.image(x + spriteOffsetXValue, y + spriteOffsetYValue, 'furniture', frame);
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

    if (options.searchable) {
      const furnitureData: SearchableFurniture = {
        name: options.name ?? 'Furniture',
        rect,
        searchDuration: options.searchDuration ?? 2400,
        checkPoints: options.checkPoints ?? [0.5],
        lootTable: options.lootTable ?? ['bandaid', 'bottle', 'match'],
        findChance: options.findChance ?? 0.4,
        emoji: options.emoji ?? this.getFurnitureEmoji(options.name ?? ''),
        emojiLabel: this.scene.add
          .text(rect.x, rect.y - height / 2 - 12, options.emoji ?? this.getFurnitureEmoji(options.name ?? ''), {
            fontSize: '18px',
          })
          .setOrigin(0.5)
          .setDepth(this.fxDepth - 1),
        labelOffsetY: -(height / 2 + 12),
      };
      furnitureData.emojiLabel.setAlpha(0.25);
      this.furniture.push(furnitureData);
    }

    return rect;
  }

  loadFurnitureLayout(layout: FurnitureLayoutEntry[]) {
    layout.forEach(({ x, y, options }) => this.addFurnitureBlock(x, y, options));
  }

  handlePlayerFurnitureCollision = (
    playerObj: Phaser.GameObjects.GameObject,
    furnitureObj: Phaser.GameObjects.GameObject,
  ) => {
    const furnitureBody = (furnitureObj.body as Phaser.Physics.Arcade.Body) ?? null;
    const playerBody = (playerObj.body as Phaser.Physics.Arcade.Body) ?? null;
    if (!furnitureBody || !playerBody) return;
    const now = this.scene.time.now;
    const shoveActiveUntil = (furnitureObj.getData('playerShoveActiveUntil') as number) ?? 0;
    if (now >= shoveActiveUntil) {
      furnitureBody.setVelocity(0, 0);
    }

    const prevPlayerX = playerBody.prev?.x ?? playerBody.position.x;
    const prevPlayerY = playerBody.prev?.y ?? playerBody.position.y;
    playerBody.position.set(prevPlayerX, prevPlayerY);
    playerBody.prev.set(prevPlayerX, prevPlayerY);
    playerBody.setVelocity(0, 0);
  };

  handleMonsterFurnitureCollision = (
    monsterObj: Phaser.GameObjects.GameObject,
    furnitureObj: Phaser.GameObjects.GameObject,
  ) => {
    const rect = furnitureObj as Phaser.GameObjects.Rectangle;
    const furnitureBody = rect.body as Phaser.Physics.Arcade.Body | undefined;
    const monsterBody = (monsterObj.body as Phaser.Physics.Arcade.Body) ?? undefined;
    if (!furnitureBody || !monsterBody) return;
    rect.setData('lastMonsterContactAt', this.scene.time.now);
    const isBeingPushed = this.applyFurniturePush(
      furnitureBody,
      monsterBody,
      0.002,
      (monsterObj as any).getPushIntent?.(),
    );
    if (isBeingPushed && typeof (monsterObj as any).applyPushSlow === 'function') {
      (monsterObj as any).applyPushSlow(0.3);
    }
  };

  tryPlayerShove(
    player: Phaser.Physics.Arcade.Sprite,
    facing: 'up' | 'down' | 'left' | 'right',
    currentTime: number,
  ) {
    const playerBody = player.body as Phaser.Physics.Arcade.Body | undefined;
    if (!playerBody) return false;

    const facingVector = this.getFacingVector(facing);
    if (facingVector.lengthSq() === 0) return false;

    const detectionDistance = 96;
    const detectionDistanceSq = detectionDistance * detectionDistance;
    let targetRect: Phaser.GameObjects.Rectangle | null = null;
    let bestScore = -Infinity;

    this.furnitureGroup.children.each((child) => {
      const rect = child as Phaser.GameObjects.Rectangle;
      if (!rect.active) return;
      const furnitureBody = rect.body as Phaser.Physics.Arcade.Body | undefined;
      if (!furnitureBody) return;

      const dx = rect.x - player.x;
      const dy = rect.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > detectionDistanceSq) return;

      const direction = new Phaser.Math.Vector2(dx, dy);
      if (direction.lengthSq() === 0) return;
      direction.normalize();

      const alignment = Phaser.Math.Clamp(direction.dot(facingVector), -1, 1);
      if (alignment <= 0.2) return;

      const dist = Math.sqrt(distSq);
      const normalizedDistance = dist / detectionDistance;
      const score = alignment * 2 - normalizedDistance;
      if (score > bestScore) {
        bestScore = score;
        targetRect = rect;
      }
    });

    if (!targetRect) return false;

    const targetBody = targetRect.body as Phaser.Physics.Arcade.Body | undefined;
    if (!targetBody) return false;

    const fallbackIntent = facingVector.clone().setLength(140);
    const applied = this.applyFurniturePush(targetBody, playerBody, 0.06, fallbackIntent);
    if (!applied) return false;

    targetRect.setData('playerShoveActiveUntil', currentTime + 260);

    return true;
  }

  settleFurnitureAfterMonsterPush(currentTime: number) {
    this.furnitureGroup.children.each((child) => {
      const rect = child as Phaser.GameObjects.Rectangle;
      const body = rect.body as Phaser.Physics.Arcade.Body | undefined;
      if (!body) return;
      const lastContact = (rect.getData('lastMonsterContactAt') as number) ?? 0;
      const shoveActiveUntil = (rect.getData('playerShoveActiveUntil') as number) ?? 0;
      if (currentTime < shoveActiveUntil) return;
      if (currentTime - lastContact <= this.monsterFurnitureReleaseDelay) return;
      const velX = body.velocity.x;
      const velY = body.velocity.y;
      if (velX !== 0 || velY !== 0) {
        body.setVelocity(0, 0);
      }
    });
  }

  updateFurnitureVisuals() {
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

  updateFurnitureIndicators(player: Phaser.Physics.Arcade.Sprite) {
    for (const furniture of this.furniture) {
      if (!furniture.emojiLabel.active) continue;

      furniture.emojiLabel.setPosition(
        furniture.rect.x,
        furniture.rect.y + furniture.labelOffsetY,
      );

      const dist = this.distanceToRectangle(player.x, player.y, furniture.rect);
      const isActive = this.activeFurniture === furniture && this.searching;
      const hasInventorySpace = this.inventory.hasEmptyInventorySlot();
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

  tryStartSearch(player: Phaser.Physics.Arcade.Sprite) {
    if (this.searching) return;
    const furniture = this.getNearbyFurniture(player.x, player.y);
    if (!furniture) return;
    if (!this.inventory.hasEmptyInventorySlot()) {
      this.spawnFloatingEmoji(player.x, player.y - 44, '📦', 20, 0xff8383, 420);
      return;
    }
    this.beginSearch(furniture, player);
  }

  endSearch() {
    this.searching = false;
    this.activeFurniture = null;
    this.searchElapsed = 0;
    this.searchDuration = 0;
    this.searchCheckpoints = [];
    this.searchBar.clear();
    this.searchBar.setVisible(false);
  }

  updateSearch(delta: number, player: Phaser.Physics.Arcade.Sprite) {
    if (!this.searching || !this.activeFurniture) return;
    if (!this.inventory.hasEmptyInventorySlot()) {
      this.endSearch();
      return;
    }

    this.searchElapsed += delta;
    const remaining = Math.max(this.searchDuration - this.searchElapsed, 0);
    const progress = this.searchDuration > 0 ? remaining / this.searchDuration : 0;

    for (const checkpoint of this.searchCheckpoints) {
      if (!checkpoint.triggered && progress <= checkpoint.value) {
        checkpoint.triggered = true;
        this.tryAwardSearchLoot(player);
        if (!this.searching) return;
      }
    }

    this.drawSearchBar(player, progress);

    if (remaining <= 0) {
      this.endSearch();
    }
  }

  private beginSearch(furniture: SearchableFurniture, player: Phaser.Physics.Arcade.Sprite) {
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
    this.drawSearchBar(player, 1);
    this.searchBar.setVisible(true);
    this.spawnFloatingEmoji(player.x, player.y - 48, '🔍', 22, 0xfff3a5, 520);
  }

  private tryAwardSearchLoot(player: Phaser.Physics.Arcade.Sprite) {
    if (!this.activeFurniture || !this.inventory.hasEmptyInventorySlot()) {
      this.endSearch();
      return;
    }

    if (Phaser.Math.FloatBetween(0, 1) > this.activeFurniture.findChance) return;

    const itemId = Phaser.Utils.Array.GetRandom(this.activeFurniture.lootTable);
    if (!itemId) return;

    if (this.inventory.giveItemToInventory(itemId)) {
      this.spawnFloatingEmoji(player.x, player.y - 52, '✨', 24, 0xfff7c5, 560);
      if (!this.inventory.hasEmptyInventorySlot()) {
        this.endSearch();
      }
    }
  }

  private drawSearchBar(player: Phaser.Physics.Arcade.Sprite, progress: number) {
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    const width = 96;
    const height = 14;
    const innerWidth = width - 6;
    const innerHeight = height - 6;

    this.searchBar.clear();
    this.searchBar.setPosition(player.x, player.y - 58);
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

  private getNearbyFurniture(px: number, py: number) {
    const maxDistance = 64;
    let closest: SearchableFurniture | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const furniture of this.furniture) {
      if (!furniture.rect.active) continue;
      const dist = this.distanceToRectangle(px, py, furniture.rect);
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

  private resolveFurnitureHitbox(
    spriteOptions: FurnitureSpriteOptions | undefined,
    hitbox: FurnitureHitboxOptions | undefined,
  ) {
    const { scaleX, scaleY } = this.getFurnitureScale(spriteOptions);
    const texture = spriteOptions?.frame ? this.scene.textures.get('furniture') : null;
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

  private applyFurniturePush(
    furnitureBody: Phaser.Physics.Arcade.Body,
    sourceBody: Phaser.Physics.Arcade.Body,
    strengthScale = 1,
    fallbackIntent?: Phaser.Math.Vector2,
  ) {
    const pushVector = new Phaser.Math.Vector2(sourceBody.velocity.x, sourceBody.velocity.y);
    let sourceSpeedSq = pushVector.lengthSq();

    if (sourceSpeedSq < 100) {
      if (fallbackIntent && fallbackIntent.lengthSq() > 0) {
        pushVector.copy(fallbackIntent);
      } else {
        const deltaX = sourceBody.deltaX?.() ?? sourceBody.position.x - sourceBody.prev.x;
        const deltaY = sourceBody.deltaY?.() ?? sourceBody.position.y - sourceBody.prev.y;
        pushVector.set(deltaX, deltaY);
      }
      sourceSpeedSq = pushVector.lengthSq();
    }

    if (sourceSpeedSq < 16) {
      furnitureBody.setVelocity(0, 0);
      return false;
    }

    const sourceSpeed = Math.sqrt(sourceSpeedSq);
    const cappedSpeed = Math.min(sourceSpeed * strengthScale, 32);
    const targetSpeed = Math.max(cappedSpeed, 2.4);
    pushVector.setLength(targetSpeed);
    const lerpFactor = Phaser.Math.Clamp(0.25 + strengthScale * 0.5, 0.25, 0.55);
    furnitureBody.velocity.x = Phaser.Math.Linear(
      furnitureBody.velocity.x,
      pushVector.x,
      lerpFactor,
    );
    furnitureBody.velocity.y = Phaser.Math.Linear(
      furnitureBody.velocity.y,
      pushVector.y,
      lerpFactor,
    );

    return true;
  }

  private getFurnitureScale(spriteOptions: FurnitureSpriteOptions | undefined) {
    const baseScale =
      typeof spriteOptions?.scale === 'number' ? spriteOptions.scale : 1;
    const scaleX = Math.abs(
      typeof spriteOptions?.scaleX === 'number'
        ? spriteOptions.scaleX
        : baseScale,
    );
    const scaleY = Math.abs(
      typeof spriteOptions?.scaleY === 'number'
        ? spriteOptions.scaleY
        : baseScale,
    );

    return { scaleX, scaleY };
  }

  private getFacingVector(direction: 'up' | 'down' | 'left' | 'right') {
    switch (direction) {
      case 'up':
        return new Phaser.Math.Vector2(0, -1);
      case 'down':
        return new Phaser.Math.Vector2(0, 1);
      case 'left':
        return new Phaser.Math.Vector2(-1, 0);
      case 'right':
      default:
        return new Phaser.Math.Vector2(1, 0);
    }
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
}

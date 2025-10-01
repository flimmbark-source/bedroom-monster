import Phaser from 'phaser';

import type { ItemId } from '@game/types';
import type { SpawnPacing, Weighted } from '@content/rooms';
import { pickWeightedValue } from '@content/rooms';

import { InventorySystem } from './InventorySystem';

export class SpawnerSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: InventorySystem,
    private readonly restockPoints: { x: number; y: number }[],
    private readonly restockPool: Weighted<ItemId>[],
  ) {}

  spawnInitialItems(items: ItemId[]) {
    items.forEach((itemId, index) => {
      const point = this.restockPoints[index % this.restockPoints.length];
      this.inventory.createGroundItem(point.x, point.y, itemId);
    });
  }

  restockFurniture() {
    const items = this.inventory.getActiveGroundItems();
    if (items.length >= 4) return;

    const needed = Math.min(4 - items.length, this.restockPoints.length);
    const availablePoints = this.restockPoints.filter((point) =>
      !items.some((item) => Phaser.Math.Distance.Between(item.x, item.y, point.x, point.y) < 18),
    );

    if (this.restockPool.length === 0) return;

    for (let i = 0; i < needed && availablePoints.length > 0; i += 1) {
      const index = Phaser.Math.Between(0, availablePoints.length - 1);
      const point = availablePoints.splice(index, 1)[0];
      const itemId = pickWeightedValue(this.restockPool, () => Phaser.Math.FloatBetween(0, 1));
      this.inventory.createGroundItem(point.x, point.y, itemId);
    }
  }

  scheduleRestock({ restockIntervalMs, restockInitialDelayMs }: SpawnPacing) {
    if (restockIntervalMs <= 0) {
      return;
    }

    const spawnDrop = () => this.restockFurniture();
    const initialDelay = restockInitialDelayMs ?? restockIntervalMs;

    this.scene.time.delayedCall(initialDelay, () => {
      spawnDrop();
      this.scene.time.addEvent({
        delay: restockIntervalMs,
        loop: true,
        callback: spawnDrop,
      });
    });
  }
}

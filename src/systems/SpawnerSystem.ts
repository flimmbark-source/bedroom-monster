import Phaser from 'phaser';

import type { Item } from '@game/types';

import { InventorySystem } from './InventorySystem';

export class SpawnerSystem {
  private readonly restockPoints = [
    { x: 400, y: 360 },
    { x: 640, y: 360 },
    { x: 880, y: 360 },
    { x: 400, y: 560 },
    { x: 640, y: 560 },
    { x: 880, y: 560 },
  ];

  private readonly restockPool: Item['id'][] = ['knife', 'bottle', 'soda', 'match', 'bandaid', 'yoyo'];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: InventorySystem,
  ) {}

  spawnInitialItems(items: Item['id'][]) {
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

    for (let i = 0; i < needed && availablePoints.length > 0; i += 1) {
      const index = Phaser.Math.Between(0, availablePoints.length - 1);
      const point = availablePoints.splice(index, 1)[0];
      const itemId = Phaser.Utils.Array.GetRandom(this.restockPool);
      this.inventory.createGroundItem(point.x, point.y, itemId);
    }
  }

  scheduleRestock(delay = 15000) {
    this.scene.time.addEvent({
      delay,
      loop: true,
      callback: () => this.restockFurniture(),
    });
  }
}

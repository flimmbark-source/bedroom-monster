import Phaser from 'phaser';

import type { Inventory } from '@game/types';
import { cloneItem, type Item } from '@game/items';
import { craft as craftRecipe } from '@game/recipes';

export interface GroundItem extends Phaser.GameObjects.Image {
  itemId: Item['id'];
  label: Phaser.GameObjects.Text;
}

export class InventorySystem {
  private inventory: Inventory = [null, null];
  readonly itemsGroup: Phaser.Physics.Arcade.StaticGroup;

  constructor(private readonly scene: Phaser.Scene) {
    this.itemsGroup = scene.physics.add.staticGroup();
  }

  reset() {
    this.inventory = [null, null];
  }

  getInventory(): Inventory {
    return this.inventory;
  }

  getItem(slot: 0 | 1) {
    return this.inventory[slot];
  }

  hasEmptyInventorySlot() {
    return this.inventory.some((slot) => slot === null);
  }

  tryPickup(overItem: GroundItem | null) {
    if (!overItem) return false;

    const id = overItem.itemId as Item['id'];
    const swapIndex = this.inventory[0] ? (this.inventory[1] ? -1 : 1) : 0;

    if (swapIndex === -1) {
      const dropped = this.inventory[0]!;
      this.inventory[0] = { ...cloneItem(id) };
      overItem.itemId = dropped.id;
      overItem.setTexture(dropped.icon.key, dropped.icon.frame);
      overItem.label.setText(dropped.label);
    } else {
      this.inventory[swapIndex] = { ...cloneItem(id) };
      overItem.label.destroy();
      overItem.destroy();
      return true;
    }

    return true;
  }

  giveItemToInventory(id: Item['id']) {
    const idx = this.inventory.findIndex((slot) => slot === null);
    if (idx === -1) return false;
    this.inventory[idx] = cloneItem(id);
    return true;
  }

  drop(slot: 0 | 1, x: number, y: number) {
    const item = this.inventory[slot];
    if (!item) return;
    this.inventory[slot] = null;
    this.createGroundItem(x, y, item.id);
  }

  clearGroundItems() {
    this.itemsGroup.clear(true, true);
  }

  gainBottle(slot: 0 | 1, x: number, y: number) {
    if (!this.inventory[slot]) {
      this.inventory[slot] = cloneItem('bottle');
      return;
    }
    const other = slot === 0 ? 1 : 0;
    if (!this.inventory[other]) {
      this.inventory[other] = cloneItem('bottle');
      return;
    }
    this.createGroundItem(x, y, 'bottle');
  }

  craft() {
    const first = this.inventory[0]?.id;
    const second = this.inventory[1]?.id;
    const result = craftRecipe(first, second);
    if (!result) return false;
    this.inventory[0] = { ...cloneItem(result) };
    this.inventory[1] = null;
    return true;
  }

  consume(slot: 0 | 1) {
    const item = this.inventory[slot];
    if (!item) return;
    item.uses -= 1;
    if (item.uses <= 0) {
      this.inventory[slot] = null;
    }
  }

  createGroundItem(x: number, y: number, id: Item['id']) {
    const template = cloneItem(id);
    const sprite = this.scene.add.image(x, y, template.icon.key, template.icon.frame) as GroundItem;
    sprite.setDisplaySize(28, 28);
    sprite.setDepth(6);
    sprite.itemId = template.id;

    const label = this.scene.add
      .text(x, y - 18, template.label, { fontSize: '10px' })
      .setOrigin(0.5, 1);
    label.setDepth(6);
    sprite.label = label;
    sprite.on('destroy', () => {
      if (label.active) {
        label.destroy();
      }
    });

    this.scene.physics.add.existing(sprite, true);
    this.configureItemBody(sprite);
    this.itemsGroup.add(sprite);
    return sprite;
  }

  getActiveGroundItems() {
    return this.itemsGroup.getChildren().filter((child) => child.active) as GroundItem[];
  }

  private configureItemBody(item: GroundItem) {
    const body = item.body as Phaser.Physics.Arcade.StaticBody;
    const width = item.displayWidth * 0.8;
    const height = item.displayHeight * 0.8;
    body.setSize(width, height).setOffset(-width / 2, -height / 2);
    body.updateFromGameObject();
  }
}

import Phaser from 'phaser';

import { ROOMS, type RoomConfig, type RoomSpawns } from '@content/rooms';
import type { ItemId } from '@game/items';
import { DoorSystem } from '@game/doors';
import type { Weighted } from '@content/rooms';
import type { RoomId } from '@game/world';

import { InventorySystem } from '../systems/InventorySystem';
import { SearchSystem } from '../systems/SearchSystem';

export type LoadedRoom = {
  id: RoomId;
  size: { width: number; height: number };
  starterItems: ItemId[];
  restockPoints: { x: number; y: number }[];
  spawns: RoomSpawns;
  keyDrops: Weighted<ItemId>[];
};

export class RoomLoader {
  private background?: Phaser.GameObjects.Image;
  private doorSystem?: DoorSystem;
  private currentRoomId?: RoomId;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly searchSystem: SearchSystem,
    private readonly inventorySystem: InventorySystem,
    doorSystem?: DoorSystem,
  ) {
    this.doorSystem = doorSystem;
  }

  setDoorSystem(doorSystem: DoorSystem) {
    this.doorSystem = doorSystem;
    if (this.currentRoomId) {
      this.doorSystem.setRoom(this.currentRoomId);
    }
  }

  load(roomId: RoomId): LoadedRoom {
    return this.applyRoom(roomId);
  }

  transitionTo(roomId: RoomId, duration = 320): Promise<LoadedRoom> {
    return new Promise((resolve) => {
      const camera = this.scene.cameras.main;
      const completeLoad = () => {
        camera.off(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, completeLoad);
        const result = this.applyRoom(roomId);
        camera.fadeIn(duration, 0, 0, 0);
        resolve(result);
      };

      camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, completeLoad);
      camera.fadeOut(duration, 0, 0, 0);
    });
  }

  private applyRoom(roomId: RoomId): LoadedRoom {
    const config = ROOMS[roomId];
    if (!config) {
      throw new Error(`Unknown room id: ${roomId}`);
    }

    const { width, height } = config.size;
    this.scene.physics.world.setBounds(0, 0, width, height);
    this.ensureBackground(config);

    this.inventorySystem.clearGroundItems();
    this.searchSystem.clearFurniture();
    this.searchSystem.reset();
    this.searchSystem.loadFurnitureLayout(config.furniture);

    this.currentRoomId = roomId;
    this.doorSystem?.setRoom(roomId);

    return {
      id: config.id,
      size: { ...config.size },
      starterItems: [...config.starterItems],
      restockPoints: config.restockPoints.map((point) => ({ ...point })),
      spawns: {
        restock: { ...config.spawns.restock },
        items: config.spawns.items.map((entry) => ({ ...entry })),
        monsters: config.spawns.monsters.map((entry) => ({ ...entry })),
      },
      keyDrops: config.keyDrops.map((entry) => ({ ...entry })),
    };
  }

  private ensureBackground(config: RoomConfig) {
    const { width, height } = config.size;
    const centerX = width / 2;
    const centerY = height / 2;
    if (!this.background) {
      this.background = this.scene.add
        .image(centerX, centerY, config.background.key)
        .setDepth(-20)
        .setScrollFactor(0);
    }

    this.background
      .setTexture(config.background.key)
      .setDisplaySize(width, height)
      .setPosition(centerX, centerY);
  }
}

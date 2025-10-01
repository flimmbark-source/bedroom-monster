import Phaser from 'phaser';
import { consumeKey, hasKey } from './keys';
import { listRoomDoors, type DoorDefinition, type RoomId } from './world';

const OPEN_DOORS = new Set<string>();

export function resetDoors() {
  OPEN_DOORS.clear();
}

export type DoorSystemOptions = {
  onDoorOpened?: (door: DoorDefinition) => void | Promise<void>;
};

type DoorInstance = {
  def: DoorDefinition;
  sprite: Phaser.GameObjects.Sprite;
  zone: Phaser.GameObjects.Zone;
  tooltip: Phaser.GameObjects.Text;
  opened: boolean;
  playerNear: boolean;
  baseTooltipColor: string;
};

const TOOLTIP_STYLE = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#f2f2f2',
  backgroundColor: '#101820d8',
  padding: { left: 6, right: 6, top: 2, bottom: 2 },
  align: 'center',
} as const;

export class DoorSystem {
  private doors: DoorInstance[] = [];
  private playerRect = new Phaser.Geom.Rectangle();
  private zoneRect = new Phaser.Geom.Rectangle();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly options: DoorSystemOptions = {},
  ) {}

  destroy() {
    this.clearDoors();
  }

  setRoom(roomId: RoomId) {
    this.clearDoors();
    const doorDefs = listRoomDoors(roomId);
    doorDefs.forEach((def) => this.spawnDoor(def));
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    this.playerRect.setTo(body.x, body.y, body.width, body.height);

    for (const instance of this.doors) {
      const zoneBody = instance.zone.body as Phaser.Physics.Arcade.StaticBody | undefined;
      if (!zoneBody) continue;
      this.zoneRect.setTo(zoneBody.x, zoneBody.y, zoneBody.width, zoneBody.height);
      const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(this.playerRect, this.zoneRect);
      if (overlapping) {
        this.showTooltip(instance);
        instance.playerNear = true;
      } else if (instance.playerNear) {
        instance.playerNear = false;
        instance.tooltip.setVisible(false);
      }
    }
  }

  tryInteract(): boolean {
    const activeDoor = this.doors.find((door) => door.playerNear);
    if (!activeDoor) return false;

    if (!activeDoor.opened) {
      const requirement = activeDoor.def.requirement;
      if (requirement) {
        if (!hasKey(requirement.key)) {
          this.flashLocked(activeDoor);
          return false;
        }
        consumeKey(requirement.key);
      }
      activeDoor.opened = true;
      OPEN_DOORS.add(activeDoor.def.id);
      this.scene.tweens.add({
        targets: activeDoor.sprite,
        alpha: { from: activeDoor.sprite.alpha, to: 0.7 },
        duration: 160,
        ease: 'Sine.easeOut',
      });
    }

    this.options.onDoorOpened?.(activeDoor.def);
    return true;
  }

  private spawnDoor(def: DoorDefinition) {
    const { coords } = def;
    const sprite = this.scene.add.sprite(coords.x, coords.y, def.sprite.key, def.sprite.frame);
    sprite.setDepth(coords.depth ?? 5);

    const hotspot = coords.hotspot ?? { width: 140, height: 200, offsetX: 0, offsetY: 0 };
    const zone = this.scene.add.zone(coords.x + (hotspot.offsetX ?? 0), coords.y + (hotspot.offsetY ?? 0));
    zone.setSize(hotspot.width, hotspot.height);
    this.scene.physics.add.existing(zone, true);

    const tooltip = this.scene.add
      .text(
        coords.x + (coords.tooltipOffset?.x ?? 0),
        coords.y + (coords.tooltipOffset?.y ?? -120),
        '',
        TOOLTIP_STYLE,
      )
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth((coords.depth ?? 5) + 1);

    const opened = OPEN_DOORS.has(def.id);
    if (opened) {
      sprite.setAlpha(0.7);
    }

    this.doors.push({
      def,
      sprite,
      zone,
      tooltip,
      opened,
      playerNear: false,
      baseTooltipColor: TOOLTIP_STYLE.color,
    });
  }

  private clearDoors() {
    this.doors.forEach((door) => {
      door.sprite.destroy();
      door.zone.destroy();
      door.tooltip.destroy();
    });
    this.doors = [];
  }

  private showTooltip(door: DoorInstance) {
    const requirement = door.def.requirement;
    if (!door.opened && requirement && !hasKey(requirement.key)) {
      door.tooltip.setColor('#ff8f8f');
      door.tooltip.setText(`Locked: ${requirement.label}`);
    } else {
      door.tooltip.setColor(door.baseTooltipColor);
      door.tooltip.setText(door.opened ? 'Press E to enter' : 'Press E to open');
    }
    door.tooltip.setVisible(true);
  }

  private flashLocked(door: DoorInstance) {
    const requirement = door.def.requirement;
    door.tooltip.setVisible(true);
    door.tooltip.setColor('#ff8f8f');
    door.tooltip.setText(`Locked: ${requirement?.label ?? 'Requires key'}`);
    this.scene.time.delayedCall(360, () => {
      if (!door.tooltip.active) return;
      door.tooltip.setColor(door.baseTooltipColor);
    });
  }
}

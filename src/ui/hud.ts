import type Phaser from 'phaser';
import { ROOM_W } from '@game/config';
import { ITEM_TEXTURE_KEYS } from '@game/items';
import type { Inventory, Item } from '@game/types';

export type HudElements = {
  container: Phaser.GameObjects.Container;
  hearts: Phaser.GameObjects.Graphics;
  slotTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  slotIcons: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  slotUseDots: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
  shoveCooldown: Phaser.GameObjects.Graphics;
  shoveKeyText: Phaser.GameObjects.Text;
  shoveLabel: Phaser.GameObjects.Text;
};

export function createHUD(scene: Phaser.Scene, maxHp: number): HudElements {
  const container = scene.add.container(0, 0);
  container.setDepth(1000);
  container.setScrollFactor(0);

  const frame = scene.add.graphics();
  frame.fillStyle(0x111111, 0.6).fillRoundedRect(12, 12, 280, 84, 10);
  frame.lineStyle(1, 0x999999, 0.8).strokeRoundedRect(20, 58, 120, 28, 6);
  frame.strokeRoundedRect(160, 58, 120, 28, 6);
  frame.setScrollFactor(0);
  container.add(frame);

  const controlsPanel = scene.add.graphics();
  controlsPanel
    .fillStyle(0x111111, 0.6)
    .fillRoundedRect(ROOM_W - 244, 12, 232, 156, 8)
    .lineStyle(1, 0x999999, 0.8)
    .strokeRoundedRect(ROOM_W - 242, 14, 228, 152, 8);
  controlsPanel.setScrollFactor(0);
  container.add(controlsPanel);

  const hearts = scene.add.graphics();
  hearts.setScrollFactor(0);
  container.add(hearts);

  const makeSlotElements = (x: number, idx: number) => {
    const icon = scene.add.image(x + 30, 74, ITEM_TEXTURE_KEYS.match);
    icon.setDisplaySize(20, 20);
    icon.setScrollFactor(0);
    icon.setVisible(false);
    container.add(icon);

    const text = scene.add.text(x + 48, 60, `${idx + 1}: —`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      wordWrap: { width: 84 },
    });
    text.setOrigin(0, 0);
    text.setLineSpacing(2);
    text.setScrollFactor(0);
    container.add(text);
    const uses = scene.add.graphics();
    uses.setScrollFactor(0);
    container.add(uses);
    return { icon, text, uses };
  };

  const slotElements = [makeSlotElements(20, 0), makeSlotElements(160, 1)] as const;
  const slotIcons: HudElements['slotIcons'] = [slotElements[0].icon, slotElements[1].icon];
  const slotTexts: HudElements['slotTexts'] = [slotElements[0].text, slotElements[1].text];
  const slotUseDots: HudElements['slotUseDots'] = [slotElements[0].uses, slotElements[1].uses];

  const controlsText = scene.add.text(
    ROOM_W - 24,
    24,
    [
      'Controls',
      'WASD: Move',
      'Mouse: Aim',
      'Left Click: Use Slot 1',
      'Right Click: Use Slot 2',
      'E: Pick Up / Search',
      'F: Shove',
      'G: Drop Item',
      'R: Craft',
    ].join('\n'),
    {
      fontFamily: 'monospace',
      fontSize: '12px',
      align: 'right',
    },
  );
  controlsText.setOrigin(1, 0);
  controlsText.setLineSpacing(4);
  controlsText.setScrollFactor(0);
  container.add(controlsText);

  const shoveKeyText = scene.add.text(ROOM_W - 210, 152, 'F', {
    fontFamily: 'monospace',
    fontSize: '20px',
    fontStyle: 'bold',
    align: 'center',
  });
  shoveKeyText.setOrigin(0.5);
  shoveKeyText.setScrollFactor(0);
  container.add(shoveKeyText);

  const shoveLabel = scene.add.text(ROOM_W - 184, 139, 'Shove', {
    fontFamily: 'monospace',
    fontSize: '12px',
    align: 'left',
  });
  shoveLabel.setOrigin(0, 0);
  shoveLabel.setLineSpacing(2);
  shoveLabel.setScrollFactor(0);
  container.add(shoveLabel);

  const shoveCooldown = scene.add.graphics();
  shoveCooldown.setScrollFactor(0);
  container.addAt(shoveCooldown, container.getIndex(shoveKeyText));

  // initialize once so the HUD starts with correct values
  const initialInv: Inventory = [null, null];
  drawHUD(
    {
      container,
      hearts,
      slotTexts,
      slotIcons,
      slotUseDots,
      shoveCooldown,
      shoveKeyText,
      shoveLabel,
    },
    maxHp,
    maxHp,
    initialInv,
    0,
  );

  return {
    container,
    hearts,
    slotTexts,
    slotIcons,
    slotUseDots,
    shoveCooldown,
    shoveKeyText,
    shoveLabel,
  };
}

function slotLabel(i: number, it: Item | null) {
  if (!it) return `${i + 1}: —`;
  return `${i + 1}: ${it.label}`;
}

export function drawHUD(
  hud: HudElements,
  hp: number,
  maxHp: number,
  inv: Inventory,
  shoveCooldownProgress = 0,
) {
  const { hearts, slotTexts, slotIcons, slotUseDots, shoveCooldown, shoveKeyText, shoveLabel } = hud;

  hearts.clear();
  for (let i = 0; i < maxHp; i += 1) {
    const color = i < hp ? 0xff4d4d : 0x444444;
    hearts.fillStyle(color, 1).fillCircle(28 + i * 20, 32, 7);
  }

  for (let i = 0; i < slotTexts.length; i += 1) {
    const item = inv[i];
    slotTexts[i].setText(slotLabel(i, item));
    slotUseDots[i].clear();
    slotUseDots[i].setVisible(false);
    if (item) {
      slotIcons[i].setTexture(item.icon);
      slotIcons[i].setDisplaySize(20, 20);
      slotIcons[i].setVisible(true);

      const totalUses = (item.data as { initialUses?: number } | undefined)?.initialUses ?? item.uses;
      if (totalUses > 0) {
        const spacing = 8;
        const radius = 3;
        const startX = slotIcons[i].x - ((totalUses - 1) * spacing) / 2;
        const y = slotIcons[i].y + 12;
        slotUseDots[i].fillStyle(0xfff275, 1);
        for (let dot = 0; dot < totalUses; dot += 1) {
          if (dot < item.uses) {
            const x = startX + dot * spacing;
            slotUseDots[i].fillCircle(x, y, radius);
          }
        }
        slotUseDots[i].setVisible(item.uses > 0);
      }
    } else {
      slotIcons[i].setVisible(false);
    }
  }

  const clampedProgress = Math.max(0, Math.min(1, shoveCooldownProgress));
  const radius = 20;
  const centerX = shoveKeyText.x;
  const centerY = shoveKeyText.y;
  shoveCooldown.clear();
  shoveCooldown.fillStyle(0x000000, 0.45);
  shoveCooldown.fillCircle(centerX, centerY, radius);
  shoveCooldown.lineStyle(1, 0xffffff, 0.35);
  shoveCooldown.strokeCircle(centerX, centerY, radius);

  if (clampedProgress > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * clampedProgress;
    shoveCooldown.beginPath();
    shoveCooldown.fillStyle(0xfff275, 0.9);
    shoveCooldown.slice(centerX, centerY, radius, startAngle, endAngle, false);
    shoveCooldown.fillPath();
    shoveKeyText.setAlpha(0.65);
    shoveLabel.setAlpha(0.65);
  } else {
    shoveCooldown.lineStyle(2, 0x8cff9e, 0.9);
    shoveCooldown.strokeCircle(centerX, centerY, radius - 3);
    shoveKeyText.setAlpha(1);
    shoveLabel.setAlpha(1);
  }
}

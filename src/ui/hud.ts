import type Phaser from 'phaser';
import { ROOM_W } from '@game/config';
import { ITEM_TEXTURE_KEYS } from '@game/items';
import type { Inventory, Item } from '@game/types';

export type HudElements = {
  container: Phaser.GameObjects.Container;
  hearts: Phaser.GameObjects.Graphics;
  slotTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  slotIcons: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  slotUses: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
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

    return { icon, text, uses } as const;
  };

  const slotElements = [makeSlotElements(20, 0), makeSlotElements(160, 1)] as const;
  const slotIcons: HudElements['slotIcons'] = [slotElements[0].icon, slotElements[1].icon];
  const slotTexts: HudElements['slotTexts'] = [slotElements[0].text, slotElements[1].text];
  const slotUses: HudElements['slotUses'] = [slotElements[0].uses, slotElements[1].uses];

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

  // initialize once so the HUD starts with correct values
  const initialInv: Inventory = [null, null];
  drawHUD({ container, hearts, slotTexts, slotIcons, slotUses }, maxHp, maxHp, initialInv);

  return { container, hearts, slotTexts, slotIcons, slotUses };
}

function slotLabel(i: number, it: Item | null) {
  if (!it) return `${i + 1}: —`;
  return `${i + 1}: ${it.label}`;
}

export function drawHUD(hud: HudElements, hp: number, maxHp: number, inv: Inventory) {
  const { hearts, slotTexts, slotIcons, slotUses } = hud;

  hearts.clear();
  for (let i = 0; i < maxHp; i += 1) {
    const color = i < hp ? 0xff4d4d : 0x444444;
    hearts.fillStyle(color, 1).fillCircle(28 + i * 20, 32, 7);
  }

  for (let i = 0; i < slotTexts.length; i += 1) {
    const item = inv[i];
    slotTexts[i].setText(slotLabel(i, item));
    slotUses[i].clear();
    if (item) {
      slotIcons[i].setTexture(item.icon);
      slotIcons[i].setDisplaySize(20, 20);
      slotIcons[i].setVisible(true);

      if (item.uses > 0) {
        const baseY = slotTexts[i].y + slotTexts[i].height + 10;
        const spacing = 12;
        const totalWidth = (item.uses - 1) * spacing;
        const startX = slotIcons[i].x - totalWidth / 2;
        for (let dot = 0; dot < item.uses; dot += 1) {
          const x = startX + dot * spacing;
          slotUses[i].fillStyle(0xfff066, 1).fillCircle(x, baseY, 4);
        }
      }
    } else {
      slotIcons[i].setVisible(false);
    }
  }
}

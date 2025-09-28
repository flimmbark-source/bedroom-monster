import type Phaser from 'phaser';
import { ROOM_W } from '@game/config';
import type { Inventory, Item } from '@game/types';

export type HudElements = {
  container: Phaser.GameObjects.Container;
  hearts: Phaser.GameObjects.Graphics;
  slotTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
};

export function createHUD(scene: Phaser.Scene, maxHp: number): HudElements {
  const container = scene.add.container(0, 0);
  container.setDepth(1000);
  container.setScrollFactor(0);

  const frame = scene.add.graphics();
  frame.fillStyle(0x111111, 0.6).fillRoundedRect(12, 12, 220, 64, 8);
  frame.lineStyle(1, 0x999999, 0.8).strokeRoundedRect(16, 52, 90, 20, 4);
  frame.strokeRoundedRect(112, 52, 90, 20, 4);
  frame.setScrollFactor(0);
  container.add(frame);

  const controlsPanel = scene.add.graphics();
  controlsPanel
    .fillStyle(0x111111, 0.6)
    .fillRoundedRect(ROOM_W - 236, 12, 224, 132, 8)
    .lineStyle(1, 0x999999, 0.8)
    .strokeRoundedRect(ROOM_W - 234, 14, 220, 128, 8);
  controlsPanel.setScrollFactor(0);
  container.add(controlsPanel);

  const hearts = scene.add.graphics();
  hearts.setScrollFactor(0);
  container.add(hearts);

  const makeSlotText = (x: number, idx: number) => {
    const text = scene.add.text(x + 6, 52, `${idx + 1}: —`, {
      fontFamily: 'monospace',
      fontSize: '12px',
    });
    text.setScrollFactor(0);
    container.add(text);
    return text;
  };

  const slotTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text] = [
    makeSlotText(16, 0),
    makeSlotText(112, 1),
  ];

  const controlsText = scene.add.text(
    ROOM_W - 24,
    24,
    ['Controls', 'Arrow Keys: Move', '1 / 2: Use Items', 'E: Pick Up', 'G: Drop Item', 'R: Craft'].join('\n'),
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
  drawHUD({ container, hearts, slotTexts }, maxHp, maxHp, initialInv);

  return { container, hearts, slotTexts };
}

function slotLabel(i: number, it: Item | null) {
  return `${i + 1}: ${it ? it.label : '—'}${it ? ` (${it.uses})` : ''}`;
}

export function drawHUD(hud: HudElements, hp: number, maxHp: number, inv: Inventory) {
  const { hearts, slotTexts } = hud;

  hearts.clear();
  for (let i = 0; i < maxHp; i += 1) {
    const color = i < hp ? 0xff4d4d : 0x444444;
    hearts.fillStyle(color, 1).fillCircle(28 + i * 20, 32, 7);
  }

  slotTexts[0].setText(slotLabel(0, inv[0]));
  slotTexts[1].setText(slotLabel(1, inv[1]));
}

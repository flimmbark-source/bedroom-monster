import type Phaser from 'phaser';
import type { Inventory, Item } from '@game/types';

export function drawHUD(scene: Phaser.Scene, hp: number, maxHp: number, inv: Inventory) {
  const g = scene.add.graphics();
  g.fillStyle(0x111111, 0.6).fillRoundedRect(12, 12, 220, 64, 8);
  // hearts
  for (let i=0;i<maxHp;i++) {
    const c = i < hp ? 0xff4d4d : 0x444444;
    g.fillStyle(c, 1).fillCircle(28 + i*20, 32, 7);
  }
  // slots
  const slotBox = (x:number, i:number, it: Item|null) => {
    g.lineStyle(1, 0x999999, 0.8).strokeRoundedRect(x, 52, 90, 20, 4);
    scene.add.text(x+6, 52, `${i+1}: ${it? it.label: '—'}${it? ` (${it.uses})`: ''}`, { fontFamily: 'monospace', fontSize: '12px' });
  };
  slotBox(16, 0, inv[0]);
  slotBox(112, 1, inv[1]);
}

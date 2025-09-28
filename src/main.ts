import Phaser from 'phaser';
import { PlayScene } from '@scenes/PlayScene';
import { ROOM_W, ROOM_H } from '@game/config';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: ROOM_W,
  height: ROOM_H,
  backgroundColor: '#0b0d12',
  parent: 'app',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [PlayScene],
});

// Expose for simple debugging in console
(window as any).game = game;

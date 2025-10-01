import type Phaser from 'phaser';

export type TooltipOptions = {
  x: number;
  y: number;
  depth?: number;
  maxWidth?: number;
};

export type Tooltip = {
  readonly root: Phaser.GameObjects.Container;
  readonly defaultColor: string;
  setText(text: string): void;
  setTextColor(color: string): void;
  setPosition(x: number, y: number): void;
  show(text?: string): void;
  hide(): void;
  destroy(): void;
  isDestroyed(): boolean;
};

const BG_COLOR = 0x13171f;
const STROKE_COLOR = 0x2a3242;
const TEXT_COLOR = '#e6e6e6';
const PAD_X = 10;
const PAD_Y = 6;
const CORNER_RADIUS = 8;

export function createTooltip(scene: Phaser.Scene, options: TooltipOptions): Tooltip {
  const root = scene.add.container(options.x, options.y).setVisible(false);
  if (options.depth !== undefined) {
    root.setDepth(options.depth);
  }

  const background = scene.add.graphics();
  const label = scene.add
    .text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: TEXT_COLOR,
      align: 'center',
      wordWrap: options.maxWidth
        ? { width: options.maxWidth - PAD_X * 2, useAdvancedWrap: true }
        : undefined,
    })
    .setOrigin(0.5);

  root.add([background, label]);

  let destroyed = false;

  const layout = () => {
    const bounds = label.getBounds();
    const width = Math.max(bounds.width + PAD_X * 2, 24);
    const height = Math.max(bounds.height + PAD_Y * 2, 20);
    background.clear();
    background
      .fillStyle(BG_COLOR, 0.92)
      .fillRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS)
      .lineStyle(1, STROKE_COLOR, 1)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS);
  };

  const setText = (text: string) => {
    label.setText(text);
    layout();
  };

  const show = (text?: string) => {
    if (text !== undefined) {
      setText(text);
    }
    if (!label.text) {
      // Empty text → keep hidden
      return;
    }
    root.setVisible(true);
  };

  const hide = () => {
    root.setVisible(false);
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    root.destroy(true);
  };

  const setPosition = (x: number, y: number) => {
    root.setPosition(x, y);
  };

  const setTextColor = (color: string) => {
    label.setColor(color);
  };

  return {
    root,
    defaultColor: TEXT_COLOR,
    setText,
    setTextColor,
    setPosition,
    show,
    hide,
    destroy,
    isDestroyed: () => destroyed,
  };
}

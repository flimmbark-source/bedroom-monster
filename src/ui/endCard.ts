import type Phaser from 'phaser';

export type RunOutcome = 'victory' | 'defeat';

export type RunSummary = {
  outcome: RunOutcome;
  timeSurvivedMs: number;
  damageDealt: number;
  itemsUsed: number;
  craftsMade: number;
};

export type EndCardElements = {
  root: Phaser.GameObjects.Container;
  show(summary: RunSummary): void;
  showPrompt(): void;
  hide(): void;
};

const CARD_BG = 0x151b26;
const CARD_STROKE = 0x2c3444;
const TEXT_MAIN = '#f3f6ff';
const TEXT_DIM = '#9aa3b2';
const ACCENT_DEFEAT = '#ff7b7b';
const ACCENT_VICTORY = '#b6f05f';

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDamage(amount: number) {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function createEndCard(scene: Phaser.Scene): EndCardElements {
  const container = scene.add.container(0, 0).setDepth(2001).setScrollFactor(0).setVisible(false);

  const overlay = scene.add
    .rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x05070b, 0.7)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: false });

  const cardWidth = 340;
  const cardHeight = 240;
  const card = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);

  const cardBackground = scene.add.graphics();
  cardBackground.fillStyle(CARD_BG, 0.94).fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);
  cardBackground.lineStyle(2, CARD_STROKE, 1).strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);

  const headline = scene.add
    .text(0, -cardHeight / 2 + 36, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: TEXT_MAIN,
    })
    .setOrigin(0.5);

  const subline = scene.add
    .text(0, headline.y + 26, 'Run Summary', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: TEXT_DIM,
    })
    .setOrigin(0.5);

  const statStartY = subline.y + 34;
  const lineSpacing = 24;

  const timeText = scene.add
    .text(0, statStartY, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: TEXT_MAIN,
    })
    .setOrigin(0.5, 0.5);

  const damageText = scene.add
    .text(0, statStartY + lineSpacing, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: TEXT_MAIN,
    })
    .setOrigin(0.5, 0.5);

  const usedText = scene.add
    .text(0, statStartY + lineSpacing * 2, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: TEXT_MAIN,
    })
    .setOrigin(0.5, 0.5);

  const craftText = scene.add
    .text(0, statStartY + lineSpacing * 3, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: TEXT_MAIN,
    })
    .setOrigin(0.5, 0.5);

  const prompt = scene.add
    .text(0, cardHeight / 2 - 36, 'Press Space / Enter / Click to retry', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: TEXT_DIM,
    })
    .setOrigin(0.5, 0.5)
    .setAlpha(0);

  card.add([
    cardBackground,
    headline,
    subline,
    timeText,
    damageText,
    usedText,
    craftText,
    prompt,
  ]);

  container.add([overlay, card]);

  const updateLayout = () => {
    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;
    overlay.setPosition(centerX, centerY);
    overlay.setDisplaySize(scene.scale.width, scene.scale.height);
    card.setPosition(centerX, centerY);
  };

  scene.scale.on('resize', updateLayout);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', updateLayout);
  });

  const show = (summary: RunSummary) => {
    updateLayout();
    const accent = summary.outcome === 'victory' ? ACCENT_VICTORY : ACCENT_DEFEAT;
    headline.setText(summary.outcome === 'victory' ? 'Monster Banished!' : 'Night Over').setColor(accent);
    timeText.setText(`Time survived: ${formatTime(summary.timeSurvivedMs)}`);
    damageText.setText(`Damage dealt: ${formatDamage(summary.damageDealt)}`);
    usedText.setText(`Items used: ${summary.itemsUsed}`);
    craftText.setText(`Crafts made: ${summary.craftsMade}`);
    prompt.setAlpha(0);
    container.setVisible(true);
    container.setAlpha(1);
    scene.tweens.add({
      targets: card,
      scale: { from: 0.92, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut',
    });
  };

  const showPrompt = () => {
    scene.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeOut',
    });
  };

  const hide = () => {
    container.setVisible(false);
    prompt.setAlpha(0);
  };

  return { root: container, show, showPrompt, hide };
}

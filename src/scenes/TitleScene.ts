// ─────────────────────────────────────────────────────────────
// TitleScene.ts — 시련 3종 중 하나를 골라 GameScene을 시작한다.
// HUD 미화(§9-5)는 다음 단계다. 지금은 순수 기능만: 목록 표시 + 선택 + 시작.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { SCREEN, TRIALS } from '../config/balance';

export class TitleScene extends Phaser.Scene {
  private selectedIndex = 0;
  private entries: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    this.selectedIndex = 0;
    this.entries = [];

    this.add
      .text(SCREEN.WIDTH / 2, 40, '오디세이 서바이버즈', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f2ece0',
      })
      .setOrigin(0.5);

    this.add
      .text(SCREEN.WIDTH / 2, 62, '↑↓ 로 시련 선택, Enter/클릭으로 시작', {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#9a9184',
      })
      .setOrigin(0.5);

    TRIALS.forEach((trial, index) => {
      const y = 100 + index * 34;
      const label = this.add
        .text(SCREEN.WIDTH / 2, y, trial.name, {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#f2ece0',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(SCREEN.WIDTH / 2, y + 14, trial.tagline, {
          fontFamily: 'sans-serif',
          fontSize: '8px',
          color: '#9a9184',
          wordWrap: { width: SCREEN.WIDTH - 40 },
          align: 'center',
        })
        .setOrigin(0.5);

      label.on('pointerover', () => {
        this.selectedIndex = index;
        this.refreshHighlight();
      });
      label.on('pointerdown', () => {
        this.selectedIndex = index;
        this.startSelected();
      });

      this.entries.push(label);
    });

    this.refreshHighlight();

    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.startSelected());
    this.input.keyboard?.on('keydown-SPACE', () => this.startSelected());
  }

  private moveSelection(delta: number): void {
    const count = TRIALS.length;
    this.selectedIndex = (this.selectedIndex + delta + count) % count;
    this.refreshHighlight();
  }

  private refreshHighlight(): void {
    this.entries.forEach((entry, index) => {
      entry.setColor(index === this.selectedIndex ? '#9fe8ff' : '#f2ece0');
    });
  }

  private startSelected(): void {
    const trial = TRIALS[this.selectedIndex];
    this.scene.start('Game', { trialId: trial.id });
  }
}

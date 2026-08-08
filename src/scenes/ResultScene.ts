// ─────────────────────────────────────────────────────────────
// ResultScene.ts — 클리어/사망 화면. 판정은 GameScene이 sim 결과를 보고 이미 내렸다(하네스 3).
// 이 씬은 결과를 표시하고 타이틀로 돌아가는 것만 한다. 꾸밈은 다음 단계.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { SCREEN, VISUAL } from '../config/balance';

interface ResultSceneData {
  cleared: boolean;
  trialName: string;
  elapsedSec: number;
  kills: number;
  level: number;
}

export class ResultScene extends Phaser.Scene {
  private resultData!: ResultSceneData;

  constructor() {
    super('Result');
  }

  init(data: ResultSceneData): void {
    this.resultData = data;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VISUAL.COLOR.ARENA_FALLBACK);

    const headline = this.resultData.cleared ? '시련 클리어' : '사망';
    const headlineColor = this.resultData.cleared ? '#9fe8ff' : '#d0453c';

    this.add
      .text(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 - 40, headline, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: headlineColor,
      })
      .setOrigin(0.5);

    this.add
      .text(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 - 14, this.resultData.trialName, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#f2ece0',
      })
      .setOrigin(0.5);

    const minutes = Math.floor(this.resultData.elapsedSec / 60);
    const seconds = Math.floor(this.resultData.elapsedSec % 60);
    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    this.add
      .text(
        SCREEN.WIDTH / 2,
        SCREEN.HEIGHT / 2 + 6,
        `생존 ${timeText}  ·  처치 ${this.resultData.kills}  ·  Lv.${this.resultData.level}`,
        { fontFamily: 'sans-serif', fontSize: '9px', color: '#9a9184' },
      )
      .setOrigin(0.5);

    this.add
      .text(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 30, '아무 키나 누르거나 클릭하면 타이틀로', {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: '#9a9184',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown', () => this.scene.start('Title'));
    this.input.once('pointerdown', () => this.scene.start('Title'));
  }
}

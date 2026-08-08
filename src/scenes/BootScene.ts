// ─────────────────────────────────────────────────────────────
// BootScene.ts — 부트 자리. 이번 단계는 에셋 로딩을 포함하지 않는다(tech-B에서 채운다).
// 지금은 4씬 구조(BootScene/TitleScene/GameScene/ResultScene)만 세우고 바로 TitleScene으로 넘어간다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { VISUAL } from '../config/balance';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VISUAL.COLOR.ARENA_FALLBACK);
    this.scene.start('Title');
  }
}

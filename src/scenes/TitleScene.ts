// ─────────────────────────────────────────────────────────────
// TitleScene.ts — 시련 3종 중 하나를 골라 GameScene을 시작한다.
// 화면 규격은 GDD §9-8, 좌표·암막 원본은 balance.ts의 HUD.TITLE(§8-6: 씬에 좌표 리터럴 금지).
// 새 에셋 없음 — arena.jpg(파생 없이 그대로) + player.png의 파생 1장(titleHero)만 재사용한다.
// 폴백(§8-20): titleHero/arena 텍스처가 없으면 그 자리를 비우거나 단색으로 대체하고,
// 나머지 요소의 좌표는 절대 좌표(HUD.TITLE)라 한 픽셀도 움직이지 않는다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { ARENA, HUD, SCREEN, TRIALS, VISUAL } from '../config/balance';
import { armBgmOnFirstInput } from './audio';
import { toCssColor } from './colors';

export class TitleScene extends Phaser.Scene {
  private selectedIndex = 0;
  private entries: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    this.selectedIndex = 0;
    this.entries = [];

    armBgmOnFirstInput(this);

    this.buildBackground();

    this.add
      .text(SCREEN.WIDTH / 2, HUD.TITLE.TITLE_Y, '오디세이 서바이버즈', {
        fontFamily: 'sans-serif',
        fontSize: `${HUD.TITLE.TITLE_FONT_PX}px`,
        color: toCssColor(VISUAL.COLOR.TEXT),
      })
      .setOrigin(0.5);

    this.add
      .text(SCREEN.WIDTH / 2, HUD.TITLE.HINT_Y, '↑↓ 로 시련 선택, Enter/클릭으로 시작', {
        fontFamily: 'sans-serif',
        fontSize: `${HUD.TITLE.HINT_FONT_PX}px`,
        color: toCssColor(VISUAL.COLOR.TEXT_DIM),
      })
      .setOrigin(0.5);

    this.buildHero();

    TRIALS.forEach((trial, index) => {
      const y = HUD.TITLE.LIST_Y + index * HUD.TITLE.LIST_PITCH;
      const label = this.add
        .text(SCREEN.WIDTH / 2, y, trial.name, {
          fontFamily: 'sans-serif',
          fontSize: `${HUD.TITLE.LIST_NAME_FONT_PX}px`,
          color: toCssColor(VISUAL.COLOR.TEXT),
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(SCREEN.WIDTH / 2, y + HUD.TITLE.LIST_TAGLINE_DY, trial.tagline, {
          fontFamily: 'sans-serif',
          fontSize: `${HUD.TITLE.LIST_TAGLINE_FONT_PX}px`,
          color: toCssColor(VISUAL.COLOR.TEXT_DIM),
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

  /** 배경 arena.jpg(1:1, 화면 중앙 크롭) + 암막. 틴트 없음(§9-8-2 — 타이틀에는 시련이 없다). */
  private buildBackground(): void {
    if (this.textures.exists('arena')) {
      const bg = this.add.image(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2, 'arena');
      bg.setDisplaySize(ARENA.WIDTH * VISUAL.ARENA_IMAGE_SCALE, ARENA.HEIGHT * VISUAL.ARENA_IMAGE_SCALE);
    } else {
      this.add
        .rectangle(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2, SCREEN.WIDTH, SCREEN.HEIGHT, VISUAL.COLOR.ARENA_FALLBACK)
        .setOrigin(0.5);
    }

    this.add
      .rectangle(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT, 0x000000, HUD.TITLE.DIM_ALPHA)
      .setOrigin(0, 0);
  }

  /** 히어로(파생 에셋). 없으면 그 자리를 비운다 — 대체 도형을 그리지 않는다(§9-8-6). */
  private buildHero(): void {
    if (!this.textures.exists('titleHero')) return;
    const hero = this.add.image(HUD.TITLE.HERO_X, HUD.TITLE.HERO_Y, 'titleHero');
    hero.setDisplaySize(HUD.TITLE.HERO_PX, HUD.TITLE.HERO_PX);
  }

  private moveSelection(delta: number): void {
    const count = TRIALS.length;
    this.selectedIndex = (this.selectedIndex + delta + count) % count;
    this.refreshHighlight();
  }

  /** 선택 항목은 VISUAL.COLOR.XP_ORB, 비선택은 VISUAL.COLOR.TEXT (GDD §9-8-5). */
  private refreshHighlight(): void {
    this.entries.forEach((entry, index) => {
      entry.setColor(toCssColor(index === this.selectedIndex ? VISUAL.COLOR.XP_ORB : VISUAL.COLOR.TEXT));
    });
  }

  private startSelected(): void {
    const trial = TRIALS[this.selectedIndex];
    this.scene.start('Game', { trialId: trial.id });
  }
}

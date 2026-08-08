// ─────────────────────────────────────────────────────────────
// Hud.ts — GDD §8-A / §9-5 / §9-5-A의 HUD + 레벨업 3택 화면.
// sim의 상태를 읽어 그리기만 한다(하네스 3). 진행도는 state.progress를 그대로 쓴다 —
// trialProgress() 호출은 engine.ts의 evaluateOutcome() 1곳뿐이다(GDD §8-3, §8-13).
// 좌표·크기·색은 전부 balance.ts의 HUD/VISUAL에서 온다.
//
// 카메라 분리(§9-9): GameScene의 메인 카메라는 플레이어를 따라가며 줌 R이 걸려 있다.
// Phaser 카메라는 줌을 뷰포트 "중심" 기준으로 적용하므로, follow가 없는 고정 UI를
// scrollFactor(0)만으로 메인 카메라에 얹으면 화면 중심 쏠림만큼 어긋난다(실측 확인 —
// follow가 그 쏠림을 스크롤로 상쇄해 줘서 월드 오브젝트만 정상으로 보였을 뿐이다).
// 그래서 HUD는 GameScene이 별도로 만든 줌 R·원점(0,0)·스크롤 고정 카메라로만 그리고,
// 메인 카메라에서는 제외한다 — 이 파일의 모든 오브젝트가 생성 직후 `ignoreOnMain()`을 거친다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import {
  HUD,
  SCREEN,
  VISUAL,
  UPGRADE_POOL,
  xpToNextLevel,
  type TrialDef,
  type UpgradeCategory,
  type UpgradeDef,
} from '../config/balance';
import type { RunState } from '../sim';
import { toggleMute } from './audio';

const CAT_COLOR: Record<UpgradeCategory, number> = {
  fire: VISUAL.COLOR.CAT_FIRE,
  life: VISUAL.COLOR.CAT_LIFE,
  util: VISUAL.COLOR.CAT_UTIL,
};

const CAT_LABEL: Record<UpgradeCategory, string> = {
  fire: '화력',
  life: '생존',
  util: '유틸',
};

function formatTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 좌상단 원점(0,0) 고정 배경+채움 막대. 화면 좌표계(scrollFactor 0)에서만 쓴다. */
class Bar {
  private readonly fill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly w: number,
    h: number,
    bgColor: number,
    fillColor: number,
    depth: number,
  ) {
    const bg = scene.add.rectangle(x, y, w, h, bgColor).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    this.fill = scene.add.rectangle(x, y, w, h, fillColor).setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1);
    scene.cameras.main.ignore([bg, this.fill]);
  }

  setRatio(ratio: number): void {
    this.fill.width = this.w * Phaser.Math.Clamp(ratio, 0, 1);
  }
}

interface BadgeSlot {
  bg: Phaser.GameObjects.Rectangle;
  levelText: Phaser.GameObjects.Text;
}

interface ChoiceCard {
  hit: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.Rectangle;
  catLabel: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
}

export class Hud {
  private readonly scene: Phaser.Scene;

  private hpBar!: Bar;
  private xpBar!: Bar;
  private progressBar!: Bar;
  private timerText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private stepPips: Phaser.GameObjects.Rectangle[] = [];
  private stepLabel!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastHideEvent: Phaser.Time.TimerEvent | null = null;
  private fpsVisible = false;

  private bannerName!: Phaser.GameObjects.Text;
  private bannerTagline!: Phaser.GameObjects.Text;

  private badgeSlots: BadgeSlot[] = [];

  private choiceDim: Phaser.GameObjects.Rectangle | null = null;
  private choiceTitle: Phaser.GameObjects.Text | null = null;
  private choiceCards: ChoiceCard[] = [];
  private shownChoiceRef: readonly UpgradeDef[] | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** GameScene의 HUD 전용 카메라에서만 그려지도록, 월드를 따라가는 메인 카메라에서는 뺀다. */
  private ignoreOnMain(obj: Phaser.GameObjects.GameObject): void {
    this.scene.cameras.main.ignore(obj);
  }

  create(): void {
    this.buildBars();
    this.buildTimerAndKills();
    this.buildStepPips();
    this.buildBadgeSlots();
    this.buildFpsAndToast();
    this.buildBannerTexts();
    this.bindToggles();
  }

  private buildBars(): void {
    const hp = HUD.HP_BAR;
    this.hpBar = new Bar(this.scene, hp.X, hp.Y, hp.W, hp.H, VISUAL.COLOR.HP_BG, VISUAL.COLOR.HP_FILL, VISUAL.DEPTH.HUD);

    const xp = HUD.XP_BAR;
    this.xpBar = new Bar(this.scene, xp.X, xp.Y, xp.W, xp.H, VISUAL.COLOR.XP_BG, VISUAL.COLOR.XP_FILL, VISUAL.DEPTH.HUD);

    const pb = HUD.PROGRESS_BAR;
    const pbLeft = pb.X - pb.W / 2;
    this.progressBar = new Bar(
      this.scene,
      pbLeft,
      pb.Y,
      pb.W,
      pb.H,
      VISUAL.COLOR.PROGRESS_BG,
      VISUAL.COLOR.PROGRESS_FILL,
      VISUAL.DEPTH.HUD,
    );
  }

  private buildTimerAndKills(): void {
    this.timerText = this.scene.add
      .text(HUD.TIMER.X, HUD.TIMER.Y, '', { fontFamily: 'sans-serif', fontSize: `${HUD.FONT_MIN_PX}px`, color: '#f2ece0' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.timerText);

    this.killsText = this.scene.add
      .text(HUD.KILLS.X, HUD.KILLS.Y, '', { fontFamily: 'sans-serif', fontSize: `${HUD.FONT_MIN_PX}px`, color: '#f2ece0' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.killsText);
  }

  private buildStepPips(): void {
    const sp = HUD.STEP_PIPS;
    const totalW = sp.COUNT * sp.W + (sp.COUNT - 1) * sp.GAP;
    const left = sp.X - totalW / 2;

    for (let i = 0; i < sp.COUNT; i++) {
      const rect = this.scene.add
        .rectangle(left + i * (sp.W + sp.GAP), sp.Y, sp.W, sp.H, VISUAL.COLOR.PROGRESS_BG)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD);
      this.ignoreOnMain(rect);
      this.stepPips.push(rect);
    }

    this.stepLabel = this.scene.add
      .text(left + totalW + 4, sp.Y - 2, '', {
        fontFamily: 'sans-serif',
        fontSize: `${HUD.FONT_MIN_PX}px`,
        color: '#9a9184',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.stepLabel);
  }

  private buildBadgeSlots(): void {
    const b = HUD.UPGRADE_BADGES;
    for (let i = 0; i < UPGRADE_POOL.length; i++) {
      const x = b.X + i * (b.SIZE + b.GAP);
      const bg = this.scene.add
        .rectangle(x, b.Y, b.SIZE, b.SIZE, VISUAL.COLOR.CAT_FIRE)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD)
        .setVisible(false);
      const levelText = this.scene.add
        .text(x + b.SIZE / 2, b.Y + b.SIZE / 2, '', {
          fontFamily: 'sans-serif',
          fontSize: `${HUD.FONT_MIN_PX}px`,
          color: '#1a1620',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD + 1)
        .setVisible(false)
        .setResolution(SCREEN.SUPERSAMPLE);
      this.ignoreOnMain(bg);
      this.ignoreOnMain(levelText);
      this.badgeSlots.push({ bg, levelText });
    }
  }

  private buildFpsAndToast(): void {
    this.fpsText = this.scene.add
      .text(HUD.FPS.X, HUD.FPS.Y, '', { fontFamily: 'sans-serif', fontSize: `${HUD.FONT_MIN_PX}px`, color: '#9a9184' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD)
      .setVisible(false)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.fpsText);

    this.toastText = this.scene.add
      .text(HUD.TOAST.X, HUD.TOAST.Y, '', { fontFamily: 'sans-serif', fontSize: `${HUD.FONT_MIN_PX}px`, color: '#f2ece0' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD)
      .setVisible(false)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.toastText);
  }

  private buildBannerTexts(): void {
    this.bannerName = this.scene.add
      .text(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 - 10, '', {
        fontFamily: 'sans-serif',
        fontSize: `${HUD.FONT_BANNER_NAME_PX}px`,
        color: '#f2ece0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.BANNER)
      .setVisible(false)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.bannerName);

    this.bannerTagline = this.scene.add
      .text(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 10, '', {
        fontFamily: 'sans-serif',
        fontSize: `${HUD.FONT_BANNER_TAGLINE_PX}px`,
        color: '#9a9184',
        wordWrap: { width: SCREEN.WIDTH - 80 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.BANNER)
      .setVisible(false)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.bannerTagline);
  }

  private bindToggles(): void {
    this.scene.input.keyboard?.on(`keydown-${HUD.KEY_FPS}`, () => {
      this.fpsVisible = !this.fpsVisible;
      this.fpsText.setVisible(this.fpsVisible);
    });

    this.scene.input.keyboard?.on(`keydown-${HUD.KEY_MUTE}`, () => {
      const muted = toggleMute(this.scene);
      this.showToast(muted ? 'BGM OFF' : 'BGM ON');
    });
  }

  private showToast(message: string): void {
    this.toastText.setText(message).setVisible(true);
    this.toastHideEvent?.remove();
    this.toastHideEvent = this.scene.time.delayedCall(HUD.TOAST.MS, () => this.toastText.setVisible(false));
  }

  /** 판 시작 시 1회 호출. 게임 시간과 무관한(정지되지 않는) 실제 시계 기준 타이머로 사라진다. */
  showBanner(trial: TrialDef): void {
    this.bannerName.setText(trial.name).setAlpha(1).setVisible(true);
    this.bannerTagline.setText(trial.tagline).setAlpha(1).setVisible(true);

    this.scene.tweens.add({
      targets: [this.bannerName, this.bannerTagline],
      alpha: 0,
      delay: HUD.BANNER.HOLD_MS,
      duration: HUD.BANNER.FADE_MS,
      onComplete: () => {
        this.bannerName.setVisible(false);
        this.bannerTagline.setVisible(false);
      },
    });
  }

  /** 매 프레임(3택 대기 중에도) 호출해 표시값을 최신 상태로 유지한다. */
  update(state: RunState): void {
    const player = state.player;

    this.hpBar.setRatio(player.maxHp > 0 ? player.hp / player.maxHp : 0);

    const required = xpToNextLevel(player.level);
    this.xpBar.setRatio(required > 0 ? player.xp / required : 0);

    this.progressBar.setRatio(state.trial.goal > 0 ? state.progress / state.trial.goal : 0);

    this.timerText.setText(`${formatTime(state.elapsedSec)} / ${formatTime(state.trial.timeLimitSec)}`);
    this.killsText.setText(`처치 ${state.kills + state.bossKills}`);

    const filled = Phaser.Math.Clamp(state.stepIndex, 0, HUD.STEP_PIPS.COUNT);
    for (let i = 0; i < this.stepPips.length; i++) {
      this.stepPips[i].setFillStyle(i < filled ? VISUAL.COLOR.PROGRESS_FILL : VISUAL.COLOR.PROGRESS_BG);
    }
    this.stepLabel.setText(`STEP ${state.stepIndex}`);

    this.updateBadges(player.upgradeLevels);

    if (this.fpsVisible) {
      this.fpsText.setText(`${Math.round(this.scene.game.loop.actualFps)} fps`);
    }
  }

  private updateBadges(upgradeLevels: Record<string, number>): void {
    const b = HUD.UPGRADE_BADGES;
    let shown = 0;
    for (let i = 0; i < UPGRADE_POOL.length; i++) {
      const def = UPGRADE_POOL[i];
      const level = upgradeLevels[def.id] ?? 0;
      const slot = this.badgeSlots[i];
      if (level <= 0 || shown >= b.MAX) {
        slot.bg.setVisible(false);
        slot.levelText.setVisible(false);
        continue;
      }
      const x = b.X + shown * (b.SIZE + b.GAP);
      slot.bg.setPosition(x, b.Y).setFillStyle(CAT_COLOR[def.category]).setVisible(true);
      slot.levelText.setPosition(x + b.SIZE / 2, b.Y + b.SIZE / 2).setText(String(level)).setVisible(true);
      shown++;
    }
  }

  /**
   * 레벨업 3택 화면(GDD §9-5-A). choices 참조가 이전과 같으면(같은 이벤트) 다시 만들지 않는다 —
   * 매 프레임 호출돼도 카드를 재생성하지 않기 위함.
   */
  showChoices(state: RunState, choices: readonly UpgradeDef[], onPick: (id: string) => void): void {
    if (this.shownChoiceRef === choices) return;
    this.hideChoices();
    this.shownChoiceRef = choices;

    this.choiceDim = this.scene.add
      .rectangle(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT, 0x000000, HUD.CHOICE_DIM_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD);
    this.ignoreOnMain(this.choiceDim);

    this.choiceTitle = this.scene.add
      .text(SCREEN.WIDTH / 2, HUD.CHOICE_CARD.TITLE_Y, `LEVEL ${state.player.level}`, {
        fontFamily: 'sans-serif',
        fontSize: `${HUD.CHOICE_CARD.TITLE_FONT_PX}px`,
        color: '#f2ece0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(VISUAL.DEPTH.HUD)
      .setResolution(SCREEN.SUPERSAMPLE);
    this.ignoreOnMain(this.choiceTitle);

    const card = HUD.CHOICE_CARD;
    const totalW = choices.length * card.W + (choices.length - 1) * card.GAP;
    const left = SCREEN.WIDTH / 2 - totalW / 2;

    choices.forEach((def, index) => {
      const x = left + index * (card.W + card.GAP);
      const y = card.Y;

      const hit = this.scene.add
        .rectangle(x, y, card.W, card.H, VISUAL.COLOR.ARENA_FALLBACK)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD)
        .setStrokeStyle(1, CAT_COLOR[def.category])
        .setInteractive({ useHandCursor: true });

      const badge = this.scene.add
        .rectangle(x + 8, y + 8, card.BADGE_SIZE, card.BADGE_SIZE, CAT_COLOR[def.category])
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD + 1);

      const catLabel = this.scene.add
        .text(x + 8 + card.BADGE_SIZE + 4, y + 8 + card.BADGE_SIZE / 2, CAT_LABEL[def.category], {
          fontFamily: 'sans-serif',
          fontSize: `${card.SUB_FONT_PX}px`,
          color: '#9a9184',
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD + 1)
        .setResolution(SCREEN.SUPERSAMPLE);

      const nameText = this.scene.add
        .text(x + card.W / 2, y + 34, def.name, {
          fontFamily: 'sans-serif',
          fontSize: `${card.NAME_FONT_PX}px`,
          color: '#f2ece0',
          align: 'center',
          wordWrap: { width: card.W - 16 },
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD + 1)
        .setResolution(SCREEN.SUPERSAMPLE);

      const nextLevel = (state.player.upgradeLevels[def.id] ?? 0) + 1;
      const levelText = this.scene.add
        .text(x + card.W / 2, y + card.H - 14, `Lv.${nextLevel}`, {
          fontFamily: 'sans-serif',
          fontSize: `${card.SUB_FONT_PX}px`,
          color: '#9a9184',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(VISUAL.DEPTH.HUD + 1)
        .setResolution(SCREEN.SUPERSAMPLE);

      hit.on('pointerdown', () => onPick(def.id));

      this.ignoreOnMain(hit);
      this.ignoreOnMain(badge);
      this.ignoreOnMain(catLabel);
      this.ignoreOnMain(nameText);
      this.ignoreOnMain(levelText);

      this.choiceCards.push({ hit, badge, catLabel, nameText, levelText });
    });
  }

  hideChoices(): void {
    this.shownChoiceRef = null;
    this.choiceDim?.destroy();
    this.choiceDim = null;
    this.choiceTitle?.destroy();
    this.choiceTitle = null;
    for (const c of this.choiceCards) {
      c.hit.destroy();
      c.badge.destroy();
      c.catLabel.destroy();
      c.nameText.destroy();
      c.levelText.destroy();
    }
    this.choiceCards = [];
  }
}

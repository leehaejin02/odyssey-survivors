// ─────────────────────────────────────────────────────────────
// GameScene.ts — sim의 상태를 그리기만 한다(하네스 3). 게임 규칙 판정은 전부 src/sim/에 있다.
// HUD(§8-A)와 3택 화면(§9-5-A)은 Hud.ts에 위임한다. 배경은 background.ts에 위임한다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { ARENA, SCREEN, TRIALS, VISUAL, type EnemyTypeId } from '../config/balance';
import { createRunState, resolveUpgradeChoice, stepRun, type RunState, type Vec2 } from '../sim';
import { createEntityView, type EntityKind, type EntityView } from './sprites';
import { createArenaBackground } from './background';
import { Hud } from './Hud';

interface GameSceneData {
  trialId: string;
}

const ENEMY_KIND: Record<EnemyTypeId, EntityKind> = {
  grunt: 'grunt',
  brute: 'brute',
  boss: 'boss',
};

export class GameScene extends Phaser.Scene {
  private runState!: RunState;
  private finished = false;
  private hud!: Hud;
  // HUD 전용 카메라(§9-9). 메인 카메라는 플레이어를 따라가며 줌 R이 걸려 있고, Phaser 카메라는
  // 줌을 뷰포트 중심 기준으로 적용하므로 follow가 없는 고정 UI를 메인 카메라에 얹으면 화면
  // 중심 쏠림만큼 어긋난다(실측 확인). 그래서 줌 R·원점(0,0)·스크롤 고정인 별도 카메라로 HUD만 그린다.
  private hudCamera!: Phaser.Cameras.Scene2D.Camera;

  private playerView!: EntityView;
  private enemyViews: (EntityView | null)[] = [];
  private enemyViewKinds: (EntityKind | null)[] = [];
  private projectileViews: Phaser.GameObjects.Rectangle[] = [];
  private orbViews: Phaser.GameObjects.Arc[] = [];

  private keys!: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    const trial = TRIALS.find((t) => t.id === data.trialId) ?? TRIALS[0];
    // 실제 사람 플레이는 재현성이 필요 없다(입력 자체가 결정론적이지 않다) — 시드는 매 판 새로 뽑는다.
    // sim 내부에서는 이 시드를 그대로 소비할 뿐, Math.random()은 sim 어디서도 호출하지 않는다.
    const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
    this.runState = createRunState(trial, seed);
    this.finished = false;
    this.enemyViews = [];
    this.enemyViewKinds = [];
    this.projectileViews = [];
    this.orbViews = [];
  }

  create(): void {
    const arenaObjects = createArenaBackground(this, this.runState.trial);
    this.cameras.main.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
    // 백킹스토어가 SCREEN.SUPERSAMPLE(R)배라 카메라 줌도 R로 맞춰야 카메라가 보여 주는 월드 영역이
    // 480x270로 유지된다(GDD §9-9, D40) — 백킹 R배와 줌 R배가 상쇄된다.
    this.cameras.main.setZoom(SCREEN.SUPERSAMPLE);

    // HUD 전용 카메라. 월드 카메라와 같은 화면을 덮되 절대 스크롤하지 않고(원점 0,0 + 줌 R만),
    // 월드 오브젝트는 이 카메라에서 제외한다 — 그래야 HUD가 이중으로 그려지지 않는다.
    this.hudCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.hudCamera.setZoom(SCREEN.SUPERSAMPLE);
    this.hudCamera.setOrigin(0, 0);
    this.hudCamera.ignore(arenaObjects);

    this.playerView = createEntityView(this, 'player', this.runState.player.x, this.runState.player.y);
    this.hudCamera.ignore(this.playerView);
    this.cameras.main.startFollow(this.playerView, true, 0.15, 0.15);

    this.hud = new Hud(this);
    this.hud.create();
    this.hud.showBanner(this.runState.trial);

    const keyboard = this.input.keyboard;
    this.keys = {
      w: keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.cursors = keyboard!.createCursorKeys();
  }

  update(_time: number, deltaMs: number): void {
    if (this.finished) return;

    if (this.runState.pendingChoice) {
      this.hud.update(this.runState);
      this.hud.showChoices(this.runState, this.runState.pendingChoice, (id) => this.pickChoice(id));
      return;
    }
    this.hud.hideChoices();

    const dt = Math.min(deltaMs, 100); // 탭 전환 등 큰 델타로 인한 스파이크 방지(밸런스 값 아님)
    const input = this.readMoveInput();
    stepRun(this.runState, input, dt);
    this.syncViews();
    this.hud.update(this.runState);

    if (this.runState.result !== 'playing') {
      this.finished = true;
      this.scene.start('Result', {
        cleared: this.runState.result === 'cleared',
        trialName: this.runState.trial.name,
        elapsedSec: this.runState.elapsedSec,
        kills: this.runState.kills + this.runState.bossKills,
        level: this.runState.player.level,
      });
    }
  }

  private pickChoice(id: string): void {
    resolveUpgradeChoice(this.runState, id);
    this.hud.hideChoices();
  }

  private readMoveInput(): Vec2 {
    let x = 0;
    let y = 0;
    if (this.keys.a.isDown || this.cursors.left?.isDown) x -= 1;
    if (this.keys.d.isDown || this.cursors.right?.isDown) x += 1;
    if (this.keys.w.isDown || this.cursors.up?.isDown) y -= 1;
    if (this.keys.s.isDown || this.cursors.down?.isDown) y += 1;
    return { x, y };
  }

  private syncViews(): void {
    this.playerView.setPosition(this.runState.player.x, this.runState.player.y);
    this.syncEnemies();
    this.syncProjectiles();
    this.syncOrbs();
  }

  private syncEnemies(): void {
    const enemies = this.runState.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.active) {
        this.enemyViews[i]?.setVisible(false);
        continue;
      }
      const kind = ENEMY_KIND[enemy.type];
      if (!this.enemyViews[i] || this.enemyViewKinds[i] !== kind) {
        this.enemyViews[i]?.destroy();
        this.enemyViews[i] = createEntityView(this, kind, enemy.x, enemy.y);
        this.hudCamera.ignore(this.enemyViews[i]!);
        this.enemyViewKinds[i] = kind;
      }
      const view = this.enemyViews[i]!;
      view.setVisible(true);
      view.setPosition(enemy.x, enemy.y);
    }
  }

  private syncProjectiles(): void {
    const projectiles = this.runState.projectiles;
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!this.projectileViews[i]) {
        const rect = this.add.rectangle(0, 0, VISUAL.SHAPE_PX.arrowLen, VISUAL.SHAPE_PX.arrowWidth, VISUAL.COLOR.ARROW);
        rect.setDepth(VISUAL.DEPTH.ARROW);
        rect.setVisible(false);
        this.hudCamera.ignore(rect);
        this.projectileViews[i] = rect;
      }
      const view = this.projectileViews[i];
      if (!p.active) {
        view.setVisible(false);
        continue;
      }
      view.setVisible(true);
      view.setPosition(p.x, p.y);
      view.setRotation(Math.atan2(p.vy, p.vx));
    }
  }

  private syncOrbs(): void {
    const orbs = this.runState.xpOrbs;
    for (let i = 0; i < orbs.length; i++) {
      const orb = orbs[i];
      if (!this.orbViews[i]) {
        const circle = this.add.circle(0, 0, VISUAL.SHAPE_PX.xpOrb / 2, VISUAL.COLOR.XP_ORB);
        circle.setDepth(VISUAL.DEPTH.XP_ORB);
        circle.setVisible(false);
        this.hudCamera.ignore(circle);
        this.orbViews[i] = circle;
      }
      const view = this.orbViews[i];
      if (!orb.active) {
        view.setVisible(false);
        continue;
      }
      view.setVisible(true);
      view.setPosition(orb.x, orb.y);
    }
  }
}

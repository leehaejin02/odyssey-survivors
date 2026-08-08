// ─────────────────────────────────────────────────────────────
// GameScene.ts — sim의 상태를 그리기만 한다(하네스 3). 게임 규칙 판정은 전부 src/sim/에 있다.
// HUD(§8-A)와 3택 화면(§9-5-A)은 Hud.ts에 위임한다. 배경은 background.ts에 위임한다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { ARENA, TRIALS, VISUAL, type EnemyTypeId } from '../config/balance';
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
    createArenaBackground(this, this.runState.trial);
    this.cameras.main.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    this.playerView = createEntityView(this, 'player', this.runState.player.x, this.runState.player.y);
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

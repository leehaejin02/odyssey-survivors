// ─────────────────────────────────────────────────────────────
// engine.ts — 코어 루프의 단일 진실. Phaser 의존 없음.
// GameScene(브라우저)과 headless.ts(npm run sim) 둘 다 이 파일의 stepRun()만 호출한다.
//
// 결정론: RNG는 state.rng(시드 고정) 하나만 쓰고, 소비 순서가 매 틱 항상 같은 순서
// (스폰 → 3택 후보 추첨)로 고정돼 있어야 "같은 시드 → 같은 결과"가 성립한다.
//
// 일시정지 모델(GDD에 명시가 없어 tech가 정함 — 보고 대상):
// - pendingChoice(3택 대기)가 있으면 stepRun은 시간을 진행시키지 않는다.
//   시련 시작 배너(§9-5)만 "배너 중에도 시간이 흐른다"고 명시돼 있고, 3택 화면은 언급이 없다.
//   장르 관례(레벨업 선택 중 정지)를 따랐다. 헤드리스 봇은 지연 없이 즉시 선택하므로
//   측정값(§6)에는 영향이 없다 — 정지 여부가 관측 가능한 차이를 만들지 않는다.
// ─────────────────────────────────────────────────────────────

import {
  ARENA,
  ENEMIES,
  PLAYER,
  WEAPON_BOW,
  SPAWN,
  trialProgress,
  xpToNextLevel,
  type EnemyTypeId,
  type TrialDef,
} from '../config/balance';
import { clamp, type Vec2 } from './math';
import { acquireSlot } from './pool';
import { createRng } from './rng';
import {
  computeEnemyHpMul,
  computeEnemySpeedMul,
  computeSpawnIntervalMs,
  computeStepIndex,
  pickRegularEnemyType,
  spawnPointOutsideView,
} from './spawn';
import type { EnemyRuntime, PlayerRuntime, ProjectileRuntime, RunState, XpOrbRuntime } from './types';
import { applyUpgrade, buildUpgradeChoices } from './upgrades';

export function createRunState(trial: TrialDef, seed: number): RunState {
  const rng = createRng(seed);

  const player: PlayerRuntime = {
    x: ARENA.WIDTH / 2,
    y: ARENA.HEIGHT / 2,
    hp: PLAYER.MAX_HP,
    maxHp: PLAYER.MAX_HP,
    level: 1,
    xp: 0,
    iframeRemainingMs: 0,
    iframeMs: PLAYER.IFRAME_MS,
    damage: WEAPON_BOW.DAMAGE,
    cooldownMs: WEAPON_BOW.COOLDOWN_MS,
    projectiles: WEAPON_BOW.PROJECTILES,
    pierce: WEAPON_BOW.PIERCE,
    moveSpeed: PLAYER.MOVE_SPEED,
    pickupRadius: PLAYER.PICKUP_RADIUS,
    fireCooldownRemainingMs: 0,
    upgradeLevels: {},
  };

  return {
    trial,
    seed,
    rng,
    elapsedSec: 0,
    stepIndex: 0,
    kills: 0,
    bossKills: 0,
    totalSpawned: 0,
    bossSpawned: false,
    spawnTimerMs: computeSpawnIntervalMs(trial, 0),
    levelUpsCount: 0,
    maxAliveSeen: 0,
    player,
    enemies: [],
    projectiles: [],
    xpOrbs: [],
    pendingChoice: null,
    result: 'playing',
    deathCause: undefined,
  };
}

/**
 * 한 틱 진행. moveInput은 정규화 전 방향 벡터(예: WASD 조합, 대각선은 내부에서 정규화된다).
 * 결과가 'playing'이 아니거나 pendingChoice가 있으면 아무것도 하지 않고 그대로 반환한다
 * (호출자는 resolveUpgradeChoice로 먼저 선택을 해소해야 한다).
 */
export function stepRun(state: RunState, moveInput: Vec2, dtMs: number): RunState {
  if (state.result !== 'playing') return state;
  if (state.pendingChoice) return state;

  const dtSec = dtMs / 1000;
  state.elapsedSec += dtSec;
  state.stepIndex = computeStepIndex(state.elapsedSec);

  movePlayer(state, moveInput, dtSec);
  state.player.iframeRemainingMs = Math.max(0, state.player.iframeRemainingMs - dtMs);

  spawnEnemies(state, dtMs);
  spawnBossIfDue(state);
  updateEnemies(state, dtSec);
  fireWeapon(state, dtMs);
  updateProjectiles(state, dtSec);
  handlePlayerContact(state);
  handlePickups(state);

  const leveled = tryLevelUp(state);
  state.maxAliveSeen = Math.max(state.maxAliveSeen, countActive(state.enemies));

  if (leveled) return state;

  evaluateOutcome(state);
  return state;
}

/** 3택 중 하나를 확정 적용하고 대기를 해제한다. */
export function resolveUpgradeChoice(state: RunState, upgradeId: string): void {
  if (!state.pendingChoice) return;
  const def = state.pendingChoice.find((d) => d.id === upgradeId);
  state.pendingChoice = null;
  if (def) applyUpgrade(state.player, def);
}

export function countActive(list: readonly { active: boolean }[]): number {
  let n = 0;
  for (const item of list) if (item.active) n++;
  return n;
}

// ── 내부 단계 함수들 ─────────────────────────────────────────

function movePlayer(state: RunState, input: Vec2, dtSec: number): void {
  const len = Math.hypot(input.x, input.y);
  const dir = len > 1e-6 ? { x: input.x / len, y: input.y / len } : { x: 0, y: 0 };
  const p = state.player;
  p.x = clamp(p.x + dir.x * p.moveSpeed * dtSec, PLAYER.RADIUS, ARENA.WIDTH - PLAYER.RADIUS);
  p.y = clamp(p.y + dir.y * p.moveSpeed * dtSec, PLAYER.RADIUS, ARENA.HEIGHT - PLAYER.RADIUS);
}

function makeEmptyEnemy(): EnemyRuntime {
  return { active: false, type: 'grunt', x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, contactDamage: 0, radius: 0, xp: 0 };
}

function makeEmptyProjectile(): ProjectileRuntime {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    remainingPierce: 0,
    traveled: 0,
    maxRange: 0,
    hitEnemySlots: new Set<number>(),
  };
}

function spawnOneEnemy(state: RunState, type: EnemyTypeId): void {
  const base = ENEMIES[type];
  const hpMul = computeEnemyHpMul(state.trial, state.stepIndex);
  const speedMul = computeEnemySpeedMul(state.trial, state.stepIndex);
  const pos = spawnPointOutsideView(state.rng, state.player);

  const slot = acquireSlot(state.enemies, makeEmptyEnemy);
  slot.active = true;
  slot.type = type;
  slot.x = pos.x;
  slot.y = pos.y;
  slot.maxHp = base.HP * hpMul;
  slot.hp = slot.maxHp;
  slot.speed = base.SPEED * speedMul;
  slot.contactDamage = base.CONTACT_DAMAGE;
  slot.radius = base.RADIUS;
  slot.xp = base.XP;
}

function spawnEnemies(state: RunState, dtMs: number): void {
  state.spawnTimerMs -= dtMs;
  let guard = 0;
  while (state.spawnTimerMs <= 0 && guard < 10000) {
    guard++;
    state.spawnTimerMs += computeSpawnIntervalMs(state.trial, state.stepIndex);

    for (let i = 0; i < SPAWN.BATCH; i++) {
      if (countActive(state.enemies) >= SPAWN.MAX_ALIVE) break;
      if (state.totalSpawned >= state.trial.spawnTotalCap) break;
      spawnOneEnemy(state, pickRegularEnemyType(state.rng, state.trial));
      state.totalSpawned += 1;
    }
  }
}

function spawnBossIfDue(state: RunState): void {
  const t = state.trial;
  if (state.bossSpawned) return;
  if (t.bossSpawnSec > t.timeLimitSec) return; // 999 등 = 이 판엔 보스가 없다
  if (state.elapsedSec < t.bossSpawnSec) return;
  spawnOneEnemy(state, 'boss');
  state.bossSpawned = true;
}

function updateEnemies(state: RunState, dtSec: number): void {
  const player = state.player;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-6) {
      e.x += (dx / dist) * e.speed * dtSec;
      e.y += (dy / dist) * e.speed * dtSec;
    }
  }
}

function findNearestEnemyInRange(state: RunState, origin: Vec2, range: number): EnemyRuntime | null {
  let best: EnemyRuntime | null = null;
  let bestDist = range;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(origin.x - e.x, origin.y - e.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  return best;
}

function fireWeapon(state: RunState, dtMs: number): void {
  const player = state.player;
  const target = findNearestEnemyInRange(state, player, WEAPON_BOW.RANGE);
  if (!target) return; // 사거리 내 적이 없으면 쿨다운도 흐르지 않는다(WEAPON_BOW.AIM 규칙)

  player.fireCooldownRemainingMs -= dtMs;
  if (player.fireCooldownRemainingMs > 0) return;

  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const count = Math.max(1, Math.round(player.projectiles));
  const spreadRad = (WEAPON_BOW.SPREAD_DEG * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spreadRad;
    const angle = baseAngle + offset;
    const slot = acquireSlot(state.projectiles, makeEmptyProjectile);
    slot.active = true;
    slot.x = player.x;
    slot.y = player.y;
    slot.vx = Math.cos(angle) * WEAPON_BOW.PROJECTILE_SPEED;
    slot.vy = Math.sin(angle) * WEAPON_BOW.PROJECTILE_SPEED;
    slot.damage = player.damage;
    slot.remainingPierce = Math.max(0, Math.round(player.pierce));
    slot.traveled = 0;
    slot.maxRange = WEAPON_BOW.RANGE;
    slot.hitEnemySlots.clear();
  }

  player.fireCooldownRemainingMs += player.cooldownMs;
}

function applyDamageToEnemy(state: RunState, enemy: EnemyRuntime, damage: number): void {
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    enemy.active = false;
    spawnXpOrb(state, enemy.x, enemy.y, enemy.xp);
    if (enemy.type === 'boss') state.bossKills += 1;
    else state.kills += 1;
  }
}

function spawnXpOrb(state: RunState, x: number, y: number, value: number): void {
  const orb = acquireSlot<XpOrbRuntime>(state.xpOrbs, () => ({ active: false, x: 0, y: 0, value: 0 }));
  orb.active = true;
  orb.x = x;
  orb.y = y;
  orb.value = value;
}

function updateProjectiles(state: RunState, dtSec: number): void {
  for (const p of state.projectiles) {
    if (!p.active) continue;

    const stepDist = Math.hypot(p.vx, p.vy) * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.traveled += stepDist;

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (!e.active || p.hitEnemySlots.has(i)) continue;
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      if (dist <= e.radius) {
        p.hitEnemySlots.add(i);
        applyDamageToEnemy(state, e, p.damage);
        if (p.remainingPierce <= 0) {
          p.active = false;
        } else {
          p.remainingPierce -= 1;
        }
        break; // 한 틱에 한 발당 한 명중만 처리(관통은 다음 틱들에 걸쳐 이어진다)
      }
    }

    if (p.active && p.traveled >= p.maxRange) {
      p.active = false;
    }
  }
}

function handlePlayerContact(state: RunState): void {
  const player = state.player;
  if (player.iframeRemainingMs > 0) return;

  for (const e of state.enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist <= PLAYER.RADIUS + e.radius) {
      player.hp = Math.max(0, player.hp - e.contactDamage);
      player.iframeRemainingMs = player.iframeMs;
      if (player.hp <= 0) {
        state.result = 'dead';
        state.deathCause = 'hp';
      }
      break; // iframe이 한 틱 내 다중 접촉을 흡수한다(PLAYER.IFRAME_MS 근거 주석과 일치)
    }
  }
}

function handlePickups(state: RunState): void {
  const player = state.player;
  for (const orb of state.xpOrbs) {
    if (!orb.active) continue;
    const dist = Math.hypot(player.x - orb.x, player.y - orb.y);
    if (dist <= player.pickupRadius) {
      orb.active = false;
      player.xp += orb.value;
    }
  }
}

function tryLevelUp(state: RunState): boolean {
  const player = state.player;
  const required = xpToNextLevel(player.level);
  if (player.xp < required) return false;

  player.xp -= required;
  player.level += 1;
  state.levelUpsCount += 1;

  const choices = buildUpgradeChoices(state.rng, player.upgradeLevels);
  if (choices.length > 0) {
    state.pendingChoice = choices;
    return true;
  }
  return false;
}

function evaluateOutcome(state: RunState): void {
  if (state.result !== 'playing') return;

  const progress = trialProgress(state.trial, state.elapsedSec, state.kills, state.bossKills);
  if (progress >= state.trial.goal) {
    state.result = 'cleared';
    return;
  }
  if (state.elapsedSec > state.trial.timeLimitSec) {
    state.result = 'dead';
    state.deathCause = 'timeout';
  }
}

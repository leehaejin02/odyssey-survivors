// ─────────────────────────────────────────────────────────────
// spawn.ts — 스폰 압력 곡선(§4) + 스폰 위치 계산. 전부 balance.ts 수치로만 구성된다.
// ─────────────────────────────────────────────────────────────

import { ARENA, ENEMY_TYPE_IDS, SPAWN, type EnemyTypeId, type TrialDef } from '../config/balance';
import { clamp, type Vec2 } from './math';
import { nextInt, nextRange, pickWeightedIndex, type Rng } from './rng';

/** 10초 = 1스텝(SPAWN.STEP_SEC). */
export function computeStepIndex(elapsedSec: number): number {
  return Math.floor(elapsedSec / SPAWN.STEP_SEC);
}

/** 스폰 간격(ms). 스텝마다 곱연산 감소, 하한 SPAWN.INTERVAL_MIN_MS. */
export function computeSpawnIntervalMs(trial: TrialDef, step: number): number {
  const raw = SPAWN.INTERVAL_MS * trial.spawnIntervalMul * Math.pow(SPAWN.INTERVAL_MUL_PER_STEP, step);
  return Math.max(SPAWN.INTERVAL_MIN_MS, raw);
}

/** 적 HP 배율. 스텝마다 가산(§4 근거 주석: 90초=9스텝에 2.08배). */
export function computeEnemyHpMul(trial: TrialDef, step: number): number {
  return trial.enemyHpMul * (1 + SPAWN.HP_ADD_PER_STEP * step);
}

/** 적 속도 배율. 스텝마다 가산하되 SPAWN.SPEED_MUL_MAX에서 상한. */
export function computeEnemySpeedMul(trial: TrialDef, step: number): number {
  return trial.enemySpeedMul * Math.min(SPAWN.SPEED_MUL_MAX, 1 + SPAWN.SPEED_ADD_PER_STEP * step);
}

/**
 * 정규 스폰(비-보스)에서 나올 적 종류를 뽑는다. spawnWeights[2](boss)는 GDD상 항상 0이고
 * 보스는 bossSpawnSec 이벤트로만 등장하므로 여기서는 grunt/brute 두 인덱스만 후보로 쓴다.
 */
export function pickRegularEnemyType(rng: Rng, trial: TrialDef): EnemyTypeId {
  const weights = [trial.spawnWeights[0], trial.spawnWeights[1]];
  const idx = pickWeightedIndex(rng, weights);
  return ENEMY_TYPE_IDS[idx];
}

/**
 * 화면 밖 스폰 위치(§1 "적은 화면 밖 24px에서 생성").
 * "화면"은 렌더 축 SCREEN(480x270)이지만 sim은 렌더 상수를 읽지 않는다(balance.ts 구획 주석).
 * ARENA.WIDTH/HEIGHT 자체가 "논리 해상도 480x270의 2x2"로 정의돼 있으므로(balance.ts 주석),
 * 카메라 뷰 크기를 ARENA 절반으로 유도해 SCREEN을 참조하지 않고도 같은 수치를 얻는다.
 */
export function spawnPointOutsideView(rng: Rng, player: Vec2): Vec2 {
  const viewW = ARENA.WIDTH / 2;
  const viewH = ARENA.HEIGHT / 2;
  const margin = ARENA.SPAWN_MARGIN_PX;

  const camX0 = clamp(player.x - viewW / 2, 0, ARENA.WIDTH - viewW);
  const camY0 = clamp(player.y - viewH / 2, 0, ARENA.HEIGHT - viewH);
  const camX1 = camX0 + viewW;
  const camY1 = camY0 + viewH;

  const side = nextInt(rng, 4); // 0=top 1=bottom 2=left 3=right
  let x: number;
  let y: number;
  if (side === 0) {
    x = nextRange(rng, camX0 - margin, camX1 + margin);
    y = camY0 - margin;
  } else if (side === 1) {
    x = nextRange(rng, camX0 - margin, camX1 + margin);
    y = camY1 + margin;
  } else if (side === 2) {
    x = camX0 - margin;
    y = nextRange(rng, camY0 - margin, camY1 + margin);
  } else {
    x = camX1 + margin;
    y = nextRange(rng, camY0 - margin, camY1 + margin);
  }

  return {
    x: clamp(x, 0, ARENA.WIDTH),
    y: clamp(y, 0, ARENA.HEIGHT),
  };
}

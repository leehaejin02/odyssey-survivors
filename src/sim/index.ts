// ─────────────────────────────────────────────────────────────
// index.ts — sim 공개 API 배럴. 씬(src/scenes)과 headless 러너는 여기서만 import한다.
// ─────────────────────────────────────────────────────────────

export { createRunState, resolveUpgradeChoice, stepRun, countActive } from './engine';
export { createBotState, decideBotMovement, decideBotUpgrade } from './bot';
export { runOnce } from './headless';
export type { RunSummary } from './headless';
export { computeTrialMetrics } from './metrics';
export type { TrialMetrics } from './metrics';
export { createRng } from './rng';
export type {
  DeathCause,
  EnemyRuntime,
  PlayerRuntime,
  ProjectileRuntime,
  RunResultKind,
  RunState,
  XpOrbRuntime,
} from './types';
export type { Vec2 } from './math';

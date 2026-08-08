// ─────────────────────────────────────────────────────────────
// types.ts — sim 내부 런타임 상태 타입. Phaser 의존 없음.
// balance.ts의 정적 데이터(TrialDef, UpgradeDef 등)와는 별개로,
// "지금 이 판이 어떤 상태인가"를 담는 가변 상태만 정의한다.
// ─────────────────────────────────────────────────────────────

import type { EnemyTypeId, TrialDef, UpgradeDef } from '../config/balance';
import type { Rng } from './rng';

export type RunResultKind = 'playing' | 'cleared' | 'dead';
export type DeathCause = 'hp' | 'timeout' | undefined;

/** 플레이어의 "현재" 유효 스탯. 3택으로 계속 갱신된다(기본값은 WEAPON_BOW/PLAYER에서 시딩). */
export interface PlayerRuntime {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  /** 남은 피격 무적 시간(ms). 0이면 무적 아님. */
  iframeRemainingMs: number;
  /** 피격 시 부여되는 무적 지속시간(ms). ATHENA_GRACE로 누적된다. */
  iframeMs: number;
  damage: number;
  cooldownMs: number;
  projectiles: number;
  pierce: number;
  moveSpeed: number;
  pickupRadius: number;
  /** 발사 쿨다운 잔여(ms). 사거리 내 적이 없으면 흐르지 않는다(WEAPON_BOW.AIM 규칙). */
  fireCooldownRemainingMs: number;
  /** 업그레이드 id → 현재 선택 횟수(레벨). */
  upgradeLevels: Record<string, number>;
}

export interface EnemyRuntime {
  active: boolean;
  type: EnemyTypeId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  radius: number;
  xp: number;
}

export interface ProjectileRuntime {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** 남은 관통 횟수. 0이면 다음 명중 후 소멸. */
  remainingPierce: number;
  traveled: number;
  maxRange: number;
  /** 이미 명중한 적 슬롯 인덱스(같은 화살이 같은 적을 두 번 때리지 않도록). */
  hitEnemySlots: Set<number>;
}

export interface XpOrbRuntime {
  active: boolean;
  x: number;
  y: number;
  value: number;
}

export interface RunState {
  trial: TrialDef;
  seed: number;
  rng: Rng;

  elapsedSec: number;
  stepIndex: number;

  kills: number;
  bossKills: number;
  totalSpawned: number;
  bossSpawned: boolean;
  spawnTimerMs: number;

  /**
   * trialProgress()의 마지막 계산값. **호출은 evaluateOutcome() 1곳뿐**(GDD §8-3) —
   * HUD는 이 필드를 읽기만 하고, 진행도를 스스로 재계산하지 않는다.
   */
  progress: number;

  levelUpsCount: number;
  maxAliveSeen: number;

  player: PlayerRuntime;
  enemies: EnemyRuntime[];
  projectiles: ProjectileRuntime[];
  xpOrbs: XpOrbRuntime[];

  /** 레벨업으로 제시된 3택. 존재하는 동안 stepRun은 시간을 진행시키지 않는다(일시정지). */
  pendingChoice: UpgradeDef[] | null;

  result: RunResultKind;
  deathCause: DeathCause;
}

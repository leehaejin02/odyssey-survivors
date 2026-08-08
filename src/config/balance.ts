// ─────────────────────────────────────────────────────────────
// balance.ts — 모든 밸런스 수치의 유일한 원본 (gd 소유)
// 하네스 2: 여기 밖에 수치를 박지 않는다.
// 각 상수에는 "왜 이 값인가" 1줄 근거가 붙는다. 근거 없는 수치는 다음 세션에 재논의된다.
// 원본 기획: docs/GDD.md
// ─────────────────────────────────────────────────────────────

// ── 공간 ──────────────────────────────────────────────────────
export const ARENA = {
  /** 논리 해상도 480x270의 2x2. 화면 밖으로 도망칠 여지는 주되 무한 도주는 막는다(이동만 조작이라 공간이 유일한 난이도원). */
  WIDTH: 960,
  /** 위와 동일 근거. 가로:세로 비를 화면과 같게 두어 카메라 추적 시 벽 노출이 대칭이 된다. */
  HEIGHT: 540,
  /** 적은 화면 밖 이 거리에서 생성된다. 화면(480x270)의 대각 절반(≈275)보다 짧으면 눈앞에 튀어나온다. */
  SPAWN_MARGIN_PX: 24,
} as const;

// ── 플레이어 ──────────────────────────────────────────────────
export const PLAYER = {
  /** 적 최고속(brute 20 * 시간배율 1.35 = 27)의 2배 이상. 도주가 항상 가능해야 "포위"가 난이도가 된다. */
  MOVE_SPEED: 60,
  /** grunt 접촉 8뎀 기준 12.5회 피격 여유. 첫 실수로 즉사하지 않되 방치하면 8초 내 사망. */
  MAX_HP: 100,
  /** 히트박스 반경(px). 480x270에서 8px 스프라이트 기준. */
  RADIUS: 4,
  /** 피격 무적 시간(ms). 접촉 지속 시 초당 최대 1.67회 피격 = 초당 13.3뎀(grunt). 7.5초 접촉 = 사망. */
  IFRAME_MS: 600,
  /** 경험치 오브 자동 흡수 반경(px). 플레이어 반경의 4.5배. 회수를 위해 적 쪽으로 들어가는 판단이 남을 만큼만. */
  PICKUP_RADIUS: 18,
} as const;

// ── 무기: 오디세우스의 활 (무기 종류 상한 = 1종) ───────────────
export const WEAPON_BOW = {
  /** 초기 DPS 6/0.55 = 10.9. grunt HP 10을 1발에 잡되 brute(34)는 6발 필요 — 적 종류 차이가 초반부터 체감된다. */
  DAMAGE: 6,
  /** 발사 주기(ms). 초당 1.8발. 초기 스폰(1.11마리/s)보다 빨라 첫 30초는 처치가 스폰을 앞선다. */
  COOLDOWN_MS: 550,
  /** 동시 발사 투사체 수. 1에서 시작해 TWIN_SHOT으로만 늘어난다(3택의 성장 체감 담당). */
  PROJECTILES: 1,
  /** 다중 발사 시 투사체 간 각도(도). 15도면 사거리 140px 끝에서 약 36px 벌어져 군집에 고르게 박힌다. */
  SPREAD_DEG: 15,
  /** 관통 횟수(추가 관통 적 수). 0 = 첫 명중에 소멸. PIERCING 업그레이드의 기준점. */
  PIERCE: 0,
  /** 투사체 속도(px/s). 적 최고속의 6배 이상이라 회피당하지 않는다. */
  PROJECTILE_SPEED: 160,
  /** 사거리(px). 화면 폭 480의 약 29%. 화면 끝 적은 못 잡으므로 "적을 끌어들이는" 위치 판단이 남는다. */
  RANGE: 140,
  /** 조준 규칙: 사거리 내 최근접 적. 사거리 내 적이 없으면 발사하지 않는다(쿨다운도 흐르지 않음). */
  AIM: 'nearest' as const,
} as const;

// ── 적 (종류 상한 = 3종. 인덱스는 TRIAL.spawnWeights와 1:1 대응) ──
export const ENEMY_TYPE_IDS = ['grunt', 'brute', 'boss'] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];

export const ENEMIES = {
  /** 구혼자/부하. 활 1발에 죽는 기준 적 — 모든 화력 수치의 분모다. */
  grunt: {
    HP: 10,
    /** 플레이어 60의 57%. 직선 도주로는 절대 안 잡히고 포위될 때만 위협이 된다. */
    SPEED: 34,
    /** 접촉 피해. MAX_HP 100 / 8 = 12.5회 피격 여유. */
    CONTACT_DAMAGE: 8,
    RADIUS: 4,
    /** 경험치. 레벨업 곡선의 기준 단위 1. */
    XP: 1,
  },
  /** 로토파고이(연꽃에 취한 자). 느리지만 단단해 화력 부족을 즉시 드러낸다. */
  brute: {
    /** grunt의 3.4배. 초기 화력으로 6발(3.3초) — 다수가 오면 반드시 밀린다. */
    HP: 34,
    /** 플레이어의 33%. 회피는 쉽지만 화면에 계속 쌓여 공간을 먹는다. */
    SPEED: 20,
    /** grunt의 1.75배. 한 번 갇히면 7회 피격에 사망. */
    CONTACT_DAMAGE: 14,
    RADIUS: 6,
    /** HP 3.4배 대비 3배. 단단한 적을 잡는 편이 살짝 손해 — 회피 선택지를 남긴다. */
    XP: 3,
  },
  /** 폴리페모스. "체력 많은 적 1기"로만 표현된다. 고유 패턴 없음(하루 안에 튜닝 불가). */
  boss: {
    /** 등장 시점(30초) 예상 DPS 22 기준 약 32초 소모 → 총 62초. 목표 판 길이 90초 안에 들어온다. */
    HP: 700,
    /** 플레이어의 27%. 계속 도망칠 수 있어야 "체력 많은 적 1기"가 성립한다. */
    SPEED: 16,
    /** 4회 피격에 사망. 보스에게 닿는 것 자체가 판을 끝내야 위압감이 생긴다. */
    CONTACT_DAMAGE: 25,
    /** 화면(270 높이)의 5%. 한눈에 잡몹과 구분되는 최소 크기. */
    RADIUS: 14,
    /** 판당 1기뿐이라 레벨 1~2개 분량을 몰아 준다. */
    XP: 30,
  },
} as const;

// ── 스폰 압력 (긴장의 유일한 출처) ─────────────────────────────
export const SPAWN = {
  /** 난이도 스텝 길이(초). 90초 판 = 9스텝. 플레이어가 "또 늘었다"를 판당 9번 느낀다. */
  STEP_SEC: 10,
  /** 초기 스폰 간격(ms). 1.11마리/s < 초기 처치율 1.8마리/s. 첫 스텝은 반드시 이긴다. */
  INTERVAL_MS: 900,
  /** 스텝마다 간격 배율. 90초 시점 0.92^9 = 0.472 → 425ms(2.35마리/s). 처치율 성장과 경주시킨다. */
  INTERVAL_MUL_PER_STEP: 0.92,
  /** 간격 하한(ms). 4.5마리/s. 이 아래는 봇·사람 모두 화력과 무관하게 압사한다. */
  INTERVAL_MIN_MS: 220,
  /** 적 HP 가산 배율(스텝당). 90초에 2.08배. 화력 성장(3택)이 없으면 반드시 밀리도록. */
  HP_ADD_PER_STEP: 0.12,
  /** 적 속도 가산 배율(스텝당). HP보다 완만 — 속도가 오르면 도주 자체가 불가능해져 조작이 무의미해진다. */
  SPEED_ADD_PER_STEP: 0.03,
  /** 속도 배율 상한. 1.35배에서 brute 27, grunt 46 < 플레이어 60. 도주 가능성을 끝까지 보장한다. */
  SPEED_MUL_MAX: 1.35,
  /** 동시 생존 적 수 상한. 480x270에 90마리는 화면당 약 22마리 — 성능 상한이자 시각적 상한. */
  MAX_ALIVE: 90,
  /** 한 번의 스폰 이벤트에서 나오는 마릿수. 1이면 압력 증가가 간격 하나로만 표현돼 곡선이 단순하다. */
  BATCH: 1,
} as const;

// ── 성장 곡선 ─────────────────────────────────────────────────
export const XP_CURVE = {
  /** 레벨 2까지 필요한 XP. grunt 5마리 = 약 4초. 첫 3택을 5초 안에 보여 준다(코어 루프 조기 노출). */
  BASE: 5,
  /** 레벨당 요구량 배율. 누적(레벨13까지) = 213 XP ≈ 90초 판의 예상 총 획득량. 판당 12레벨을 겨냥. */
  GROWTH: 1.25,
} as const;

/** 레벨 n → n+1 요구 XP. BASE * GROWTH^(n-1) 반올림. */
export function xpToNextLevel(level: number): number {
  return Math.round(XP_CURVE.BASE * Math.pow(XP_CURVE.GROWTH, level - 1));
}

// ── 레벨업 3택 ────────────────────────────────────────────────
export const UPGRADE_CATEGORIES = ['fire', 'life', 'util'] as const;
export type UpgradeCategory = (typeof UPGRADE_CATEGORIES)[number];

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  /** 0 = 무제한 반복 가능 */
  maxLevel: number;
  stat: string;
  /** 'add' = 가산, 'mulPct' = 현재값에 (1+v) 곱, 'pct' = 최대치 대비 비율 */
  mode: 'add' | 'mulPct' | 'pct';
  value: number;
}

/**
 * 선택지 풀 = 9종 (화력 4 / 생존 3 / 유틸 2).
 * 3택 구성 규칙: 화력 1 + 생존 1 + 유틸 1을 각 카테고리에서 뽑는다.
 * 해당 카테고리에 만렙 아닌 후보가 없으면 남은 카테고리에서 보충한다.
 * → "3개가 전부 공격력 +%"인 화면이 구조적으로 나올 수 없다.
 */
export const UPGRADE_POOL: readonly UpgradeDef[] = [
  // 화력 — 같은 "세지기"라도 축이 다르다(단발 위력 / 탄 수 / 속도 / 관통)
  { id: 'SHARP_BRONZE', name: '청동 촉', category: 'fire', maxLevel: 5, stat: 'damage', mode: 'mulPct', value: 0.25 },
  { id: 'TWIN_SHOT', name: '쌍둥이 화살', category: 'fire', maxLevel: 3, stat: 'projectiles', mode: 'add', value: 1 },
  { id: 'SWIFT_HAND', name: '빠른 손', category: 'fire', maxLevel: 4, stat: 'cooldown', mode: 'mulPct', value: -0.15 },
  { id: 'PIERCING', name: '관통 화살', category: 'fire', maxLevel: 3, stat: 'pierce', mode: 'add', value: 1 },
  // 생존
  { id: 'HIDE_ARMOR', name: '가죽 갑옷', category: 'life', maxLevel: 4, stat: 'maxHp', mode: 'add', value: 20 },
  { id: 'ATHENA_GRACE', name: '아테나의 가호', category: 'life', maxLevel: 3, stat: 'iframeMs', mode: 'add', value: 200 },
  { id: 'NECTAR', name: '넥타르', category: 'life', maxLevel: 0, stat: 'healPct', mode: 'pct', value: 0.4 },
  // 유틸
  { id: 'HERMES_SANDAL', name: '헤르메스의 샌들', category: 'util', maxLevel: 4, stat: 'moveSpeed', mode: 'mulPct', value: 0.12 },
  { id: 'WIDE_EYE', name: '먼눈', category: 'util', maxLevel: 3, stat: 'pickupRadius', mode: 'mulPct', value: 0.4 },
];

// ── 시련 3종 (차이는 이 데이터 행 3개로만 표현된다. 분기 금지) ──
export interface TrialDef {
  id: string;
  name: string;
  /** 오디세이아다움은 이름 + 이 한 줄까지다. 컷신·대사·NPC는 WON'T. */
  tagline: string;
  /** 클리어 판정: progress >= goal */
  goal: number;
  /** progress 가중치: 생존 초 */
  wTime: number;
  /** progress 가중치: 일반 적 처치 수 */
  wKill: number;
  /** progress 가중치: 보스 처치 수 */
  wBossKill: number;
  /** 이 시각(초)에 보스 1기 생성. 999 = 이 판에는 보스가 없다(제한시간 180 밖). */
  bossSpawnSec: number;
  /** 누적 스폰 총량 상한. 이 수만큼 나오면 더 이상 스폰하지 않는다. 9999 = 사실상 무제한. */
  spawnTotalCap: number;
  /** [grunt, brute, boss] 스폰 확률 가중치. boss는 항상 0(보스는 bossSpawnSec으로만 등장). */
  spawnWeights: readonly [number, number, number];
  /** 전역 스폰 간격에 곱한다. */
  spawnIntervalMul: number;
  /** 전역 적 HP에 곱한다. */
  enemyHpMul: number;
  /** 전역 적 속도에 곱한다. */
  enemySpeedMul: number;
  /** 제한시간(초). 초과 시 미클리어 패배. 3종 공통이라 분기가 아니다. */
  timeLimitSec: number;
  /**
   * 배경(arena.png 또는 폴백 사각형)에 곱하는 틴트(0xRRGGBB).
   * 시련 3종의 시각 구분은 **이 필드 하나로만** 낸다. 배경 이미지를 시련마다 만들면
   * 에셋이 3배가 되고, 씬에 시련 id 분기가 생겨 GDD §8-2("시련 id 분기 0개")를 깬다.
   * 곱연산이라 값이 작을수록 어두워진다. **각 채널 >= 0x70** — 그 아래는 배경이 검게 뭉쳐
   * 적 90마리의 실루엣 경계가 사라진다.
   * 렌더 전용이며 sim은 이 값을 읽지 않는다(밸런스 재측정 대상 아님).
   */
  bgTint: number;
}

export const TRIAL_TARGET_SEC = 90; // 한 판 목표 길이. 근거는 GDD 「목표 지표」 참조.

export const TRIALS: readonly TrialDef[] = [
  {
    id: 'polyphemos',
    name: '키클롭스의 동굴',
    tagline: '외눈의 거인이 입구를 막았다. 이름 없는 자로 빠져나가라.',
    // 보스 1기 처치 = goal 1. 잡몹 처치는 progress에 기여하지 않는다.
    goal: 1, wTime: 0, wKill: 0, wBossKill: 1,
    bossSpawnSec: 30,
    spawnTotalCap: 9999,
    spawnWeights: [0.7, 0.3, 0],
    /** 보스에 화력을 쏟아야 하므로 잡몹 압력을 25% 낮춘다. */
    spawnIntervalMul: 1.25,
    enemyHpMul: 1.0,
    enemySpeedMul: 1.0,
    timeLimitSec: 180,
    /** 동굴 = 차가운 청회색. 3종 중 가장 어둡게(밝기 약 0.62) 두어 보스의 호박색 단안이 유일한 발광원이 된다. */
    bgTint: 0x8090b8,
  },
  {
    id: 'lotophagoi',
    name: '연꽃 먹는 자들의 해안',
    tagline: '꽃을 문 자들이 느리게 걸어온다. 90초만 잊히지 마라.',
    // 90초 생존 = goal 90, wTime 1.
    goal: 90, wTime: 1, wKill: 0, wBossKill: 0,
    bossSpawnSec: 999,
    spawnTotalCap: 9999,
    spawnWeights: [0.3, 0.7, 0],
    /** 느리고 단단한 적이 주력이라 수가 많아야 공간이 좁아진다. */
    spawnIntervalMul: 0.85,
    /** brute 위주에 +15%. 화력 성장을 안 고르면 90초 안에 못 치운다. */
    enemyHpMul: 1.15,
    /** 취한 자들. 느림이 이 시련의 성격. */
    enemySpeedMul: 0.85,
    timeLimitSec: 180,
    /** 해안 = 바랜 모래빛. 3종 중 가장 밝아(약 0.76) 흙적·자주색 brute가 배경에서 확실히 떨어진다. */
    bgTint: 0xc8c090,
  },
  {
    id: 'suitors',
    name: '이타카의 홀',
    tagline: '내 집에 낯선 자 백여덟. 활은 하나뿐이다.',
    // 108명 섬멸 = goal 108, wKill 1. 스폰 총량도 108로 고정해 "고정 수량 섬멸"이 된다.
    goal: 108, wTime: 0, wKill: 1, wBossKill: 0,
    bossSpawnSec: 999,
    spawnTotalCap: 108,
    spawnWeights: [1.0, 0, 0],
    /** 108기를 90초 안에 다 내보내려면 평균 간격이 짧아야 한다. */
    spawnIntervalMul: 0.75,
    /** 수로 압박하는 시련이라 개체는 무르게. */
    enemyHpMul: 0.9,
    /** 구혼자는 젊다. 유일하게 플레이어를 실제로 추격하는 조합. */
    enemySpeedMul: 1.1,
    timeLimitSec: 180,
    /** 홀 = 횃불빛 적동색. 주황 grunt 108기와 색이 가까우므로 채도를 낮춰(약 0.72) 인물이 배경에 먹히지 않게 한다. */
    bgTint: 0xc08870,
  },
];

/**
 * 클리어 판정 — 3종 공통. 시련별 if 분기가 하나도 없다.
 * 이 함수가 늘어나면 시련 선택이 틀린 것이다.
 */
export function trialProgress(
  t: TrialDef,
  elapsedSec: number,
  kills: number,
  bossKills: number,
): number {
  return elapsedSec * t.wTime + kills * t.wKill + bossKills * t.wBossKill;
}

// ── 봇 정책 (playtest 재현성의 근거. 바꾸면 과거 측정값과 비교 불가) ──
export const BOT = {
  /**
   * 3택 선택: 제시된 3개 중 이 배열에서 인덱스가 가장 작은 것을 고른다.
   * 단 NECTAR는 현재 HP < MAX_HP * NECTAR_HP_THRESHOLD 일 때만 최우선(index -1),
   * 아니면 최하위(index +∞)로 취급한다. 무작위 선택 없음 = 시드 고정 시 완전 재현.
   */
  PICK_PRIORITY: [
    'TWIN_SHOT',
    'SHARP_BRONZE',
    'SWIFT_HAND',
    'HIDE_ARMOR',
    'PIERCING',
    'HERMES_SANDAL',
    'ATHENA_GRACE',
    'WIDE_EYE',
    'NECTAR',
  ] as readonly string[],
  /** 이 비율 미만이면 넥타르를 1순위로 올린다. 절반은 "초보도 위험을 알아채는" 지점. */
  NECTAR_HP_THRESHOLD: 0.5,
  /** 봇 반응 지연(ms). 완벽한 봇은 밸런스를 왜곡한다(playtest.md). */
  REACTION_DELAY_MS: 300,
} as const;

// ── 목표 지표 (docs/GDD.md 및 .claude/agents/playtest.md와 글자 그대로 같아야 한다) ──
export const TARGET_METRICS = {
  /** 측정 조건: 시련별 200회, 시드 고정, 봇 정책 = 위 BOT. */
  RUNS_PER_TRIAL: 200,
  /** 시련별 클리어율 [하한, 상한]. 하한 미만 = 못 깨는 게임, 상한 초과 = 긴장 없음. */
  CLEAR_RATE: [0.35, 0.7] as const,
  /** 사망한 판의 생존 시간 중앙값 / TRIAL_TARGET_SEC. 0.45 미만이면 초반 붕괴, 0.85 초과면 마지막 순간만 어렵다. */
  DEATH_TIME_RATIO_MEDIAN: [0.45, 0.85] as const,
  /** 30초 이전 사망 비율 상한. 첫 3택 이후 곧바로 죽는 판이 이보다 많으면 초기 압력 과다. */
  EARLY_DEATH_RATE_MAX: 0.15,
  /** 판당 레벨업 횟수 중앙값. 8 미만이면 3택(유일한 결정)이 거의 안 뜬다. */
  LEVELUPS_MEDIAN: [8, 14] as const,
  /** 판 평균 초당 처치 수. 화력 대비 스폰의 프록시. */
  KILLS_PER_SEC_MEAN: [1.0, 4.0] as const,
  /** 동시 최대 적 수 p95 상한. SPAWN.MAX_ALIVE와 같다. 상시 상한에 붙으면 스폰 곡선이 잘린 것. */
  MAX_ALIVE_P95_MAX: 90,
  /** 도달 난이도 스텝(10초=1) 중앙값. 5~9는 판 길이 90초의 50~100% 지점. */
  REACHED_STEP_MEDIAN: [5, 9] as const,
  /** 클리어한 판의 클리어 시각 중앙값 상한(초) = TRIAL_TARGET_SEC * 1.3. */
  CLEAR_TIME_MEDIAN_MAX_SEC: 117,
} as const;

// ═══════════════════════════════════════════════════════════════
// 이 아래는 **렌더 축**이다. sim은 아래 상수를 하나도 읽지 않는다.
// → 값을 바꿔도 §6 목표 지표가 변하지 않는다 = playtest 재측정 대상이 아니다.
// 히트박스는 위쪽 PLAYER.RADIUS / ENEMIES.*.RADIUS 그대로다. 표시 크기와 분리돼 있다.
// ═══════════════════════════════════════════════════════════════

// ── 화면 (동결. D14) ──────────────────────────────────────────
export const SCREEN = {
  /** 논리 해상도. balance.ts 근거 주석의 절반이 "화면 대비 비율"이라(사거리 140 = 폭의 29%,
   *  보스 반경 14 = 높이의 5%, 흡수 반경 18) 이 값을 바꾸면 밸런스를 전부 다시 재야 한다. 동결. */
  WIDTH: 480,
  HEIGHT: 270,
} as const;

// ── 스프라이트 표시 크기 (히트박스와 분리) ─────────────────────
export const VISUAL = {
  /**
   * 표시 크기(px, 정사각 한 변). **항상 히트박스 지름보다 크다** —
   * 보이는 것보다 작게 맞아야 억울한 피격이 없다. 반대 방향(히트박스 > 스프라이트)은 금지.
   * 근거의 기준은 "SPAWN.MAX_ALIVE = 90이 전부 화면에 들어온 최악의 경우 화면 점유율".
   * 화면 면적 = 480*270 = 129,600 px².
   */
  SPRITE_PX: {
    /** 히트박스 지름 8의 2.25배. 유일한 청록 개체이자 항상 최상위 depth(아래 DEPTH.PLAYER)라
     *  90마리 속에서도 절대 가려지지 않는다. 22까지 올리면 brute와 크기가 같아져 색 없이는 구분이 안 된다. */
    player: 18,
    /** 히트박스 지름 8의 1.75배. 90마리 전부 화면에 들어와도 14²×90 = 17,640px² = 화면의 13.6%.
     *  16으로 올리면 17.8%가 되어 배경(= 시련 구분의 유일한 수단)을 덮는다. */
    grunt: 14,
    /** 히트박스 지름 12의 1.83배. grunt의 1.57배 — 색을 못 봐도 크기만으로 "두꺼운 놈"이 갈린다. */
    brute: 22,
    /** 히트박스 지름 28의 1.43배. 화면 높이의 14.8%, grunt의 2.86배.
     *  보스는 고유 패턴이 0개(D5)라 위압감의 표현 수단이 크기뿐이다. */
    boss: 40,
  },
  /**
   * 코드 도형으로만 그리는 것들(에셋 생성 대상이 아니다).
   * 12px 이하에서는 손그림과 코드 도형이 구분되지 않으므로 PNG를 만들 이유가 없다.
   */
  SHAPE_PX: {
    /** 경험치 오브 지름. 흡수 반경 18의 1/6 — "밟아야" 먹는 게 아니라 "근처면" 먹는다는 걸 크기로 알린다. */
    xpOrb: 3,
    /** 화살 길이. 투사체 속도 160 = 60fps에서 프레임당 2.7px 이동. 그보다 길어야 궤적이 끊겨 보이지 않는다. */
    arrowLen: 6,
    arrowWidth: 2,
  },
  /**
   * 그리는 순서. 값이 큰 쪽이 위.
   * PLAYER가 모든 적보다 위 = "적 90마리에 파묻혀 내가 어디 있는지 모르겠다"가 구조적으로 불가능해진다.
   */
  DEPTH: {
    ARENA: 0,
    XP_ORB: 10,
    ENEMY: 20,
    BOSS: 25,
    ARROW: 30,
    PLAYER: 40,
    BANNER: 90,
    HUD: 100,
  },
  /** arena.png는 1920×1080 = ARENA(960×540)의 정확히 2배라 이 배율로 1장을 통째로 깐다(타일링·이음매 없음). */
  ARENA_IMAGE_SCALE: 0.5,
  /** 배경 폴백 격자 간격(px). 플레이어 속도 60 = 초당 2.5칸 통과 — 이동감이 생기는 최소 밀도. */
  ARENA_GRID_PX: 24,
  /** 피격 시 스프라이트 흰색 플래시 지속(ms). IFRAME_MS 600의 1/5 — 무적 상태를 다 덮지 않아 "아직 무적인가"를 헷갈리지 않게 한다. */
  HIT_FLASH_MS: 120,
  /**
   * 색. 원칙: **플레이어·내 것 = 차가운 색 / 적 = 따뜻한 색.**
   * 적색상 도기화 양식에서 90마리를 구분할 유일한 수단이 색상환 반대편 배치다.
   */
  COLOR: {
    PLAYER: 0x4fd8c8,
    PLAYER_ACCENT: 0xe8f4f0,
    GRUNT: 0xd97b3c,
    BRUTE: 0x8b5a7a,
    BOSS: 0xd8cdb4,
    /** 보스 단안. 화면에서 가장 밝은 점 하나 = 시선이 자동으로 보스로 간다. */
    BOSS_EYE: 0xffb020,
    /** 경험치 오브·화살은 플레이어 계열(차가운 색). "내가 낸 것"과 "적"의 이분법을 색으로 고정한다. */
    XP_ORB: 0x9fe8ff,
    ARROW: 0xe8f4f0,
    /** arena.png가 없을 때의 폴백 바탕. 적색상 도기의 검은 바탕에 해당한다. */
    ARENA_FALLBACK: 0x1a1620,
    ARENA_GRID: 0x2a2430,
    HP_FILL: 0xd0453c,
    HP_BG: 0x3a1e1c,
    XP_FILL: 0x9fe8ff,
    XP_BG: 0x1e2a33,
    PROGRESS_FILL: 0xf0d890,
    PROGRESS_BG: 0x33301e,
    /** 3택 배지 = 카테고리 3색. UPGRADE_CATEGORIES와 키가 1:1 대응한다(아이콘 PNG를 만들지 않는 이유). */
    CAT_FIRE: 0xe06a3a,
    CAT_LIFE: 0x54c06a,
    CAT_UTIL: 0x5aa8e0,
    TEXT: 0xf2ece0,
    TEXT_DIM: 0x9a9184,
  },
} as const;

// ── HUD (앵커는 논리 해상도 480×270 기준. 화면 좌표계이며 카메라를 따라가지 않는다) ──
export const HUD = {
  /** 화면 가장자리 여백. 정수배 스케일에서 1px이 잘려도 정보가 사라지지 않는 최소값. */
  MARGIN: 6,
  /** 본문 최소 폰트(px). 6px 한글은 정수배 스케일에서도 획(1px)이 소실된다(카피바라에서 실측). 그 아래로 내리지 않는다. */
  FONT_MIN_PX: 8,
  FONT_BANNER_NAME_PX: 14,
  FONT_BANNER_TAGLINE_PX: 8,
  /** 좌상단. HP는 "지금 죽는가"라 시선 기본 위치(좌상단)에 둔다. 폭 84 = 화면 폭의 17.5%. */
  HP_BAR: { X: 6, Y: 6, W: 84, H: 6 },
  /** HP 바 바로 아래. 레벨업(유일한 결정)의 예고라 HP와 같은 컬럼에 붙인다. */
  XP_BAR: { X: 6, Y: 15, W: 84, H: 4 },
  /** 상단 중앙 정렬. "경과 / 제한시간(180초)" 형식. 웨이브 타이머가 아니다 — 이 게임에 웨이브 개념은 없다. */
  TIMER: { X: 240, Y: 4 },
  /** 상단 중앙. trialProgress()가 돌려준 값 하나만 그린다. 유일한 승리 조건이라 중앙에 둔다. 폭 140 = 화면 폭의 29%. */
  PROGRESS_BAR: { X: 240, Y: 14, W: 140, H: 5 },
  /** 난이도 스텝 인디케이터. SPAWN.STEP_SEC(10초)=1칸, 9칸 = 목표 판 길이 90초. 9칸을 넘으면 숫자만 올라간다. */
  STEP_PIPS: { X: 240, Y: 22, COUNT: 9, W: 6, H: 3, GAP: 2 },
  /** 우상단 우측 정렬. 진행도 바 우단(x=310)과 겹치지 않는다. */
  KILLS: { X: 474, Y: 6 },
  /** 좌하단부터 우측으로 나열. 12px 정사각 = 카테고리 색 + 스택 수 숫자. 9종 전부여도 9*(12+2)=126px. */
  UPGRADE_BADGES: { X: 6, Y: 252, SIZE: 12, GAP: 2, MAX: 9 },
  /** 우하단 우측 정렬. 기본 OFF — 심사자 화면에 디버그 숫자가 떠 있으면 안 된다. */
  FPS: { X: 474, Y: 258 },
  /** 음소거 토글 등 1회성 알림. 이 시간 뒤 사라진다. */
  TOAST: { X: 474, Y: 246, MS: 1200 },
  /** 시련 시작 배너(name + tagline). 표시 유지 후 페이드. **배너 중에도 게임 시간은 흐른다** —
   *  일시정지를 넣으면 sim(배너를 모른다)과 브라우저의 경과 시간이 달라져 밸런스 측정이 무효가 된다. */
  BANNER: { HOLD_MS: 2500, FADE_MS: 500 },
  /** fps 표시 토글 키. */
  KEY_FPS: 'F',
  /** 음소거 토글 키. 게임 조작(이동)이 WASD/방향키라 충돌하지 않는 글자를 골랐다. */
  KEY_MUTE: 'M',
} as const;

// ── 오디오 ────────────────────────────────────────────────────
export const AUDIO = {
  /** BGM은 1곡뿐. 곡을 늘리면 전환 규칙이라는 축이 생기고 용량이 곡 수만큼 는다. 타이틀·시련 3종·결과 화면 공통. */
  BGM_PATH: 'audio/bgm.mp3',
  /** mp3 = Chrome/Safari/Firefox 전부 코덱 추가 없이 재생. ogg는 Safari에서 보장되지 않는다. */
  BGM_FORMAT: 'mp3',
  /** 루프 목표 길이(초). 한 판 90초라 60초면 판당 이음매가 1번만 노출된다. 30초면 반복이 들킨다. */
  BGM_TARGET_SEC: 60,
  BGM_MAX_SEC: 90,
  /** 기본 음량. 심사자가 이어폰으로 링크를 열었을 때 놀라지 않는 선. */
  BGM_VOLUME: 0.5,
  /** 브라우저 자동재생 차단 때문에 첫 사용자 입력 전에는 소리를 낼 수 없다. 타이틀의 첫 입력에서 시작한다. */
  START_ON_FIRST_INPUT: true,
  /** 효과음은 만들지 않는다(WON'T). 피격/발사/처치 3종은 곱셈 축이고, 발사는 초당 1.8회라 소음이 된다. */
  SFX_ENABLED: false,
} as const;

// ── 에셋 예산 (웹 배포 = 첫 로딩이 심사자의 첫인상) ────────────
export const ASSETS = {
  /** 생성 이미지 상한. 이 5장을 넘기면 사용자 생성 시간이 그대로 개발 시간에서 빠진다. */
  MAX_IMAGE_FILES: 5,
  /** 생성 오디오 상한. */
  MAX_AUDIO_FILES: 1,
  /** 이미지 5장 합계 상한(KB). 1920×1080 arena.png가 대부분을 먹는다(약 1000KB 배정). */
  MAX_IMAGE_TOTAL_KB: 1500,
  /** BGM 1곡 상한(KB). mp3 128kbps × 90초 ≈ 1400KB. 여유 포함. */
  MAX_AUDIO_TOTAL_KB: 2000,
  /** public/ 전체 상한(KB). 20Mbps에서 첫 로드 약 1.6초 — 심사자가 흰 화면을 의심하기 전에 뜬다. */
  MAX_TOTAL_KB: 4000,
  /**
   * 고정 경로. **하나라도 없으면 코드 도형/무음 폴백으로 대체하고 게임은 정상 진행한다.**
   * 도착 우선순위: player > grunt > arena > boss > brute (뒤쪽이 끝내 안 와도 제출 가능해야 한다).
   */
  PATHS: {
    player: 'sprites/player.png',
    grunt: 'sprites/grunt.png',
    brute: 'sprites/brute.png',
    boss: 'sprites/boss.png',
    arena: 'assets/arena.png',
    bgm: 'audio/bgm.mp3',
  },
} as const;

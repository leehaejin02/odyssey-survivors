// prep-assets.mjs — 생성 원본(오디세이/)을 public/ 규격으로 변환한다.
//
// 왜 필요한가:
//   1) 나노바나나 계열 출력은 알파가 없다. "투명 배경"이 체커보드 픽셀로 그려져 온다(rgb24).
//      → 테두리에서 flood fill 해 배경만 지운다. 색 임계값만 쓰면 보스의 뼈색·플레이어의
//        크림색 갑옷에 구멍이 뚫린다. 연결성으로 지워야 안전하다.
//   2) 2560px 원본을 14~40px로 표시하면 최대 1/64 축소다. pixelArt:true는 NEAREST라
//      런타임 축소만으로는 뭉갠다. → 여기서 Lanczos로 미리 줄인다.
//   3) 투명 영역의 RGB가 흰색인 채로 축소하면 가장자리에 흰 테가 생긴다(알파 미고려 평균).
//      → 축소 전에 캐릭터 색을 투명 영역으로 번지게 한다(알파 블리드).
//
// 의존성 0개. 이미지 입출력은 ffmpeg raw 파이프, 픽셀 연산은 순수 JS다(하네스 8).
//
// 사용: node scripts/prep-assets.mjs [--src <원본폴더>] [--keep-watermarked]

import { spawn } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const SRC = path.resolve(ROOT, argOf('--src') ?? '오디세이');
const KEEP_WM = args.includes('--keep-watermarked');

function argOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

// ── 변환 대상 ────────────────────────────────────────────────
// px 는 **월드 단위**(balance.ts 의 VISUAL.SPRITE_PX)다. 실제 출력 픽셀은 여기에 R 을 곱한다.
//
// R = SCREEN.SUPERSAMPLE (balance.ts, D40). 백킹스토어가 480R x 270R 이고 카메라 줌이 R 이라
// 카메라가 보여주는 월드 영역은 480x270 그대로다(D14 보존). 스프라이트를 월드 14단위로 그리되
// 텍스처를 14R px 로 넣으면 텍셀:물리픽셀이 1:1 이 되어 선명해진다.
//
// 원본(balance.ts)이 바뀌면 여기를 맞춘다. 반대가 아니다.
const R = 3;
const SPRITES = [
  // 1차 생성물(오디세우스 플레이어 스프라이트.png)은 DeeVid AI 워터마크가 박혀 배포에서 뺐다.
  // 워터마크가 바운딩 박스를 우상단으로 늘려 크롭까지 망가졌다. 원본은 출처 증빙으로 남겨 둔다.
  { key: 'player', src: '오디세우스 플레이어 스프라이트2.png', out: 'public/sprites/player.png', px: 34 * R },
  { key: 'grunt',  src: '그리스 구혼자 적 스프라이트.png',     out: 'public/sprites/grunt.png',  px: 20 * R },
  { key: 'brute',  src: '로터스이터 적 스프라이트.png',        out: 'public/sprites/brute.png',  px: 30 * R },
  { key: 'boss',   src: '폴리페모스 보스 스프라이트.png',      out: 'public/sprites/boss.png',   px: 56 * R },
  // 타이틀 화면 전용. 인게임 player.png(월드 34)를 확대하면 뭉개지므로 원본에서 따로 뽑는다.
  // 128px = 논리 해상도 높이 270의 47%. 제목·조작안내·시련 3종 목록이 들어갈 자리를 남기는 상한이다.
  // 새 생성물이 아니라 player 와 같은 원본에서 파생된 것이라 ASSET_CREDITS 행이 늘지 않는다.
  { key: 'titleHero', src: '오디세우스 플레이어 스프라이트2.png', out: 'public/sprites/title-hero.png', px: 128 * R },
];

// 배경 판정: 아주 밝고(min>222) 거의 무채색(채널 폭<14)인 픽셀만 후보.
// 실측 체커보드 = rgb(254,254,254) / rgb(238,238,238).
const BG_MIN_LEVEL = 222;
const BG_MAX_SPREAD = 14;
/** 실측 체커보드 두 톤. 갇힌 주머니 판별에만 쓴다(테두리 flood fill 은 위 느슨한 기준을 쓴다). */
const CHECKER_LIGHT = 254;
const CHECKER_DARK = 238;
const CHECKER_TOL = 6;
const CHECKER_NEUTRAL_TOL = 6;
/** 축소 시 흰 테를 막기 위해 캐릭터 색을 투명 영역으로 번지게 할 거리(px, 2560 기준). */
const BLEED_PX = 24;
/** 잘라낸 캐릭터 주변에 남길 여백 비율. 0이면 스프라이트가 타일 경계에 딱 붙어 답답하다. */
const CROP_PAD_RATIO = 0.04;

function run(cmd, cmdArgs, stdinBuf) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { windowsHide: true });
    const out = [], err = [];
    p.stdout.on('data', (c) => out.push(c));
    p.stderr.on('data', (c) => err.push(c));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${cmd} exit ${code}\n${Buffer.concat(err)}`));
      resolve(Buffer.concat(out));
    });
    if (stdinBuf) { p.stdin.on('error', () => {}); p.stdin.end(stdinBuf); }
    else p.stdin.end();
  });
}

async function probeSize(file) {
  const out = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file,
  ]);
  const [w, h] = String(out).trim().split(',').map(Number);
  return { w, h };
}

const readRGB = (file) =>
  run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);

/**
 * 테두리에서 시작하는 flood fill. 배경으로 이어진 밝은 무채색만 지운다.
 * 캐릭터 내부의 흰 갑옷·뼈색은 테두리와 연결돼 있지 않으므로 살아남는다.
 */
function floodFillBackground(rgb, w, h) {
  const n = w * h;
  const alpha = new Uint8Array(n).fill(255);
  const seen = new Uint8Array(n);
  const isBg = (i) => {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn >= BG_MIN_LEVEL && mx - mn <= BG_MAX_SPREAD;
  };
  // Uint32Array 큐 — 6.5M 픽셀에서 배열 shift()는 O(n²)가 된다.
  const queue = new Uint32Array(n);
  let head = 0, tail = 0;
  const push = (i) => { if (!seen[i] && isBg(i)) { seen[i] = 1; alpha[i] = 0; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // ── 갇힌 체커보드 주머니 ──────────────────────────────────────
  // 테두리 flood fill 은 "둘러싸인" 배경을 못 지운다. 오디세우스의 활과 활시위
  // 사이가 그렇다 — 18px 에서는 뭉쳐서 안 보였지만 128px 타이틀에서 격자가 드러났다.
  //
  // 그렇다고 색만 보고 전역으로 지우면 보스의 뼈색 몸통에 구멍이 뚫린다.
  // 판별 기준: 체커보드는 **두 톤이 반드시 함께** 나타난다(밝은 254, 어두운 238).
  // 캐릭터의 흰 하이라이트는 한 톤뿐이다. 그래서 남은 덩어리를 훑어
  // **두 톤을 모두 가진 덩어리만** 지운다.
  const near = (v, t) => Math.abs(v - t) <= CHECKER_TOL;
  const tone = (i) => {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > CHECKER_NEUTRAL_TOL) return 0;
    if (near(r, CHECKER_LIGHT)) return 1;
    if (near(r, CHECKER_DARK)) return 2;
    return 0;
  };
  let pockets = 0;
  for (let s = 0; s < n; s++) {
    if (seen[s] || !tone(s)) continue;
    const comp = [];
    let tones = 0;
    seen[s] = 1; queue[0] = s; head = 0; tail = 1;
    while (head < tail) {
      const i = queue[head++];
      comp.push(i);
      tones |= tone(i);
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || seen[j] || !tone(j)) continue;
        seen[j] = 1; queue[tail++] = j;
      }
    }
    if (tones === 3) {                 // 밝은 톤과 어두운 톤을 모두 가진 = 체커보드
      for (const i of comp) alpha[i] = 0;
      pockets++;
    }
  }
  return { alpha, pockets };
}

/** 투명 영역으로 이웃한 불투명 색을 번지게 한다. 축소 시 흰 테를 막는 유일한 방법이다. */
function bleedEdges(rgb, alpha, w, h, iterations) {
  const solid = Uint8Array.from(alpha);
  let frontier = [];
  for (let i = 0; i < w * h; i++) if (solid[i]) frontier.push(i);
  for (let it = 0; it < iterations && frontier.length; it++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || solid[j]) continue;
        solid[j] = 1;                       // 색만 채운다. alpha 는 건드리지 않는다.
        rgb[j * 3] = rgb[i * 3];
        rgb[j * 3 + 1] = rgb[i * 3 + 1];
        rgb[j * 3 + 2] = rgb[i * 3 + 2];
        next.push(j);
      }
    }
    frontier = next;
  }
}

function opaqueBounds(alpha, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

async function prepSprite(spec) {
  const srcPath = path.join(SRC, spec.src);
  const { w, h } = await probeSize(srcPath);
  const rgb = await readRGB(srcPath);
  if (rgb.length !== w * h * 3) throw new Error(`${spec.key}: raw 길이 불일치`);

  const { alpha, pockets } = floodFillBackground(rgb, w, h);
  let cleared = 0;
  for (let i = 0; i < alpha.length; i++) if (!alpha[i]) cleared++;

  const b = opaqueBounds(alpha, w, h);
  if (!b) throw new Error(`${spec.key}: 불투명 픽셀이 없다 — 배경 판정이 전부 먹었다`);

  bleedEdges(rgb, alpha, w, h, BLEED_PX);

  // 정사각으로 맞춘다. 종횡비가 틀어지면 표시 px 계산(화면 점유율)이 무의미해진다.
  const cw = b.x1 - b.x0 + 1, ch = b.y1 - b.y0 + 1;
  const pad = Math.round(Math.max(cw, ch) * CROP_PAD_RATIO);
  let side = Math.max(cw, ch) + pad * 2;
  let cx = Math.round(b.x0 + cw / 2 - side / 2);
  let cy = Math.round(b.y0 + ch / 2 - side / 2);
  side = Math.min(side, w, h);
  cx = Math.max(0, Math.min(cx, w - side));
  cy = Math.max(0, Math.min(cy, h - side));

  const rgba = Buffer.allocUnsafe(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2]; rgba[i * 4 + 3] = alpha[i];
  }

  const outPath = path.join(ROOT, spec.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await run('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', 'pipe:0',
    '-vf', `crop=${side}:${side}:${cx}:${cy},scale=${spec.px}:${spec.px}:flags=lanczos`,
    outPath,
  ], rgba);

  const kb = Math.round((await stat(outPath)).size / 102.4) / 10;
  const wmNote = spec.watermark ? `  ⚠ 워터마크(${spec.watermark}) 원본` : '';
  const wmInCrop = spec.watermark
    ? `  워터마크영역(x≥1800,y≤280) ${cx + side > 1800 && cy < 280 ? '크롭에 포함됨' : '크롭 밖으로 빠짐'}`
    : '';
  console.log(
    `  ${spec.key.padEnd(6)} ${w}x${h} → ${spec.px}px  ` +
    `배경 ${(cleared / (w * h) * 100).toFixed(1)}% 제거  ` +
    `갇힌주머니 ${pockets}개  ` +
    `크롭 ${side}px@(${cx},${cy})  ${kb}KB${wmNote}${wmInCrop}`
  );
  return { key: spec.key, kb };
}

/** JPEG 품질(ffmpeg -q:v, 낮을수록 고품질). D25의 되돌리기 순서: 블로킹이 보이면 이 값을 먼저 낮춘다. */
const ARENA_JPEG_Q = 4;

async function prepArena() {
  const srcPath = path.join(SRC, '메가론 아레나 바닥.webp');
  const outPath = path.join(ROOT, 'public/assets/arena.jpg');
  await mkdir(path.dirname(outPath), { recursive: true });
  // ARENA 960x540 의 R 배. 카메라 줌 R 과 상쇄되어 월드 기준으로는 여전히 1:1 이다.
  // pixelArt:true 는 NEAREST 라 1920 을 0.5 로 깔면 2x2 중 1픽셀만 점표본되고 3/4는 화면에 도달하지 못한다.
  // → 축소를 여기서 Lanczos(면적 평균)로 끝내는 편이 더 작으면서 더 잘 보인다. (D25)
  // 배경은 투명 픽셀이 원리적으로 없으므로 JPEG 예외 대상이다(GDD §9-2).
  await run('ffmpeg', [
    '-v', 'error', '-y', '-i', srcPath,
    '-vf', `scale=${960 * R}:${540 * R}:flags=lanczos`,
    '-q:v', String(ARENA_JPEG_Q), outPath,
  ]);
  const kb = Math.round((await stat(outPath)).size / 102.4) / 10;
  console.log(`  arena  → ${960 * R}x${540 * R} jpeg q${ARENA_JPEG_Q}  ${kb}KB`);
  return { key: 'arena', kb };
}

async function main() {
  console.log(`[prep-assets] 원본: ${SRC}`);
  const results = [];
  for (const s of SPRITES) {
    if (s.watermark && !KEEP_WM) {
      console.log(`  ${s.key.padEnd(6)} 건너뜀 — ${s.watermark} 워터마크. 재생성하거나 --keep-watermarked 로 강행`);
      continue;
    }
    results.push(await prepSprite(s));
  }
  results.push(await prepArena());
  const total = results.reduce((a, r) => a + r.kb, 0);
  console.log(`[prep-assets] 이미지 합계 ${total.toFixed(1)}KB (ASSETS.MAX_IMAGE_TOTAL_KB = 1200)`);
  if (total > 1200) console.log('  ⚠ 예산 초과 — gd에게 보고 필요');
}

main().catch((e) => { console.error(e); process.exit(1); });

import Phaser from 'phaser';
import { SCREEN } from './config/balance';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

// 캔버스 백킹스토어(= 물리 픽셀로 실제 그려지는 텍스처 크기)는 논리 해상도(SCREEN.WIDTH/HEIGHT)의
// SCREEN.SUPERSAMPLE(R)배다. 각 씬은 카메라 줌을 R로 두어(GameScene/TitleScene/ResultScene) 이 배율을
// 상쇄시키므로 카메라가 보여 주는 월드 영역 자체는 480x270 그대로다(GDD §9-9, D40).
const BACKING_WIDTH = SCREEN.WIDTH * SCREEN.SUPERSAMPLE;
const BACKING_HEIGHT = SCREEN.HEIGHT * SCREEN.SUPERSAMPLE;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: BACKING_WIDTH,
  height: BACKING_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [BootScene, TitleScene, GameScene, ResultScene],
});

// ── 비정수 devicePixelRatio 대응 + R배 백킹스토어의 CSS 표시 배율 ──
// pixelArt: true는 NEAREST 샘플링이라 CSS 표시 크기가 물리 픽셀 기준으로
// 정수배가 아니면 픽셀이 불규칙하게 중복·소실되고 한글 획(1px)이 깨진다.
// 백킹스토어(BACKING_WIDTH/HEIGHT)는 고정하고, CSS 크기를 (백킹크기 / dpr) * N (N은 정수)로 맞춘다.
// 이렇게 하면 실제 물리 픽셀 수 = 백킹크기 * N (정수)가 되어 dpr 값 자체와 무관해진다.
//
// R 도입 전에는 백킹스토어가 480x270이라 어떤 창보다 작았으므로 축소(scale<1)가 원리적으로
// 없었다. 백킹이 1440x810(R=3)이 되면서 창이 그보다 작으면 축소가 처음으로 가능해졌다(GDD D42).
// 그 경우에는 정수배를 강제하지 않고 창에 맞춰 축소하되(캔버스가 창 밖으로 넘치면 §8-38 위반),
// SCREEN.SMOOTH_ON_DOWNSCALE이 true면 이 구간에서만 스무딩을 켠다 — 확대·1:1에서는
// 계속 pixelated를 유지해 코드 도형·스프라이트의 픽셀 정렬을 지킨다.
function fitCanvasToIntegerScale(): void {
  const canvas = game.canvas;
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const cssUnitWidth = BACKING_WIDTH / dpr;
  const cssUnitHeight = BACKING_HEIGHT / dpr;

  const rawScaleByWidth = window.innerWidth / cssUnitWidth;
  const rawScaleByHeight = window.innerHeight / cssUnitHeight;
  const rawScale = Math.min(rawScaleByWidth, rawScaleByHeight);

  // 창이 백킹스토어보다 크거나 같으면(rawScale >= 1) 정수배로 내림해 텍셀:물리픽셀 정합을 지킨다.
  // 창이 더 작으면(rawScale < 1) 정수배를 강제하지 않고 그대로 축소한다 — 강제로 1을 쓰면
  // 캔버스가 창 밖으로 넘친다(§8-38).
  const scale = rawScale >= 1 ? Math.max(1, Math.floor(rawScale)) : rawScale;

  canvas.style.width = `${cssUnitWidth * scale}px`;
  canvas.style.height = `${cssUnitHeight * scale}px`;
  canvas.style.imageRendering = scale < 1 && SCREEN.SMOOTH_ON_DOWNSCALE ? 'auto' : 'pixelated';

  // scale.mode가 NONE이면 Phaser는 브라우저 resize에도 캔버스 DOM 크기를 스스로 재지 않는다
  // (Phaser 타입 주석: "This is called automatically ... as long as it is using a Scale Mode
  // other than 'NONE'"). 여기서 canvas.style을 직접 건드리므로, 포인터 좌표 변환에 쓰이는
  // ScaleManager의 내부 bounds/scale을 수동으로 갱신해 주지 않으면 클릭 좌표가 실제 렌더 위치와
  // 어긋난다 — 화면에 보이는 글자를 그대로 클릭해도 반응하지 않는 버그의 원인이었다(실측 확인).
  game.scale.refresh();
}

window.addEventListener('resize', fitCanvasToIntegerScale);
game.events.once(Phaser.Core.Events.READY, () => {
  fitCanvasToIntegerScale();

  // 페이지를 막 열었을 때 포커스가 캔버스에 없으면(주소창 등에 남아 있으면) 키보드 입력이
  // 씹힌다(실측 확인: 로드 직후 Enter 무반응, 캔버스를 한 번 클릭한 뒤에는 정상). 캔버스를
  // 포커스 가능하게 만들고 즉시 포커스를 준다 — 클릭 없이도 Enter/방향키가 바로 먹게 하기 위함.
  if (game.canvas) {
    game.canvas.tabIndex = 0;
    game.canvas.focus();
  }
});

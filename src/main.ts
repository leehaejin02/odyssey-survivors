import Phaser from 'phaser';
import { SCREEN } from './config/balance';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: SCREEN.WIDTH,
  height: SCREEN.HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [BootScene, TitleScene, GameScene, ResultScene],
});

// ── 비정수 devicePixelRatio 대응 ──
// pixelArt: true는 NEAREST 샘플링이라 CSS 표시 크기가 물리 픽셀 기준으로
// 정수배가 아니면 픽셀이 불규칙하게 중복·소실되고 한글 획(1px)이 깨진다.
// 백킹스토어(논리 해상도)는 고정하고, CSS 크기를 (논리크기 / dpr) * N (N은 정수)로 맞춘다.
// 이렇게 하면 실제 물리 픽셀 수 = 논리크기 * N (정수)가 되어 dpr 값 자체와 무관해진다.
function fitCanvasToIntegerScale(): void {
  const canvas = game.canvas;
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const cssUnitWidth = SCREEN.WIDTH / dpr;
  const cssUnitHeight = SCREEN.HEIGHT / dpr;

  const maxScaleByWidth = Math.floor(window.innerWidth / cssUnitWidth);
  const maxScaleByHeight = Math.floor(window.innerHeight / cssUnitHeight);
  const scale = Math.max(1, Math.min(maxScaleByWidth, maxScaleByHeight));

  canvas.style.width = `${cssUnitWidth * scale}px`;
  canvas.style.height = `${cssUnitHeight * scale}px`;

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

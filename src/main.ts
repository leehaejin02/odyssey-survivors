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
}

window.addEventListener('resize', fitCanvasToIntegerScale);
game.events.once(Phaser.Core.Events.READY, fitCanvasToIntegerScale);

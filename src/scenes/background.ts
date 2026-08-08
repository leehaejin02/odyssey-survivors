// ─────────────────────────────────────────────────────────────
// background.ts — 아레나 배경(이미지 또는 폴백 격자) + 시련별 bgTint 적용.
// 시련 3종의 시각 구분은 TrialDef.bgTint 한 필드로만 낸다(GDD §9-3, D17, §8-23).
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { ARENA, VISUAL, type TrialDef } from '../config/balance';

/** base 색에 tint 색을 채널별로 곱연산한다(GDD §9-3: "곱연산이라 값이 작을수록 어두워진다"). */
function multiplyColor(base: number, tint: number): number {
  const b = Phaser.Display.Color.IntegerToColor(base);
  const t = Phaser.Display.Color.IntegerToColor(tint);
  const r = Math.round((b.red * t.red) / 255);
  const g = Math.round((b.green * t.green) / 255);
  const bl = Math.round((b.blue * t.blue) / 255);
  return Phaser.Display.Color.GetColor(r, g, bl);
}

/**
 * 아레나 배경을 그린다. 'arena' 텍스처가 있으면 이미지를 깔고, 없으면 폴백 격자를 그린다.
 * 두 경우 모두 trial.bgTint를 곱연산으로 적용해 시련 간 시각 구분을 유지한다.
 *
 * 생성한 오브젝트를 반환한다 — GameScene이 이걸 HUD 전용 카메라의 ignore 목록에 등록해
 * 월드 오브젝트가 HUD 카메라에 이중으로 그려지지 않게 한다(§9-9 카메라 분리, 아래 GameScene 주석 참조).
 */
export function createArenaBackground(scene: Phaser.Scene, trial: TrialDef): Phaser.GameObjects.GameObject[] {
  if (scene.textures.exists('arena')) {
    const bg = scene.add.image(ARENA.WIDTH / 2, ARENA.HEIGHT / 2, 'arena');
    bg.setDisplaySize(ARENA.WIDTH * VISUAL.ARENA_IMAGE_SCALE, ARENA.HEIGHT * VISUAL.ARENA_IMAGE_SCALE);
    bg.setTint(trial.bgTint);
    bg.setDepth(VISUAL.DEPTH.ARENA);
    return [bg];
  }

  const baseColor = multiplyColor(VISUAL.COLOR.ARENA_FALLBACK, trial.bgTint);
  const gridColor = multiplyColor(VISUAL.COLOR.ARENA_GRID, trial.bgTint);

  const base = scene.add
    .rectangle(ARENA.WIDTH / 2, ARENA.HEIGHT / 2, ARENA.WIDTH, ARENA.HEIGHT, baseColor)
    .setDepth(VISUAL.DEPTH.ARENA);

  const grid = scene.add.graphics().setDepth(VISUAL.DEPTH.ARENA);
  grid.lineStyle(1, gridColor, 1);
  for (let x = 0; x <= ARENA.WIDTH; x += VISUAL.ARENA_GRID_PX) {
    grid.lineBetween(x, 0, x, ARENA.HEIGHT);
  }
  for (let y = 0; y <= ARENA.HEIGHT; y += VISUAL.ARENA_GRID_PX) {
    grid.lineBetween(0, y, ARENA.WIDTH, y);
  }
  return [base, grid];
}

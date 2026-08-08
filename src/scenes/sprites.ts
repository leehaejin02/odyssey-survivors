// ─────────────────────────────────────────────────────────────
// sprites.ts — 텍스처 키 간접층. 렌더 대상은 전부 이 파일을 통해서만 텍스처 키를 받는다.
//
// 핵심 산출물: resolveTextureKey()가 유일한 판정 지점이다.
// 키가 로드돼 있으면 스프라이트, 없으면 런타임 생성 도형(폴백)으로 그린다.
// 이번 단계는 에셋을 하나도 로드하지 않으므로(다음 단계 tech-B) 항상 폴백 경로를 탄다 —
// public/이 비어 있든 채워져 있든 이 단계의 동작은 동일하다.
//
// 다음 단계에서 BootScene이 `this.load.image(kind, 'sprites/xxx.png')`를 kind와 같은 키로
// 추가하기만 하면, 이 파일은 한 글자도 안 고쳐도 스프라이트로 자동 전환된다(스왑 45분 근거).
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { VISUAL } from '../config/balance';

export type EntityKind = 'player' | 'grunt' | 'brute' | 'boss';

const FALLBACK_COLOR: Record<EntityKind, number> = {
  player: VISUAL.COLOR.PLAYER,
  grunt: VISUAL.COLOR.GRUNT,
  brute: VISUAL.COLOR.BRUTE,
  boss: VISUAL.COLOR.BOSS,
};

const DISPLAY_PX: Record<EntityKind, number> = {
  player: VISUAL.SPRITE_PX.player,
  grunt: VISUAL.SPRITE_PX.grunt,
  brute: VISUAL.SPRITE_PX.brute,
  boss: VISUAL.SPRITE_PX.boss,
};

const DEPTH: Record<EntityKind, number> = {
  player: VISUAL.DEPTH.PLAYER,
  grunt: VISUAL.DEPTH.ENEMY,
  brute: VISUAL.DEPTH.ENEMY,
  boss: VISUAL.DEPTH.BOSS,
};

/**
 * 단일 판정 지점: kind의 텍스처가 로드돼 있는가.
 * ASSETS.PATHS의 필드명과 EntityKind가 1:1이므로 텍스처 키는 kind 문자열 그 자체를 쓴다.
 */
export function resolveTextureKey(scene: Phaser.Scene, kind: EntityKind): string | null {
  return scene.textures.exists(kind) ? kind : null;
}

export type EntityView = Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;

/** kind에 해당하는 표시 오브젝트를 만든다. 텍스처가 있으면 스프라이트, 없으면 원형 도형. */
export function createEntityView(scene: Phaser.Scene, kind: EntityKind, x: number, y: number): EntityView {
  const key = resolveTextureKey(scene, kind);
  const size = DISPLAY_PX[kind];

  if (key) {
    const sprite = scene.add.sprite(x, y, key);
    sprite.setDisplaySize(size, size);
    sprite.setDepth(DEPTH[kind]);
    return sprite;
  }

  const shape = scene.add.circle(x, y, size / 2, FALLBACK_COLOR[kind]);
  shape.setDepth(DEPTH[kind]);
  return shape;
}

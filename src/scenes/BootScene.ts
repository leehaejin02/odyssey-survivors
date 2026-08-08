// ─────────────────────────────────────────────────────────────
// BootScene.ts — 에셋 로딩. 존재하는 파일만 큐에 올린다(폴백 규칙, GDD §8-20).
//
// **없는 파일은 애초에 load 요청 자체를 내지 않는다.** `__ASSET_AVAILABILITY__`(vite.config.ts가
// 빌드타임에 fs로 확인해 굽는 상수)로 판정한다 — 런타임에 존재를 확인하려 들면(fetch/XHR/이미지
// 태그 무엇으로 하든) 브라우저가 404 응답마다 "Failed to load resource"를 Console에 자동으로
// 남긴다(CDP로 실측 확인, 2026-08-08). 그래서 sprites.ts의 `scene.textures.exists(kind)` 판정이
// 항상 정확하도록, 여기서는 실제로 존재하는 파일만 큐에 올린다.
//
// 키는 ASSETS.PATHS의 필드명을 그대로 텍스처/오디오 키로 쓴다(sprites.ts와 1:1).
// 확장자로 이미지/오디오를 가른다 — ASSETS.PATHS에 새 항목이 추가돼도 이 파일은 고칠 필요가 없다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { ASSETS, VISUAL } from '../config/balance';

const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const [key, relativePath] of Object.entries(ASSETS.PATHS)) {
      if (!__ASSET_AVAILABILITY__[key]) continue;
      const isAudio = AUDIO_EXTENSIONS.some((ext) => relativePath.endsWith(ext));
      if (isAudio) this.load.audio(key, relativePath);
      else this.load.image(key, relativePath);
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(VISUAL.COLOR.ARENA_FALLBACK);
    this.scene.start('Title');
  }
}

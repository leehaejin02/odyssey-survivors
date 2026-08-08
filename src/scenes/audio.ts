// ─────────────────────────────────────────────────────────────
// audio.ts — BGM 1곡의 재생/음소거를 전 씬 공용으로 관리한다.
// Phaser의 SoundManager(this.sound)는 씬이 아니라 게임 인스턴스에 속하므로(전 씬 공유),
// "재생 시작"은 한 번만 일어나면 되고 그 뒤로는 씬을 넘나들어도 계속 흐른다.
//
// GDD §9-6 / AUDIO.START_ON_FIRST_INPUT: 브라우저 자동재생 차단 때문에
// 타이틀의 첫 입력(클릭 또는 키 입력)에서만 재생을 시작할 수 있다.
// 에셋 폴백(D20): 'bgm' 오디오가 로드돼 있지 않으면(public/audio/bgm.mp3 없음) 아무 것도 하지 않는다.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { AUDIO } from '../config/balance';

let started = false;
let muted = false;

/** 타이틀의 첫 입력에서 BGM 재생을 예약한다. 이미 시작했으면 아무 것도 하지 않는다(중복 재생 방지). */
export function armBgmOnFirstInput(scene: Phaser.Scene): void {
  if (started) return;
  if (!scene.cache.audio.exists('bgm')) return; // 폴백: BGM 에셋이 없으면 무음으로 정상 진행

  const start = (): void => {
    if (started) return;
    started = true;
    const sound = scene.sound.add('bgm', { loop: true, volume: AUDIO.BGM_VOLUME });
    sound.play();
  };

  scene.input.once('pointerdown', start);
  scene.input.keyboard?.once('keydown', start);
}

/** 음소거 토글. 반환값은 토글 후의 음소거 상태(토스트 문구 결정에 쓴다). */
export function toggleMute(scene: Phaser.Scene): boolean {
  muted = !muted;
  scene.sound.mute = muted;
  return muted;
}

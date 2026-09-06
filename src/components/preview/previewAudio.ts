import type { Asset, Clip, Track } from '@/store/timelineStore'
import { isClipActive } from './canvasCompositor'

/**
 * 프리뷰 오디오 재생 정책.
 *
 * 선택 규칙과 게인 계산은 `src-tauri/src/commands/ffmpeg.rs`의
 * `build_plan_from_payload` / `build_audio_mix`와 같은 결과를 내도록 맞춘다.
 * 여기서 Export와 다른 규칙을 쓰면 프리뷰와 렌더 결과의 소리가 갈린다.
 */

/**
 * - `audio`: audio 트랙에 배치된 독립 오디오 클립. Export의 `AudioExportInfo`에 대응한다.
 * - `embedded`: video 트랙 비디오 클립에 포함된 오디오. Export의 concat 세그먼트 `[n:a]`에 대응한다.
 */
export type AudioSourceKind = 'audio' | 'embedded'

export interface ActiveAudioSource {
  track: Track
  clip: Clip
  asset: Asset
  kind: AudioSourceKind
}

/** HTMLMediaElement.volume 의 유효 범위 */
const MAX_ELEMENT_VOLUME = 1
/** Export의 `gain.clamp(0.0, 4.0)`과 동일한 상한 */
const MAX_AUDIO_GAIN = 4

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

/**
 * 현재 타임라인 시각에 들려야 할 오디오 소스를 모은다.
 *
 * Export와 맞춘 규칙:
 * - `track.visible === false` 인 트랙은 통째로 제외한다(오디오 트랙의 음소거 수단).
 * - overlay 트랙은 Export가 영상만 합성하므로 소리를 내지 않는다.
 * - 트랙 타입과 에셋 타입이 함께 맞을 때만 채택한다.
 */
export function collectActiveAudioSources(
  tracks: Track[],
  assets: Asset[],
  timelineTime: number
): ActiveAudioSource[] {
  const sources: ActiveAudioSource[] = []

  for (const track of tracks) {
    if (!track.visible) continue
    if (track.type !== 'audio' && track.type !== 'video') continue

    for (const clip of track.clips) {
      if (clip.clipType !== 'media') continue
      if (!isClipActive(clip, timelineTime)) continue

      const asset = assets.find((candidate) => candidate.id === clip.assetId)
      if (!asset) continue

      if (track.type === 'audio' && asset.type === 'audio') {
        sources.push({ track, clip, asset, kind: 'audio' })
      } else if (track.type === 'video' && asset.type === 'video') {
        sources.push({ track, clip, asset, kind: 'embedded' })
      }
    }
  }

  return sources
}

/**
 * 소스 자체의 게인.
 *
 * Export는 오디오 클립에만 `volume=clip.opacity * track.opacity`를 적용하고,
 * 비디오에 포함된 오디오는 감쇠 없이 concat한다. 프리뷰도 같게 둔다.
 */
export function getAudioSourceGain(
  source: Pick<ActiveAudioSource, 'kind'> & {
    clip: Pick<Clip, 'opacity'>
    track: Pick<Track, 'opacity'>
  }
): number {
  if (source.kind === 'embedded') return 1
  return clamp(source.clip.opacity * source.track.opacity, 0, MAX_AUDIO_GAIN)
}

/**
 * 실제 media element에 넣을 volume 값.
 *
 * HTMLMediaElement.volume 은 1을 넘길 수 없으므로 1 초과 게인은 여기서 잘린다.
 * (Export의 `amix ... normalize=0`은 1 초과 게인을 그대로 반영한다.)
 */
export function getAudioElementVolume(gain: number, masterVolume: number, muted: boolean): number {
  if (muted) return 0
  return clamp(gain * clamp(masterVolume, 0, 1), 0, MAX_ELEMENT_VOLUME)
}

/**
 * media element 캐시 키.
 *
 * 같은 에셋을 서로 다른 trim 구간의 클립으로 여러 번 배치할 수 있으므로
 * asset이 아니라 clip 단위로 element를 소유한다.
 */
export function getAudioElementKey(source: Pick<ActiveAudioSource, 'clip'>): string {
  return source.clip.id
}

/** 클립의 시간 배치가 바뀌었는지 판정하는 키. 값이 바뀌면 강제 seek 한다. */
export function makeAudioSyncKey(clip: Clip): string {
  return [clip.id, clip.start, clip.duration, clip.trimStart, clip.trimEnd, clip.playbackRate].join(
    ':'
  )
}

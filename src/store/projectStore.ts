import { tauriInvoke } from '@/lib/invoke'
import { STORAGE_KEYS } from '@/lib/storageKeys'
import { create } from 'zustand'
import { useTimelineStore } from './timelineStore'

// ─────────────────────────────────────────────────────────────────────────────
// 데이터 모델
// ─────────────────────────────────────────────────────────────────────────────

export type CanvasPreset =
  | '1080p_16:9' // 1920×1080
  | '4K_16:9' // 3840×2160
  | '1080p_9:16' // 1080×1920 (세로)
  | '1:1' // 1080×1080 (정방형)
  | 'custom'

export interface CanvasPresetDef {
  id: CanvasPreset
  label: string
  width: number
  height: number
}

export const CANVAS_PRESETS: CanvasPresetDef[] = [
  { id: '1080p_16:9', label: '1080p 16:9 (1920×1080)', width: 1920, height: 1080 },
  { id: '4K_16:9', label: '4K 16:9 (3840×2160)', width: 3840, height: 2160 },
  { id: '1080p_9:16', label: '1080p 세로 9:16 (1080×1920)', width: 1080, height: 1920 },
  { id: '1:1', label: '정방형 1:1 (1080×1080)', width: 1080, height: 1080 },
  { id: 'custom', label: '커스텀', width: 1920, height: 1080 },
]

export interface ProjectMeta {
  id: string
  name: string
  filePath: string | null // null = 아직 저장 안 됨
  canvasWidth: number
  canvasHeight: number
  fps: number
  preset: CanvasPreset
  createdAt: string // ISO 8601
  updatedAt: string
}

export interface RecentProject {
  id: string
  name: string
  filePath: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 스토어
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RECENT = 10
const DEFAULT_FPS = 30

function now() {
  return new Date().toISOString()
}

function makeDefaultMeta(name: string, preset: CanvasPresetDef): ProjectMeta {
  const ts = now()
  return {
    id: crypto.randomUUID(),
    name,
    filePath: null,
    canvasWidth: preset.width,
    canvasHeight: preset.height,
    fps: DEFAULT_FPS,
    preset: preset.id,
    createdAt: ts,
    updatedAt: ts,
  }
}

function loadRecentFromStorage(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_PROJECTS)
    if (raw) return JSON.parse(raw) as RecentProject[]
  } catch {
    // ignore
  }
  return []
}

function saveRecentToStorage(list: RecentProject[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.RECENT_PROJECTS, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {
    // ignore
  }
}

function addToRecent(list: RecentProject[], meta: ProjectMeta): RecentProject[] {
  if (!meta.filePath) return list
  const entry: RecentProject = {
    id: meta.id,
    name: meta.name,
    filePath: meta.filePath,
    updatedAt: meta.updatedAt,
  }
  const filtered = list.filter((r) => r.filePath !== meta.filePath)
  return [entry, ...filtered].slice(0, MAX_RECENT)
}

interface ProjectState {
  currentProject: ProjectMeta | null
  isDirty: boolean
  recentProjects: RecentProject[]
}

interface ProjectActions {
  /**새 프로젝트를 생성합니다 (저장 경로는 나중에 설정). */
  createProject: (
    name: string,
    presetId: CanvasPreset,
    customW?: number,
    customH?: number
  ) => ProjectMeta
  /**저장된 `.vedproj` 파일을 불러옵니다. serialized JSON을 파싱하여 상태에 적용. */
  loadProject: (filePath: string, json: string) => ProjectMeta
  /**현재 프로젝트를 지정 경로에 저장합니다. `getSerializedState`가 반환한 json을 씁니다. */
  saveProject: (filePath: string) => void
  /**프로젝트 메타를 업데이트합니다 (이름, 캔버스 크기 변경 시). */
  updateProjectMeta: (
    patch: Partial<Pick<ProjectMeta, 'name' | 'canvasWidth' | 'canvasHeight' | 'fps' | 'preset'>>
  ) => void
  /**타임라인 상태가 변경될 때마다 호출 — isDirty 플래그를 세웁니다. */
  markDirty: () => void
  /**저장 완료 시 isDirty를 클리어합니다. */
  clearDirty: () => void
  /**최근 프로젝트 목록을 localStorage에서 다시 불러옵니다. */
  reloadRecent: () => void
  /**최근 프로젝트 항목 하나를 제거합니다. */
  removeRecent: (filePath: string) => void
}

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  currentProject: null,
  isDirty: false,
  recentProjects: loadRecentFromStorage(),

  createProject: (name, presetId, customW, customH) => {
    const presetDef = CANVAS_PRESETS.find((p) => p.id === presetId) ?? CANVAS_PRESETS[0]
    const meta = makeDefaultMeta(name, {
      ...presetDef,
      width: presetId === 'custom' && customW ? customW : presetDef.width,
      height: presetId === 'custom' && customH ? customH : presetDef.height,
    })
    set({ currentProject: meta, isDirty: false })
    useTimelineStore.getState().setCanvasDimensions(meta.canvasWidth, meta.canvasHeight)
    return meta
  },

  loadProject: (filePath, json) => {
    const parsed = JSON.parse(json) as { meta: ProjectMeta }
    const meta: ProjectMeta = { ...parsed.meta, filePath }
    const recent = addToRecent(get().recentProjects, meta)
    saveRecentToStorage(recent)
    set({ currentProject: meta, isDirty: false, recentProjects: recent })
    useTimelineStore.getState().setCanvasDimensions(meta.canvasWidth, meta.canvasHeight)
    return meta
  },

  saveProject: (filePath) => {
    const meta = get().currentProject
    if (!meta) return
    const updated: ProjectMeta = { ...meta, filePath, updatedAt: now() }
    const recent = addToRecent(get().recentProjects, updated)
    saveRecentToStorage(recent)
    set({ currentProject: updated, isDirty: false, recentProjects: recent })
  },

  updateProjectMeta: (patch) => {
    const meta = get().currentProject
    if (!meta) return
    set({ currentProject: { ...meta, ...patch, updatedAt: now() }, isDirty: true })
  },

  markDirty: () => set({ isDirty: true }),
  clearDirty: () => set({ isDirty: false }),

  reloadRecent: () => set({ recentProjects: loadRecentFromStorage() }),

  removeRecent: (filePath) => {
    const list = get().recentProjects.filter((r) => r.filePath !== filePath)
    saveRecentToStorage(list)
    set({ recentProjects: list })
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// IPC 헬퍼 — projectStore 외부에서 save/load 흐름 편의 함수
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 프로젝트 파일 저장 (IPC 호출 + 스토어 업데이트).
 * `serializedJson`: timelineStore + assetStore 직렬화 결과를 포함한 전체 JSON 문자열.
 */
export async function saveProjectFile(filePath: string, serializedJson: string): Promise<void> {
  await tauriInvoke<void>('project_save', { path: filePath, json: serializedJson })
  useProjectStore.getState().saveProject(filePath)
}

/**
 * 프로젝트 파일 불러오기 (IPC 호출 + 스토어 업데이트).
 * 반환값: 파싱된 ProjectMeta
 */
export async function loadProjectFile(
  filePath: string
): Promise<{ meta: ProjectMeta; json: string }> {
  const json = await tauriInvoke<string>('project_load', { path: filePath })
  const meta = useProjectStore.getState().loadProject(filePath, json)
  return { meta, json }
}

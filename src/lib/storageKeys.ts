/** localStorage 키 상수 — 여기서만 관리 */
export const STORAGE_KEYS = {
  TIMELINE_ZOOM: 'timeline:zoom',
  PANEL_ASSET_WIDTH: 'panel:asset:width',
  PANEL_PREVIEW_HEIGHT: 'panel:preview:height',
  PREVIEW_CANVAS_ZOOM: 'preview:canvas:zoom',
  PREVIEW_VOLUME: 'preview:volume',
  PREVIEW_MUTED: 'preview:muted',
  PANEL_TIMELINE_HEIGHT: 'panel:timeline:height',
  // 앱 설정
  SETTINGS_THEME_MODE: 'settings:themeMode',
  SETTINGS_DEFAULT_ZOOM: 'settings:defaultZoom',
  SETTINGS_SNAP_INTERVAL: 'settings:snapInterval',
  // 프로젝트
  PANEL_PROPERTIES_WIDTH: 'panel:properties:width',
  PANEL_PROPERTIES_OPEN: 'panel:properties:open',
  RECENT_PROJECTS: 'project:recent',
} as const

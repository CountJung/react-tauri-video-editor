import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import RedoIcon from '@mui/icons-material/Redo'
import SaveIcon from '@mui/icons-material/Save'
import SettingsIcon from '@mui/icons-material/Settings'
import UndoIcon from '@mui/icons-material/Undo'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { open as tauriOpen, save as tauriSave } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ResizableDialog } from '../components/common/ResizableDialog'
import { ExportDialog } from '../components/preview/ExportDialog'
import { NewProjectDialog } from '../components/project/NewProjectDialog'
import { tauriCloseWindow, tauriOnCloseRequested } from '../lib/invoke'
import { useGlobalShortcuts } from '../lib/useGlobalShortcuts'
import { useAssetStore } from '../store/assetStore'
import { useHistoryStore } from '../store/historyStore'
import {
  type ProjectMeta,
  loadProjectFile,
  saveProjectFile,
  useProjectStore,
} from '../store/projectStore'
import { useTimelineStore } from '../store/timelineStore'

export const Route = createRootRoute({
  component: RootLayout,
})

/** 현재 앱 상태를 `.vedproj` JSON 문자열로 직렬화 */
function buildProjectJson(): string {
  const meta = useProjectStore.getState().currentProject
  const tracks = useTimelineStore.getState().tracks
  const assets = useAssetStore.getState().assets
  return JSON.stringify({ meta, tracks, assets }, null, 2)
}

function RootLayout() {
  const [exportOpen, setExportOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const handleProjectCreated = useCallback(async (meta: ProjectMeta) => {
    if (meta.filePath) {
      await saveProjectFile(meta.filePath, buildProjectJson())
    }
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <GlobalAppBar
        onExport={() => setExportOpen(true)}
        onNewProject={() => setNewProjectOpen(true)}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Outlet />
      </Box>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleProjectCreated}
      />
    </Box>
  )
}

interface GlobalAppBarProps {
  onExport?: () => void
  onNewProject?: () => void
}

function GlobalAppBar({ onExport, onNewProject }: GlobalAppBarProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isSettings = pathname === '/settings'

  const currentProject = useProjectStore((s) => s.currentProject)
  const isDirty = useProjectStore((s) => s.isDirty)
  const recentProjects = useProjectStore((s) => s.recentProjects)

  const canUndo = useHistoryStore((s) => s.undoStack.length > 0)
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0)
  const undoLabel = useHistoryStore((s) => s.undoStack[0]?.label ?? '')
  const redoLabel = useHistoryStore((s) => s.redoStack[0]?.label ?? '')

  const [fileMenuAnchor, setFileMenuAnchor] = useState<null | HTMLElement>(null)
  const fileMenuOpen = Boolean(fileMenuAnchor)
  const [recentMenuAnchor, setRecentMenuAnchor] = useState<null | HTMLElement>(null)
  const recentOpen = Boolean(recentMenuAnchor)
  const recentItemRef = useRef<HTMLLIElement | null>(null)

  // 미저장 경고 다이얼로그
  const [warnOpen, setWarnOpen] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)

  /** isDirty가 true이면 경고 다이얼로그를 표시한다. false이면 즉시 실행한다. */
  const guardDirty = useCallback(
    (action: () => void) => {
      if (isDirty) {
        pendingActionRef.current = action
        setWarnOpen(true)
      } else {
        action()
      }
    },
    [isDirty]
  )

  const handleWarnConfirm = useCallback(() => {
    setWarnOpen(false)
    pendingActionRef.current?.()
    pendingActionRef.current = null
  }, [])

  const handleWarnCancel = useCallback(() => {
    setWarnOpen(false)
    pendingActionRef.current = null
  }, [])

  const closeAll = useCallback(() => {
    setFileMenuAnchor(null)
    setRecentMenuAnchor(null)
  }, [])

  const handleSave = useCallback(async () => {
    closeAll()
    const meta = useProjectStore.getState().currentProject
    if (!meta) return
    let path = meta.filePath
    if (!path) {
      path = (await tauriSave({
        defaultPath: `${meta.name}.vedproj`,
        filters: [{ name: '비디오 에디터 프로젝트', extensions: ['vedproj'] }],
      })) as string | null
      if (!path) return
    }
    await saveProjectFile(path, buildProjectJson())
  }, [closeAll])

  const handleSaveAs = useCallback(async () => {
    closeAll()
    const meta = useProjectStore.getState().currentProject
    const path = (await tauriSave({
      defaultPath: `${meta?.name ?? '새 프로젝트'}.vedproj`,
      filters: [{ name: '비디오 에디터 프로젝트', extensions: ['vedproj'] }],
    })) as string | null
    if (!path) return
    await saveProjectFile(path, buildProjectJson())
  }, [closeAll])

  const doOpen = useCallback(async () => {
    const selected = (await tauriOpen({
      multiple: false,
      filters: [{ name: '비디오 에디터 프로젝트', extensions: ['vedproj'] }],
    })) as string | null
    if (!selected) return
    const { json } = await loadProjectFile(selected)
    const parsed = JSON.parse(json) as { tracks?: unknown; assets?: unknown }
    if (parsed.tracks) useTimelineStore.setState({ tracks: parsed.tracks as never })
    if (parsed.assets) useAssetStore.setState({ assets: parsed.assets as never })
  }, [])

  const handleOpen = useCallback(() => {
    closeAll()
    guardDirty(() => void doOpen())
  }, [closeAll, guardDirty, doOpen])

  const handleOpenRecent = useCallback(
    (filePath: string) => {
      closeAll()
      guardDirty(async () => {
        try {
          const { json } = await loadProjectFile(filePath)
          const parsed = JSON.parse(json) as { tracks?: unknown; assets?: unknown }
          if (parsed.tracks) useTimelineStore.setState({ tracks: parsed.tracks as never })
          if (parsed.assets) useAssetStore.setState({ assets: parsed.assets as never })
        } catch {
          useProjectStore.getState().removeRecent(filePath)
        }
      })
    },
    [closeAll, guardDirty]
  )

  // 창 닫기 요청 → isDirty이면 경고 후 닫기
  useEffect(() => {
    let cleanup: (() => void) | null = null
    tauriOnCloseRequested((event) => {
      if (useProjectStore.getState().isDirty) {
        event.preventDefault()
        pendingActionRef.current = () => void tauriCloseWindow()
        setWarnOpen(true)
      }
    }).then((unlisten) => {
      cleanup = unlisten
    })
    return () => cleanup?.()
  }, [])

  // 전역 키보드 단축키
  useGlobalShortcuts({
    onSave: () => void handleSave(),
    onSaveAs: () => void handleSaveAs(),
    onNewProject: () => guardDirty(() => onNewProject?.()),
    onOpenProject: () => void handleOpen(),
  })

  const titleText = isSettings
    ? '설정'
    : currentProject
      ? `${currentProject.name}${isDirty ? ' *' : ''}`
      : '🎬 Video Editor'

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider', zIndex: 20 }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 40, gap: 0.5 }}>
        {isSettings ? (
          <IconButton
            size="small"
            onClick={() => navigate({ to: '/' })}
            sx={{ mr: 0.5 }}
            aria-label="뒤로가기"
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        ) : (
          <Tooltip title="파일">
            <IconButton
              size="small"
              onClick={(e) => setFileMenuAnchor(e.currentTarget)}
              aria-label="파일 메뉴"
              aria-controls={fileMenuOpen ? 'file-menu' : undefined}
              aria-expanded={fileMenuOpen}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700, fontSize: 13 }}>
          {titleText}
        </Typography>

        {!isSettings && (
          <>
            <Tooltip title={canUndo ? `실행 취소: ${undoLabel} (Ctrl+Z)` : '실행 취소 (Ctrl+Z)'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canUndo}
                  onClick={() => useHistoryStore.getState().undo()}
                  aria-label="실행 취소"
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canRedo ? `다시 실행: ${redoLabel} (Ctrl+Y)` : '다시 실행 (Ctrl+Y)'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canRedo}
                  onClick={() => useHistoryStore.getState().redo()}
                  aria-label="다시 실행"
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              startIcon={<FileDownloadIcon />}
              onClick={onExport}
              sx={{ mr: 0.5, fontSize: 12, height: 28 }}
            >
              내보내기
            </Button>
            <IconButton
              size="small"
              onClick={() => navigate({ to: '/settings' })}
              aria-label="설정 열기"
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Toolbar>

      {/* 파일 메뉴 드롭다운 */}
      <Menu
        id="file-menu"
        anchorEl={fileMenuAnchor}
        open={fileMenuOpen}
        onClose={closeAll}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        <MenuItem
          onClick={() => {
            closeAll()
            guardDirty(() => onNewProject?.())
          }}
        >
          <ListItemIcon>
            <InsertDriveFileOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="새 프로젝트" secondary="Ctrl+N" />
        </MenuItem>
        <MenuItem onClick={handleOpen}>
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="열기..." secondary="Ctrl+O" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSave} disabled={!currentProject}>
          <ListItemIcon>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="저장" secondary="Ctrl+S" />
        </MenuItem>
        <MenuItem onClick={handleSaveAs}>
          <ListItemIcon>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="다른 이름으로 저장..." secondary="Ctrl+Shift+S" />
        </MenuItem>
        {recentProjects.length > 0 && (
          <>
            <Divider />
            <MenuItem
              ref={recentItemRef}
              onMouseEnter={() => setRecentMenuAnchor(recentItemRef.current)}
            >
              <ListItemText primary="최근 프로젝트" />
              <Box component="span" sx={{ ml: 2, color: 'text.secondary', fontSize: 12 }}>
                ▶
              </Box>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* 최근 프로젝트 서브메뉴 */}
      <Menu
        anchorEl={recentMenuAnchor}
        open={recentOpen}
        onClose={() => setRecentMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 280, maxHeight: 360 } } }}
      >
        {recentProjects.map((r) => (
          <MenuItem key={r.filePath} onClick={() => handleOpenRecent(r.filePath)}>
            <ListItemText
              primary={r.name}
              secondary={r.filePath}
              secondaryTypographyProps={{ noWrap: true, sx: { maxWidth: 240, fontSize: 11 } }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* 미저장 경고 다이얼로그 */}
      <ResizableDialog
        open={warnOpen}
        onClose={handleWarnCancel}
        dialogTitle="저장하지 않은 변경 사항"
        defaultWidth={380}
        defaultHeight={180}
        minWidth={300}
        minHeight={140}
      >
        <Box sx={{ p: 2 }}>
          <Typography sx={{ mb: 2 }}>
            저장하지 않은 변경 사항이 있습니다. 계속하면 변경 사항이 사라집니다.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={handleWarnCancel}>
              취소
            </Button>
            <Button variant="contained" color="warning" size="small" onClick={handleWarnConfirm}>
              저장하지 않고 계속
            </Button>
          </Box>
        </Box>
      </ResizableDialog>
    </AppBar>
  )
}

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
import { useCallback, useRef, useState } from 'react'
import { ExportDialog } from '../components/preview/ExportDialog'
import { NewProjectDialog } from '../components/project/NewProjectDialog'
import { useAssetStore } from '../store/assetStore'
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

  const [fileMenuAnchor, setFileMenuAnchor] = useState<null | HTMLElement>(null)
  const fileMenuOpen = Boolean(fileMenuAnchor)
  const [recentMenuAnchor, setRecentMenuAnchor] = useState<null | HTMLElement>(null)
  const recentOpen = Boolean(recentMenuAnchor)
  const recentItemRef = useRef<HTMLLIElement | null>(null)

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

  const handleOpen = useCallback(async () => {
    closeAll()
    const selected = (await tauriOpen({
      multiple: false,
      filters: [{ name: '비디오 에디터 프로젝트', extensions: ['vedproj'] }],
    })) as string | null
    if (!selected) return
    const { json } = await loadProjectFile(selected)
    const parsed = JSON.parse(json) as { tracks?: unknown; assets?: unknown }
    if (parsed.tracks) useTimelineStore.setState({ tracks: parsed.tracks as never })
    if (parsed.assets) useAssetStore.setState({ assets: parsed.assets as never })
  }, [closeAll])

  const handleOpenRecent = useCallback(
    async (filePath: string) => {
      closeAll()
      try {
        const { json } = await loadProjectFile(filePath)
        const parsed = JSON.parse(json) as { tracks?: unknown; assets?: unknown }
        if (parsed.tracks) useTimelineStore.setState({ tracks: parsed.tracks as never })
        if (parsed.assets) useAssetStore.setState({ assets: parsed.assets as never })
      } catch {
        useProjectStore.getState().removeRecent(filePath)
      }
    },
    [closeAll]
  )

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
            <Tooltip title="실행 취소 (Ctrl+Z)">
              <span>
                <IconButton size="small" disabled aria-label="실행 취소">
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="다시 실행 (Ctrl+Y)">
              <span>
                <IconButton size="small" disabled aria-label="다시 실행">
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
            onNewProject?.()
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
    </AppBar>
  )
}

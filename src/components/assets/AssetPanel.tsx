import { convertFileSrc, tauriInvoke, tauriListen } from '@/lib/invoke'
import { useAssetStore } from '@/store/assetStore'
import type { Asset } from '@/store/timelineStore'
import { useDraggable } from '@dnd-kit/core'
import AddIcon from '@mui/icons-material/Add'
import AudiotrackIcon from '@mui/icons-material/Audiotrack'
import ImageIcon from '@mui/icons-material/Image'
import VideocamIcon from '@mui/icons-material/Videocam'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { appLocalDataDir, join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'

interface AssetMeta {
  id: string
  name: string
  path: string
  asset_type: string
  duration: number
  width?: number
  height?: number
}

interface AppErrorLike {
  code?: string
  message?: string
}

function isDialogCanceled(error: unknown): boolean {
  if (typeof error === 'string') return /cancel/i.test(error)
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message
    return typeof message === 'string' && /cancel/i.test(message)
  }
  return false
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const appError = error as AppErrorLike
    if (typeof appError.message === 'string' && appError.message.length > 0) {
      return appError.code ? `[${appError.code}] ${appError.message}` : appError.message
    }
  }
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return fallback
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function AssetTypeIcon({ type }: { type: Asset['type'] }) {
  if (type === 'video') return <VideocamIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
  if (type === 'audio') return <AudiotrackIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
  return <ImageIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
}

/** 드래그 가능한 에셋 아이템 */
function DraggableAssetItem({
  asset,
  isSelected,
  isLoading,
  onSelect,
}: {
  asset: Asset
  isSelected: boolean
  isLoading: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: { type: 'asset', asset },
  })

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 0.5,
        mb: 0.5,
        borderRadius: 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        bgcolor: isSelected ? 'action.selected' : 'transparent',
        opacity: isDragging ? 0.45 : 1,
        userSelect: 'none',
        '&:hover': {
          bgcolor: isSelected ? 'action.selected' : 'action.hover',
        },
      }}
    >
      {/* 썸네일 */}
      <Box
        sx={{
          width: 48,
          height: 32,
          bgcolor: 'grey.900',
          borderRadius: 0.5,
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLoading ? (
          <CircularProgress size={14} />
        ) : asset.thumbnailPath ? (
          <Box
            component="img"
            src={convertFileSrc(asset.thumbnailPath)}
            alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <AssetTypeIcon type={asset.type} />
        )}
      </Box>

      {/* 파일명 + 길이 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={asset.name}
        >
          {asset.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
          {formatDuration(asset.duration)}
        </Typography>
      </Box>
    </Box>
  )
}

/** 에셋 패널 — 파일 임포트 및 목록 표시 (Phase 1) */
export function AssetPanel() {
  const [isDragging, setIsDragging] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { assets, addAsset, updateAsset, updateThumbnail, selectedAssetId, setSelectedAsset } =
    useAssetStore()

  const showError = useCallback((message: string) => {
    setErrorMessage(message)
  }, [])

  const handleFilePaths = useCallback(
    async (paths: string[]) => {
      for (const filePath of paths) {
        // 1. 기본 메타데이터 임포트 (즉시 목록에 추가)
        let basicMeta: AssetMeta
        try {
          basicMeta = await tauriInvoke<AssetMeta>('asset_import', { path: filePath })
        } catch (error) {
          const reason = toErrorMessage(error, '파일을 추가하지 못했습니다.')
          console.error('[AssetPanel] asset_import failed:', { filePath, error })
          showError(`파일 추가 실패: ${reason}`)
          continue
        }

        addAsset({
          id: basicMeta.id,
          type: basicMeta.asset_type as Asset['type'],
          path: basicMeta.path,
          name: basicMeta.name,
          duration: basicMeta.duration,
          width: basicMeta.width,
          height: basicMeta.height,
        })

        // 2. 백그라운드: ffprobe 상세 메타 + 썸네일 생성
        const assetId = basicMeta.id
        setLoadingIds((prev) => new Set([...prev, assetId]))
        ;(async () => {
          try {
            const detailed = await tauriInvoke<AssetMeta>('asset_probe', { path: filePath })
            updateAsset(assetId, {
              duration: detailed.duration,
              width: detailed.width,
              height: detailed.height,
            })

            if (detailed.asset_type === 'video') {
              const baseDir = await appLocalDataDir()
              const thumbPath = await join(baseDir, 'thumbnails', `${assetId}.jpg`)
              try {
                await tauriInvoke<string>('generate_thumbnail', {
                  assetPath: filePath,
                  timeSec: 0.5,
                  outputPath: thumbPath,
                })
                updateThumbnail(assetId, thumbPath)
              } catch {
                // 썸네일 생성 실패 시 무시 (FFmpeg 미설치 환경)
              }
            }
          } catch (error) {
            console.warn('[AssetPanel] asset_probe failed, keep basic metadata:', { filePath, error })
            // ffprobe 실패 시 기본 메타 유지
          } finally {
            setLoadingIds((prev) => {
              const next = new Set(prev)
              next.delete(assetId)
              return next
            })
          }
        })()
      }
    },
    [addAsset, showError, updateAsset, updateThumbnail]
  )

  // Tauri 전역 파일 드롭 이벤트 등록
  // Tauri 2.x 이벤트: tauri://drag-enter, tauri://drag-leave, tauri://drag-drop
  // payload: { paths: string[]; position?: { x: number; y: number } }
  // cancelled 플래그: React StrictMode 이중 마운트 시 async tauriListen 이중 등록 방지
  useEffect(() => {
    let cancelled = false
    const unlisteners: Array<() => void> = []
    ;(async () => {
      try {
        const unEnter = await tauriListen<{ paths: string[] }>('tauri://drag-enter', () => {
          setIsDragging(true)
        })
        if (cancelled) {
          unEnter()
          return
        }
        unlisteners.push(unEnter)

        const unLeave = await tauriListen<void>('tauri://drag-leave', () => {
          setIsDragging(false)
        })
        if (cancelled) {
          unLeave()
          return
        }
        unlisteners.push(unLeave)

        const unDrop = await tauriListen<{ paths: string[]; position?: { x: number; y: number } }>(
          'tauri://drag-drop',
          (event) => {
            setIsDragging(false)
            handleFilePaths(event.payload.paths)
          }
        )
        if (cancelled) {
          unDrop()
          return
        }
        unlisteners.push(unDrop)
      } catch {
        // Tauri 환경이 아닐 때 무시
      }
    })()
    return () => {
      cancelled = true
      for (const fn of unlisteners) fn()
    }
  }, [handleFilePaths])

  const handleOpenDialog = async () => {
    try {
      const result = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: [
              'mp4',
              'mov',
              'avi',
              'mkv',
              'webm',
              'mp3',
              'wav',
              'aac',
              'flac',
              'ogg',
              'm4a',
              'png',
              'jpg',
              'jpeg',
              'gif',
              'webp',
              'bmp',
            ],
          },
        ],
      })
      if (!result) return
      const paths = Array.isArray(result) ? result : [result]
      handleFilePaths(paths)
    } catch (error) {
      if (isDialogCanceled(error)) return
      const reason = toErrorMessage(error, '파일 선택 창을 열지 못했습니다.')
      console.error('[AssetPanel] open dialog failed:', error)
      showError(`파일 선택 실패: ${reason}`)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        p: 1,
        outline: isDragging ? '2px solid' : 'none',
        outlineColor: 'primary.main',
        borderRadius: 1,
        transition: 'outline 0.1s',
      }}
    >
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', fontWeight: 'bold' }}>
          ASSETS
        </Typography>
        <Tooltip title="파일 추가">
          <IconButton size="small" onClick={handleOpenDialog}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 에셋 없을 때: 빈 드롭존 */}
      {assets.length === 0 ? (
        <Box
          sx={{
            flex: 1,
            border: '1px dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            bgcolor: isDragging ? 'action.hover' : 'transparent',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}
          onClick={handleOpenDialog}
        >
          <AddIcon sx={{ color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="caption" color="text.disabled" align="center">
            파일을 드롭하거나
            <br />
            클릭하여 추가
          </Typography>
        </Box>
      ) : (
        // 에셋 목록
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {assets.map((asset) => (
            <DraggableAssetItem
              key={asset.id}
              asset={asset}
              isSelected={asset.id === selectedAssetId}
              isLoading={loadingIds.has(asset.id)}
              onSelect={() => setSelectedAsset(asset.id)}
            />
          ))}
        </Box>
      )}

      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={4200}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}

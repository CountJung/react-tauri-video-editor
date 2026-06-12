import { isTauriRuntime, tauriInvoke, tauriListen } from '@/lib/invoke'
import { getDisplayableMediaSrc } from '@/lib/mediaSource'
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
import { useCallback, useEffect, useRef, useState } from 'react'

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

const MEDIA_EXTENSIONS = [
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
] as const

const MEDIA_ACCEPT = MEDIA_EXTENSIONS.map((extension) => `.${extension}`).join(',')
const WEB_METADATA_TIMEOUT_MS = 5000

function getAssetTypeFromFile(file: File): Asset['type'] | null {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'image'

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext) return null
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return 'audio'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image'
  return null
}

function hashString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i)
  }
  return Math.abs(hash).toString(36)
}

function finiteDuration(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function loadWebAssetMetadata(
  url: string,
  type: Asset['type']
): Promise<Pick<Asset, 'duration' | 'width' | 'height'>> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('metadata timeout'))
    }, WEB_METADATA_TIMEOUT_MS)

    const done = (metadata: Pick<Asset, 'duration' | 'width' | 'height'>) => {
      window.clearTimeout(timeout)
      resolve(metadata)
    }
    const fail = () => {
      window.clearTimeout(timeout)
      reject(new Error('metadata load failed'))
    }

    if (type === 'image') {
      const image = new Image()
      image.onload = () =>
        done({ duration: 0, width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = fail
      image.src = url
      return
    }

    const media =
      type === 'audio' ? document.createElement('audio') : document.createElement('video')
    media.preload = 'metadata'
    media.onloadedmetadata = () =>
      done({
        duration: finiteDuration(media.duration, type === 'audio' ? 0 : 5),
        width: type === 'video' ? (media as HTMLVideoElement).videoWidth : undefined,
        height: type === 'video' ? (media as HTMLVideoElement).videoHeight : undefined,
      })
    media.onerror = fail
    media.src = url
  })
}

async function createWebAssetFromFile(file: File): Promise<Asset> {
  const type = getAssetTypeFromFile(file)
  if (!type) throw new Error('지원하지 않는 파일 형식입니다.')

  const url = URL.createObjectURL(file)
  try {
    const metadata = await loadWebAssetMetadata(url, type)
    const id = `web-${hashString(`${file.name}:${file.size}:${file.lastModified}:${file.type}`)}`
    return {
      id,
      type,
      path: url,
      name: file.name,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      thumbnailPath: type === 'image' ? url : undefined,
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
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
            src={getDisplayableMediaSrc(asset.thumbnailPath)}
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { assets, addAsset, updateAsset, updateThumbnail, selectedAssetId, setSelectedAsset } =
    useAssetStore()

  const showError = useCallback((message: string) => {
    setErrorMessage(message)
  }, [])

  const handleWebFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const asset = await createWebAssetFromFile(file)
          addAsset(asset)
          setSelectedAsset(asset.id)
        } catch (error) {
          const reason = toErrorMessage(error, '파일을 추가하지 못했습니다.')
          showError(`파일 추가 실패: ${reason}`)
        }
      }
    },
    [addAsset, setSelectedAsset, showError]
  )

  const handleFilePaths = useCallback(
    async (paths: string[]) => {
      for (const filePath of paths) {
        // 1. 기본 메타데이터 임포트 (즉시 목록에 추가)
        let basicMeta: AssetMeta
        try {
          basicMeta = await tauriInvoke<AssetMeta>('asset_import', { path: filePath })
        } catch (error) {
          const reason = toErrorMessage(error, '파일을 추가하지 못했습니다.')
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
          } catch {
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
    if (!isTauriRuntime()) {
      fileInputRef.current?.click()
      return
    }

    try {
      const result = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: [...MEDIA_EXTENSIONS],
          },
        ],
      })
      if (!result) return
      const paths = Array.isArray(result) ? result : [result]
      handleFilePaths(paths)
    } catch (error) {
      if (isDialogCanceled(error)) return
      const reason = toErrorMessage(error, '파일 선택 창을 열지 못했습니다.')
      showError(`파일 선택 실패: ${reason}`)
    }
  }

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? [])
      event.currentTarget.value = ''
      if (files.length > 0) void handleWebFiles(files)
    },
    [handleWebFiles]
  )

  const handleNativeDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isTauriRuntime() || !Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }, [])

  const handleNativeDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isTauriRuntime()) return
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    setIsDragging(false)
  }, [])

  const handleNativeDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTauriRuntime()) return
      const files = Array.from(event.dataTransfer.files ?? [])
      if (files.length === 0) return
      event.preventDefault()
      setIsDragging(false)
      void handleWebFiles(files)
    },
    [handleWebFiles]
  )

  return (
    <Box
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
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
      <input
        ref={fileInputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        hidden
        onChange={handleFileInputChange}
      />

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

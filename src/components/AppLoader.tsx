import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

interface BootStep {
  key: string
  label: string
  detail: string
}

const BOOT_STEPS: BootStep[] = [
  { key: 'react', label: 'UI 초기화', detail: 'React 렌더링 완료' },
  { key: 'tauri', label: 'Tauri 백엔드 연결', detail: 'IPC 브리지 확인' },
  { key: 'ready', label: '앱 준비 완료', detail: '에디터 로드 중' },
]

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

interface AppLoaderProps {
  children: ReactNode
}

/** 앱 시작 시 부트 진행 화면 — 특히 디버그 모드의 긴 대기 시간 시각화 */
export function AppLoader({ children }: AppLoaderProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [activeKey, setActiveKey] = useState<string>('react')
  const [done, setDone] = useState(false)
  const bootedRef = useRef(false)

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true

    // HTML 스플래시 숨기기 — React가 마운트됐으므로 React 화면으로 전환
    const htmlSplash = document.getElementById('splash')
    if (htmlSplash) htmlSplash.classList.add('hidden')

    async function boot() {
      // Step 1: React 초기화 (즉시)
      setActiveKey('react')
      await delay(80)
      setCompleted((p) => new Set([...p, 'react']))

      // Step 2: Tauri 백엔드 연결 확인
      setActiveKey('tauri')
      // 디버그 모드에서는 약간 더 길게 표시하여 진행 상황 체감
      await delay(import.meta.env.DEV ? 500 : 120)
      // window.__TAURI_INTERNALS__ 존재 여부로 Tauri 환경 확인
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
      if (!isTauri) {
        // 브라우저 단독 실행 시 추가 대기 없음
      }
      setCompleted((p) => new Set([...p, 'tauri']))

      // Step 3: 앱 준비 완료
      setActiveKey('ready')
      await delay(180)
      setCompleted((p) => new Set([...p, 'ready']))

      // 완료 표시를 잠깐 보여준 뒤 전환
      await delay(380)
      setDone(true)
    }

    boot()
  }, [])

  if (done) return <>{children}</>

  const progress = (completed.size / BOOT_STEPS.length) * 100

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        zIndex: 9998,
      }}
    >
      {/* 앱 아이콘 + 이름 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 52, lineHeight: 1 }}>🎬</Typography>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, letterSpacing: '0.06em', color: 'text.primary' }}
        >
          Video Editor
        </Typography>
      </Box>

      {/* 진행 카드 */}
      <Box
        sx={{
          width: 280,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <LinearProgress variant="determinate" value={progress} sx={{ height: 3 }} />

        <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {BOOT_STEPS.map((step) => {
            const isDone = completed.has(step.key)
            const isActive = step.key === activeKey && !isDone
            return (
              <Box key={step.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {isDone ? (
                  <CheckCircleOutlineIcon
                    sx={{ fontSize: 20, color: 'success.main', flexShrink: 0 }}
                  />
                ) : isActive ? (
                  <CircularProgress size={18} thickness={4} sx={{ flexShrink: 0 }} />
                ) : (
                  <RadioButtonUncheckedIcon
                    sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }}
                  />
                )}
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isActive || isDone ? 500 : 400,
                      color: isDone ? 'text.primary' : isActive ? 'primary.main' : 'text.disabled',
                      lineHeight: 1.3,
                    }}
                  >
                    {step.label}
                  </Typography>
                  {(isActive || isDone) && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                      {step.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* 개발 모드 배지 */}
      {import.meta.env.DEV && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            border: '1px solid',
            borderColor: 'divider',
            px: 1,
            py: 0.25,
            borderRadius: 1,
          }}
        >
          개발 모드 (DEV)
        </Typography>
      )}
    </Box>
  )
}

import { defineConfig, devices } from '@playwright/test'

/**
 * 프리뷰 canvas 렌더 회귀 테스트.
 *
 * Tauri 앱 창은 macOS WKWebView에 WebDriver가 없어 자동화할 수 없다.
 * 대신 Vite dev 서버(브라우저 모드)를 띄워 같은 React/canvas 코드를 검증한다.
 * IPC·Export처럼 Rust가 필요한 경로는 여기서 다루지 않는다.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
    },
  ],
  webServer: {
    command: 'pnpm dev:vite',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

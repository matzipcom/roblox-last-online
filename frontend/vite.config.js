import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createApp } from '../server/app.js'
import { loadEnv } from '../server/env.js'
import { STANDALONE_PATH, serveStandalone } from '../server/standalone.js'

// Roblox API 는 CORS 를 허용하지 않으므로 /api 요청을 서버 핸들러가 대신 처리한다.
// 개발(dev)/미리보기(preview) 서버에서는 별도 프로세스 없이 같은 핸들러를 마운트한다.
// 루트의 단일 파일 버전(index.html)도 /standalone 으로 함께 제공한다.
function robloxApi() {
  let app
  const mount = (server) => {
    loadEnv()
    if (!app) {
      app = createApp()
      app.tracker.start()
    }
    const { handleApi } = app
    server.httpServer?.once('close', () => {
      app?.tracker.stop()
      app?.store.close()
      app = null
    })
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/')) return handleApi(req, res)
      if (req.url?.split('?')[0] === STANDALONE_PATH) return serveStandalone(req, res)
      next()
    })
  }
  return { name: 'roblox-api', configureServer: mount, configurePreviewServer: mount }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), robloxApi()],
})

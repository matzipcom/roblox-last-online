import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { loadEnv } from './env.js'
import { STANDALONE_PATH, serveStandalone } from './standalone.js'

loadEnv()

const DIST_DIR = fileURLToPath(new URL('../frontend/dist', import.meta.url))
const PORT = Number(process.env.PORT) || 3000

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: https://*.rbxcdn.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

async function resolveStaticFile(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const filePath = normalize(join(DIST_DIR, decoded))
  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + sep)) return null

  try {
    const info = await stat(filePath)
    if (info.isFile()) return filePath
  } catch {
    // 정적 파일이 없으면 SPA 진입점으로 대체한다.
  }
  return null
}

async function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost')
  const hasExtension = extname(pathname) !== ''
  let filePath = await resolveStaticFile(pathname)

  if (!filePath && hasExtension) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS })
    return res.end('Not found')
  }
  filePath ??= join(DIST_DIR, 'index.html')

  try {
    const body = await readFile(filePath)
    const immutable = filePath.includes(`${sep}assets${sep}`)
    res.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...SECURITY_HEADERS,
    })
    res.end(body)
  } catch {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('프런트엔드가 빌드되지 않았습니다. `npm run build` 를 먼저 실행하세요.')
  }
}

const { handleApi, tracker } = createApp()

createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return handleApi(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    return res.end()
  }
  if (new URL(req.url, 'http://localhost').pathname === STANDALONE_PATH) return serveStandalone(req, res)
  return serveStatic(req, res)
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT} 에서 실행 중`)
  tracker.start()
})

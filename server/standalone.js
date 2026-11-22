import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const STANDALONE_PATH = '/standalone'

const STANDALONE_FILE = fileURLToPath(new URL('../index.html', import.meta.url))

const sha256 = (content) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`

function inlineHashes(html, tag) {
  const blocks = html.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))
  return [...blocks].map((match) => sha256(match[1]))
}

// 인라인 스크립트/스타일은 'unsafe-inline' 대신 내용 해시로만 허용한다.
export function buildStandaloneCsp(html) {
  const scripts = inlineHashes(html, 'script')
  const styles = inlineHashes(html, 'style')
  return [
    "default-src 'self'",
    "img-src 'self' data: https://*.rbxcdn.com",
    `script-src ${scripts.join(' ') || "'none'"}`,
    `style-src ${styles.join(' ') || "'none'"}`,
    "frame-ancestors 'none'",
  ].join('; ')
}

export async function serveStandalone(req, res) {
  let html
  try {
    html = await readFile(STANDALONE_FILE, 'utf8')
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('index.html 을 찾을 수 없습니다.')
  }

  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache',
    'content-security-policy': buildStandaloneCsp(html),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(html)
}

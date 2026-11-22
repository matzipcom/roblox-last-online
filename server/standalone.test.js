import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { buildStandaloneCsp } from './standalone.js'

const hash = (content) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`

describe('buildStandaloneCsp', () => {
  it('인라인 script/style 을 unsafe-inline 없이 내용 해시로만 허용한다', () => {
    const csp = buildStandaloneCsp('<style>a{color:red}</style><script type="module">alert(1)</script>')

    assert.ok(csp.includes(`script-src ${hash('alert(1)')}`))
    assert.ok(csp.includes(`style-src ${hash('a{color:red}')}`))
    assert.ok(!csp.includes('unsafe-inline'))
  })

  it('인라인 블록이 없으면 none 으로 막는다', () => {
    const csp = buildStandaloneCsp('<p>hi</p>')

    assert.match(csp, /script-src 'none'/)
    assert.match(csp, /style-src 'none'/)
  })

  it('실제 index.html 의 모든 인라인 script/style 이 허용된다', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
    const csp = buildStandaloneCsp(html)

    const blocks = [...html.matchAll(/<(script|style)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)]
    assert.ok(blocks.length >= 2)
    for (const [, , content] of blocks) assert.ok(csp.includes(hash(content)))
  })
})

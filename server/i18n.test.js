import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { applyBlock } from '../scripts/sync-i18n.mjs'
import { DEFAULT_LANGUAGE, LANGUAGES, MESSAGES, detectLanguage, translate } from '../frontend/src/lib/messages.js'

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('번역 사전', () => {
  it('모든 언어가 같은 키와 같은 자리표시자를 가진다', () => {
    const base = MESSAGES[DEFAULT_LANGUAGE]
    for (const { code } of LANGUAGES) {
      assert.deepEqual(Object.keys(MESSAGES[code]).sort(), Object.keys(base).sort(), `${code} 키 불일치`)
      for (const [key, text] of Object.entries(MESSAGES[code])) {
        assert.ok(text.trim() !== '', `${code}.${key} 가 비어 있음`)
        assert.deepEqual(placeholders(text), placeholders(base[key]), `${code}.${key} 자리표시자 불일치`)
      }
    }
  })

  it('브라우저 언어를 감지하고 없으면 영어로 대체한다', () => {
    assert.equal(detectLanguage(['ja-JP', 'en']), 'ja')
    assert.equal(detectLanguage(['fr-FR', 'ko-KR']), 'ko')
    assert.equal(detectLanguage(['fr-FR']), 'en')
    assert.equal(detectLanguage(undefined), 'en')
  })

  it('자리표시자를 치환하고, 없는 키는 영어 → 키 순으로 대체한다', () => {
    assert.equal(translate('ko', 'card.id', { id: 7 }), 'ID 7')
    assert.equal(translate('ja', 'error.apiBadResponse', { status: 404 }), 'APIの応答を解析できませんでした (HTTP 404)。')
    assert.equal(translate('xx', 'card.refresh'), 'Refresh')
    assert.equal(translate('en', 'does.not.exist'), 'does.not.exist')
  })

  it('루트 index.html 에 인라인된 사전이 messages.js 와 동기화되어 있다', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
    assert.equal(applyBlock(html), html, '`npm run i18n:sync` 를 실행하세요.')
  })
})

const BATCH_SIZE = 100
const PRUNE_EVERY_MS = 6 * 3600_000

// 추적 대상의 접속 상태를 주기적으로 조회해 저장소에 기록한다.
export function createTracker({ client, store, intervalMs = 300_000, log = console }) {
  let timer = null
  let running = false
  let lastPrune = 0
  let backoffUntil = 0

  async function pollOnce(now = Date.now()) {
    if (running || now < backoffUntil) return { polled: 0 }
    running = true
    try {
      const ids = await store.listTargetIds()
      let polled = 0
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE)
        const presences = await client.getPresences(batch)
        for (const [id, presence] of presences) await store.record(id, presence)
        polled += presences.size
      }
      if (now - lastPrune >= PRUNE_EVERY_MS) {
        lastPrune = now
        const removed = await store.prune()
        if (removed) log.info(`[tracker] 보관 기간이 지난 기록 ${removed}건 삭제`)
      }
      return { polled }
    } catch (err) {
      // 인증 실패/한도 초과 시 곧바로 재시도하지 않고 한 주기 쉰다.
      backoffUntil = now + intervalMs
      log.warn(`[tracker] 수집 실패: ${err.message}`)
      return { polled: 0, error: err }
    } finally {
      running = false
    }
  }

  function start() {
    if (timer) return
    if (!client.presenceConfigured) {
      log.warn('[tracker] ROBLOX_COOKIE 가 없어 접속 기록 수집을 시작하지 않습니다.')
      return
    }
    log.info(`[tracker] ${intervalMs / 1000}초마다 접속 상태를 수집합니다.`)
    timer = setInterval(() => void pollOnce(), intervalMs)
    timer.unref()
    void pollOnce()
  }

  function stop() {
    clearInterval(timer)
    timer = null
  }

  return { start, stop, pollOnce }
}

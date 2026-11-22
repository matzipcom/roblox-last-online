import { createCloudflareApp } from '../server/cloudflare.js'

// 5분마다(Cron Trigger) 추적 대상의 접속 상태를 수집한다.
export default {
  async scheduled(_event, env, ctx) {
    const { tracker } = createCloudflareApp(env)
    ctx.waitUntil(tracker.pollOnce())
  },
  fetch() {
    return new Response('roblox-last-online tracker', { status: 200 })
  },
}

import { createCloudflareApp } from '../../server/cloudflare.js'

let app

// Cloudflare Pages Functions: /api/* 요청을 처리한다. (D1 바인딩 이름: DB)
export function onRequest({ request, env }) {
  if (!env.DB) {
    return Response.json(
      { error: { code: 'NOT_CONFIGURED', message: 'D1 바인딩(DB)이 설정되지 않았습니다.' } },
      { status: 500 },
    )
  }
  app ??= createCloudflareApp(env)
  return app.handle(request)
}

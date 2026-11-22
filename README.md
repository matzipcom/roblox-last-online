# roblox-last-online

Roblox 사용자 이름 또는 ID로 **마지막 접속 시간**과 **현재 접속 상태**(온라인 / 게임 중 / Studio / 오프라인)를 조회하는 웹사이트입니다.

- 사용자 이름 / 사용자 ID 두 가지 방식으로 검색
- 마지막 접속 시간(상대 + 절대 시각), 현재 상태, 플레이 중인 게임, 가입일, 인증 배지, 정지 여부, 아바타
- 최근 검색, 공유 가능한 링크(`?name=…` / `?id=…`), 모바일 대응

## 동작 방식과 반드시 알아야 할 제약

Roblox API는 브라우저에서 직접 호출할 수 없고(CORS 미지원), **마지막 접속 시간(`lastOnline`)은 로그인된 요청에서만 제공**됩니다.
인증 없이 호출하면 모든 사용자가 "오프라인"으로 위장되어 응답하므로, 이 사이트는 그런 값을 보여주지 않습니다.

그래서 이 프로젝트는 작은 서버(의존성 없는 Node.js)가 Roblox API를 대신 호출합니다.

| 정보 | 인증 필요 | 비고 |
| --- | --- | --- |
| 프로필(이름, 가입일, 인증 배지, 정지 여부), 아바타 | 아니요 | 항상 동작 |
| 마지막 접속 시간 / 현재 상태 | **예** (`ROBLOX_COOKIE`) | 설정하지 않으면 "접속 정보를 조회할 수 없습니다"로 표시 |

> ⚠️ **`ROBLOX_COOKIE` 주의사항**
> - 개인 계정이 아닌 **전용 보조 계정**의 `.ROBLOSECURITY` 쿠키를 사용하세요. 쿠키가 유출되면 계정이 탈취될 수 있습니다.
> - 쿠키는 서버 환경변수로만 사용되며 브라우저로 전달되지 않습니다. 절대 커밋하거나 공유하지 마세요. (`.env`는 `.gitignore`에 포함되어 있습니다.)
> - 자동화된 요청에 계정 쿠키를 쓰는 것은 Roblox 이용약관상 제재 위험이 있을 수 있습니다. 사용에 따른 책임은 운영자에게 있습니다.
> - 대상 사용자의 개인정보(접속 상태 공개 범위) 설정에 따라 보조 계정에서도 접속 시간이 보이지 않을 수 있으며, 이 경우 "확인할 수 없음"으로 표시됩니다.

## 시작하기

요구 사항: Node.js 22 이상

```bash
cd frontend && npm install && cd ..
cp .env.example .env        # 접속 정보 조회를 쓰려면 ROBLOX_COOKIE 를 채워 넣으세요
npm run dev                 # http://localhost:5173
```

개발 서버(Vite)가 `/api/*` 요청을 직접 처리하므로 별도 프로세스가 필요 없습니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (HMR + API) |
| `npm run build` | 프런트엔드 프로덕션 빌드 (`frontend/dist`) |
| `npm start` | 빌드 결과물과 API를 함께 서빙하는 프로덕션 서버 (`PORT`, 기본 3000) |
| `npm test` | 서버 로직 단위 테스트 |
| `npm run lint` | 프런트엔드 + 서버 린트 (oxlint) |

> `npm run dev -- --port 3000` 처럼 루트 스크립트에 옵션을 넘기면 npm이 옵션을 가로채 올바르게 전달되지 않습니다. 포트를 바꾸려면 `npm --prefix frontend run dev -- --port 3000` 을 사용하세요.

## 접속 기록 수집 (마지막 접속 시간 추적)

Roblox가 마지막 접속 시간을 주지 않거나 공개되지 않는 사용자를 위해, 서버가 접속 상태를 **주기적으로 수집해 SQLite(`data/presence.db`)에 저장**합니다.

- `ROBLOX_COOKIE` 가 설정되어 있으면, 사이트에서 조회된 사용자가 자동으로 추적 목록에 추가됩니다(최대 `TRACK_MAX_TARGETS`, 기본 200명).
- 서버는 `TRACK_INTERVAL_SECONDS`(기본 300초)마다 추적 대상 전원의 상태를 100명씩 묶어 한 번에 조회합니다.
- 온라인/게임 중/Studio 상태가 관찰될 때마다 "마지막으로 접속이 관찰된 시각"을 갱신하고, 오프라인이 되면 그 값이 마지막 접속 시간이 됩니다. Roblox가 `lastOnline` 을 직접 주면 그 값을 우선 사용합니다.
- **한계:** 추적을 시작하기 전의 접속은 알 수 없고, 수집 주기만큼 오차가 있습니다. 처음 조회한 사용자는 접속이 관찰될 때까지 "수집을 시작했습니다"로 표시됩니다.
- 인증 실패/한도 초과 시 한 주기 동안 수집을 쉬어 호출을 반복하지 않습니다.

### 개인정보 / 삭제
- 상태 변화 기록은 `TRACK_RETENTION_DAYS`(기본 30일)가 지나면 자동 삭제됩니다. 마지막 접속 시각만 남습니다.
- 특정 사용자의 추적 중단과 기록 삭제: `ADMIN_TOKEN` 을 설정한 뒤
  `curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/track?id=<사용자 ID>"`
  (토큰이 없으면 이 API는 비활성화됩니다.) 다만 삭제 후 해당 사용자를 다시 조회하면 다시 추적됩니다.
- `data/` 는 `.gitignore` 에 포함되어 있습니다. 서버 외부로 내보내지 않으며, 운영자가 법령/약관을 준수할 책임이 있습니다.

## 단일 파일 버전 (`index.html`)

루트의 [index.html](./index.html) 은 빌드 없이 동작하는 **독립 실행형 버전**입니다. CSS/JS가 모두 인라인되어 있고 React 앱과 같은 기능·디자인을 제공합니다.

- `npm run dev` 또는 `npm start` 로 서버를 띄우면 **`/standalone`** (예: `http://localhost:5173/standalone`) 으로 열립니다. `?name=…` / `?id=…` 링크도 동일하게 동작합니다.
- VS Code **Live Server** 로 `index.html` 을 열 때는 [.vscode/settings.json](./.vscode/settings.json) 의 프록시 설정이 `/api` 를 `localhost:5173` 으로 넘겨줍니다. 먼저 `npm run dev` 를 실행하고, 설정이 적용되도록 Live Server 를 껐다 켜세요.
- 같은 출처의 `/api/user` 를 호출하므로 파일을 `file://` 로 직접 열면 동작하지 않습니다. 정적 호스팅에 올릴 때는 `/api/*` 를 이 서버로 프록시하세요.
- 인라인 코드는 `unsafe-inline` 대신 CSP 해시로 허용합니다. 서버가 요청마다 `index.html` 내용에서 해시를 계산하므로 파일을 수정해도 별도 작업이 필요 없습니다.
- React 앱(`frontend/`)과 UI/로직이 중복되므로, 기능을 바꿀 때는 양쪽에 반영하세요.

## 환경변수

| 이름 | 설명 |
| --- | --- |
| `ROBLOX_COOKIE` | 접속 정보 조회용 보조 계정의 `.ROBLOSECURITY` 값 (선택) |
| `PORT` | `npm start` 포트 (기본 3000) |
| `TRUST_PROXY` | 리버스 프록시 뒤에서 `1` 로 설정하면 `X-Forwarded-For` 로 클라이언트 IP를 판별 (레이트 리밋용) |

## API

`GET /api/user?name=<사용자 이름>` 또는 `GET /api/user?id=<사용자 ID>`

```jsonc
{
  "user": { "id": 156, "name": "builderman", "displayName": "builderman", "hasVerifiedBadge": true,
            "isBanned": false, "created": "2006-03-08T17:17:52.9Z", "description": "…" },
  "avatarUrl": "https://tr.rbxcdn.com/…",
  "presence": {
    "available": true,
    "status": "offline",            // online | in-game | studio | offline | invisible
    "lastOnline": "2026-11-20T10:00:00.000Z",   // 공개되지 않으면 null
    "lastLocation": null,           // in-game / studio 일 때만
    "placeId": null
  }
  // 조회 불가 시: "presence": { "available": false, "reason": "NO_AUTH" | "AUTH_FAILED" | … }
}
```

오류는 `{ "error": { "code", "message" } }` 형태이며 상태 코드는 400(잘못된 입력) / 404(사용자 없음) / 429(요청 한도) / 502(Roblox 오류)입니다.

서버는 Roblox의 요청 한도(`users/{id}` 는 IP당 분당 30회)를 보호하기 위해 결과를 메모리에 캐시(프로필 5분, 아바타 10분, 접속 정보 30초)하고, 클라이언트 IP당 분당 30회로 요청을 제한합니다.

## 배포

`npm run build` 후 `npm start` 로 Node.js 서버 하나만 띄우면 됩니다. 환경변수(`ROBLOX_COOKIE`)는 호스팅 서비스의 시크릿으로 설정하세요.
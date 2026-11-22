import { fileURLToPath } from 'node:url'

// 저장소 루트의 .env 를 (있을 때만) process.env 로 읽어온다. 이미 설정된 환경변수는 덮어쓰지 않는다.
export function loadEnv() {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

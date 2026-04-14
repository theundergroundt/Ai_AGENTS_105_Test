# Runtime Architecture

## Purpose

런타임 연결 구조와 실행 경계를 정리한다.

## Notes

- 실행 시작은 `server/index.js`다.
- 개발 모드는 `npm run dev -> node server/index.js --dev`로 뜬다.
- 이 서버는 Next.js request handler와 WebSocket proxy를 함께 붙인다.

## Main Connection Path

1. 브라우저가 Studio에 접속한다.
2. 브라우저는 `window.location` 기준 same-origin WebSocket URL을 계산한다.
3. 그 URL은 `/api/gateway/ws`다.
4. Studio 서버는 이 WebSocket을 받아 `server/gateway-proxy.js`에서 upstream gateway로 다시 연결한다.
5. browser frame과 upstream frame을 중계한다.

## Key Boundary

- Browser -> Studio
  - same-origin HTTP + WebSocket
- Studio -> Upstream runtime
  - 별도 WebSocket 또는 custom runtime HTTP 경로
- Local settings
  - Studio host 파일시스템에 저장
  - 브라우저가 직접 파일을 다루지 않는다

## Provider Seam

- provider 생성은 `src/lib/runtime/createRuntimeProvider.ts`에서 결정된다.
- 지원 provider:
  - `openclaw`
  - `hermes`
  - `demo`
  - `custom`
- 이 구조 덕분에 Claw3D는 특정 backend 구현에 완전히 고정되지 않는다.

## Custom Runtime Reading

- `custom` provider는 OpenClaw WebSocket 프로토콜을 그대로 흉내내는 구조가 아니다.
- 대신 HTTP 기반 `/health`, `/state`, `/registry`, `/v1/chat/completions`를 읽어 synthetic agent/session view를 만든다.
- 따라서 새 멀티 에이전트 backend를 붙일 때는 두 가지 선택지가 있다.
  - OpenClaw 호환 gateway를 구현한다.
  - `custom` provider seam에 맞는 runtime boundary를 만든다.

## Practical Interpretation

- Claw3D를 바탕으로 새 서비스를 만들 때 가장 안전한 확장점은 UI 내부를 크게 뒤엎는 것이 아니라 runtime/provider 경계를 이용하는 것이다.

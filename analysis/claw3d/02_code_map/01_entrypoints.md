# Entrypoints

## Purpose

실행 진입점과 핵심 엔트리 파일을 정리한다.

## Notes

- 서버 진입점
  - `server/index.js`
  - custom Node server, access gate, gateway proxy를 묶는다
- WebSocket proxy 핵심
  - `server/gateway-proxy.js`
  - `/api/gateway/ws` 업그레이드 처리
- Studio 설정 로딩
  - `server/studio-settings.js`
  - upstream URL/token과 state dir 해석

## App Router Entrypoints

- `src/app/page.tsx`
  - `/` -> `/office` redirect
- `src/app/agents/page.tsx`
  - `/agents` -> `/office` redirect
- `src/app/office/page.tsx`
  - 메인 office 진입점
  - `AgentStoreProvider`와 `OfficeScreen`을 감싼다
- `src/app/office/builder/page.tsx`
  - builder 진입점
  - published office map을 읽어 editor 패널을 연다

## Runtime Connection Entrypoints

- `src/lib/runtime/useRuntimeConnection.ts`
  - gateway 연결 상태 + provider 선택을 하나로 묶는다
- `src/lib/runtime/createRuntimeProvider.ts`
  - adapter type에 따라 provider 인스턴스를 생성한다
- `src/lib/gateway/GatewayClient.ts`
  - 브라우저 쪽 gateway 연결 상태, auto connect/retry, settings sync를 담당한다

## Main Screen Entrypoints

- `src/features/office/screens/OfficeScreen.tsx`
  - 현재 앱의 사실상 메인 조합 지점
  - runtime connection, agent store, office animation, chat/panel/modal 흐름이 이 파일에 많이 모여 있다
- `src/features/retro-office/RetroOffice3D.tsx`
  - Three.js 기반 3D office 렌더링 중심
- `src/features/office/components/OfficePhaserCanvas.tsx`
  - Phaser builder/viewer 축

## Server API Entrypoints

- `src/app/api/studio/route.ts`
  - Studio settings 읽기/쓰기
- `src/app/api/office/route.ts`
  - office metadata, version, published map 관리

## Initial Take

- 첫 번째로 이해해야 할 파일은 `server/index.js`, `src/app/office/page.tsx`, `src/features/office/screens/OfficeScreen.tsx`, `src/lib/gateway/GatewayClient.ts`다.
- 이 4개를 이해하면 실행 구조와 데이터 흐름의 대부분이 잡힌다.

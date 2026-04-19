# gatewayEx 구조

## 현재 폴더 구성

```text
gatewayEx/
├─ 01-server.impl.ts
├─ 02-server-runtime-state.ts
├─ 03-server-http.ts
├─ 04-ws-connection.ts
├─ work_logs/
│  └─ 2026-04-19/
└─ 정리/
   ├─ README.md
   ├─ 00-정리-원칙.md
   ├─ 01-구조/
   ├─ 02-흐름/
   └─ 03-파일/
```

## 구조 해석

- 소스 파일은 총 4개다.
- 숫자 접두사는 읽는 순서를 거의 그대로 나타낸다.
- 파일명만 보면 단순하지만, 실제로는 gateway 서버의 계층을 단계별로 잘라 놓은 구조다.

## 파일 계층

1. `01-server.impl.ts`
   게이트웨이 전체를 조립하고 시작하는 최상위 진입점
2. `02-server-runtime-state.ts`
   HTTP 서버, WebSocketServer, broadcast, 메모리 런타임 상태 생성
3. `03-server-http.ts`
   HTTP 요청 라우팅과 WebSocket upgrade 진입 처리
4. `04-ws-connection.ts`
   WebSocket 연결 1개의 생명주기와 handshake 처리

## 중요한 관찰

- 이 폴더만으로는 완전 실행이 어렵다.
- 이유는 각 파일이 `../config/...`, `../plugins/...`, `./server/...` 같은 원래 프로젝트 내부 모듈을 많이 참조하기 때문이다.
- 따라서 이 폴더는 "독립 앱"보다는 "게이트웨이 구조 학습용 코드 묶음"으로 이해하는 편이 맞다.

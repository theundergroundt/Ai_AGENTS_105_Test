# 02-server-runtime-state.ts

## 역할

- 네트워크 런타임 생성자
- 실제 listen 중인 HTTP 서버와 `noServer` WebSocketServer를 준비

## 여기서 만드는 것

- canvas host handler
- HTTP 서버와 bind host 목록
- `WebSocketServer({ noServer: true })`
- upgrade handler 연결
- connected client 집합
- broadcast 함수
- chat run 상태
- dedupe 상태
- tool event recipient registry

## 핵심 해석

- 이 파일은 "서버를 구성하는 메모리 상태와 네트워크 객체"를 한 번에 만든다.
- HTTP 서버가 네트워크 입구이고, WebSocketServer는 그 위에 올라가는 구조다.
- 즉 WebSocket도 결국 HTTP 서버를 통해 들어온다.

## 기억할 포인트

- `createGatewayRuntimeState()`가 중심 함수다
- WebSocketServer는 직접 listen하지 않는다
- `attachGatewayUpgradeHandler()`가 HTTP와 WebSocket 사이 다리 역할을 한다

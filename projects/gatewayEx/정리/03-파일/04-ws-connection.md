# 04-ws-connection.ts

## 역할

- WebSocket 연결 1개의 생명주기를 관리
- handshake, 연결 메타데이터, 종료 정리를 담당

## 연결 직후 하는 일

- `connId` 생성
- 소켓의 원격/로컬 주소 수집
- upgrade 요청의 `Host`, `Origin`, `User-Agent` 수집
- `connect.challenge` 이벤트 전송
- handshake timeout 시작

## 연결 중 관리하는 것

- preauth budget 해제 시점
- 마지막 프레임 메타데이터
- role=node 클라이언트 정리
- presence 갱신
- session event 구독 해제
- disconnect 로그 정리

## 핵심 해석

- 모바일 앱이나 브라우저는 단순히 소켓만 열고 끝나는 것이 아니라, 반드시 `connect` RPC로 인증과 역할 등록을 마쳐야 한다.
- 즉 "연결 성공"과 "게이트웨이 프로토콜 handshake 성공"은 다르다.

## 기억할 포인트

- 서버가 먼저 `connect.challenge`를 보낸다
- preauth budget 누수를 막기 위한 해제 로직이 중요하다
- 실제 RPC 프레임 파싱과 method dispatch는 별도 message handler로 넘긴다

# Runtime

## One-Line Definition

- `runtime`은 agent나 프로그램이 실제로 돌아가는 실행 환경과 실행 계층이다.

## Why It Matters

- 같은 agent 코드라도 어디서 어떻게 실행되느냐에 따라 권한, 성능, 연결 방식, 보안 경계가 달라진다.
- 그래서 agent를 설계할 때는 기능만이 아니라 "어느 runtime에서 돌릴 것인가"를 같이 정해야 한다.

## What Runtime Usually Includes

- 실행 프로세스
  - 예: Python 프로세스, Node 프로세스
- 실행 환경
  - 예: 로컬 머신, Docker, SSH 서버, sandbox
- 연결 방식
  - 예: 로컬 호출, RPC, WebSocket, queue
- 권한 범위
  - 예: 파일 접근, 네트워크 접근, 시스템 명령 허용 범위

## Easy Analogy

- runtime은 배우가 서는 "무대"에 가깝다.
- 같은 대본이라도 어느 무대에서 연기하느냐에 따라 조명, 소품, 이동 범위가 다르다.

## In Agent Systems

- agent loop가 실제로 실행되는 곳
- tool이 호출되는 곳
- memory나 state store와 붙는 곳
- model provider와 연결되는 곳

이 네 가지가 runtime에서 많이 결정된다.

## OpenClaw Context

- OpenClaw는 gateway와 session 중심 runtime 성격이 강하다.
- 여러 채널 입력이 들어오면 gateway가 세션과 상태를 잡고, 그 위에서 agent loop가 돈다.
- 즉 OpenClaw에서 runtime은 단순히 "모델을 부르는 코드"가 아니라 session, tools, events까지 포함한 실행 계층이다.

## Hermes Context

- Hermes는 runtime 범위가 더 넓다.
- 로컬, Docker, SSH, Modal 같은 다양한 execution backend까지 포괄한다.
- 그래서 Hermes는 단순한 assistant보다 "여러 runtime 위에서 사는 agent" 느낌이 강하다.

## NemoClaw Context

- NemoClaw는 OpenClaw runtime을 OpenShell sandbox 위에 더 안전하게 올리는 쪽에 초점이 있다.
- 여기서는 runtime을 "어디서 안전하게 실행할 것인가"가 핵심이다.

## Runtime vs Sandbox

- runtime은 실행 환경 전체를 뜻한다.
- sandbox는 그 runtime을 제한된 권한으로 감싸는 특정 방식이다.
- 즉 sandbox는 runtime의 한 형태이거나, runtime을 보호하는 실행 경계다.

## In DeskMate

- 초기 DeskMate runtime은 너무 무겁지 않은 편이 좋다.
- `assistant router -> feature agent -> state update -> dashboard/iot event` 정도의 최소 실행 흐름이 먼저 필요하다.
- 그 다음 필요할 때 sandbox나 별도 worker runtime을 붙이는 편이 맞다.

## Short Summary

- `runtime`은 agent가 실제로 동작하는 실행 계층이다.
- 기능 구현만큼이나 권한, 연결, 배포, 안전성에 영향을 준다.

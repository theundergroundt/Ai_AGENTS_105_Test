# DeskMate Minimal Runtime Architecture

## Goal

- DeskMate MVP를 구현하기 위한 최소 runtime/orchestrator 구조를 정의한다.
- OpenClaw의 `session-first execution`, `gateway owns state` 개념은 가져오되, 다채널 플랫폼 복잡도는 제거한다.

## One-Line Shape

- `web request -> assistant router -> selected agent -> task/session state update -> dashboard/iot event`

## Core Principle

- 사용자에게는 하나의 비서만 보인다.
- 내부에서는 assistant가 적절한 기능 agent를 선택한다.
- 상태는 중앙 orchestrator가 소유한다.
- agent는 독립 제품이 아니라 기능별 worker다.

## MVP Scope

### In Scope

- Assistant entry 1개
- Agent 2개
  - Scheduler / Reminder
  - Wellness 또는 Code Review 중 1개
- Dashboard
- IoT notification bridge
- Task/session state store

### Out Of Scope

- 모바일 앱
- 삼성 헬스 연동
- 복잡한 멀티 에이전트 협업
- nested sub-agent
- 범용 plugin marketplace
- OpenClaw식 multi-channel routing

## Minimal Components

### 1. Web Client

- 사용자 요청 입력
- 현재 실행 상태 표시
- 최근 완료 작업 표시
- 예정된 리마인더 표시

### 2. DeskMate API Server

- 모든 요청의 단일 진입점
- assistant router 호출
- task/session state 저장
- dashboard 이벤트 발행
- IoT bridge로 상태 전파

### 3. Assistant Router

- 자연어 요청 분류
- 어떤 agent를 실행할지 결정
- 필요한 경우 추가 질문 생성
- 최종 응답 요약 생성

### 4. Feature Agents

- Scheduler Agent
- Wellness Agent 또는 Code Review Agent

각 agent는:

- 입력 payload를 받는다
- 자기 도메인 작업을 수행한다
- 결과와 상태를 표준 형태로 반환한다

### 5. State Store

- task 상태
- session 상태
- reminder 일정
- 최근 결과 요약

### 6. Event Bus

- 상태 변경 이벤트
- task 시작/완료/실패 이벤트
- reminder 트리거 이벤트
- IoT 알림 이벤트

초기에는 별도 메시지 브로커 없이 서버 내부 event emitter + WebSocket으로 시작 가능하다.

### 7. IoT Bridge

- 서버 이벤트를 ESP32가 이해할 수 있는 단순 이벤트로 변환
- LED 또는 부저 상태를 제어

## Recommended Runtime Topology

### Option A: FastAPI-Centered MVP

- `frontend`
  - React dashboard
- `backend`
  - FastAPI
  - assistant router
  - scheduler
  - event streaming
  - agent adapters
- `db`
  - PostgreSQL
- `iot`
  - ESP32 + MQTT

### Why This Is Good

- LLM 호출과 agent 로직을 같은 언어로 다루기 쉽다.
- MVP 속도가 빠르다.
- 나중에 agent worker 분리도 쉽다.

### Option B: Spring Boot Main + Python Agent Worker

- `frontend`
  - React dashboard
- `backend`
  - Spring Boot
  - API, scheduler, persistence, websocket
- `agent-worker`
  - FastAPI 또는 Python worker
- `db`
  - PostgreSQL
- `iot`
  - ESP32 + MQTT

### Why This Is Good

- 팀이 Spring Boot에 익숙하면 안정적인 백엔드 개발에 유리하다.
- 다만 MVP 초기에 프로세스 경계가 하나 더 생긴다.

## Recommended Start

- 팀 생산성이 중요하면 `FastAPI 중심 단일 백엔드`로 시작하는 것을 우선 추천한다.
- Spring Boot를 꼭 써야 하는 이유가 명확하면 `Spring Boot + Python worker`로 간다.

## Minimum Data Model

### UserRequest

- id
- userId
- text
- createdAt

### Session

- id
- userId
- currentContextSummary
- activeTaskId
- updatedAt

### Task

- id
- type
  - reminder
  - wellness
  - code-review
- status
  - accepted
  - running
  - waiting_input
  - completed
  - failed
- input
- outputSummary
- createdAt
- updatedAt

### Reminder

- id
- userId
- taskId
- scheduledAt
- deliveredAt
- deliveryStatus

## Minimum Execution Flow

### Flow A: Reminder

1. 사용자가 웹에서 요청한다.
2. API server가 request를 저장한다.
3. Assistant router가 Scheduler Agent로 분기한다.
4. Scheduler Agent가 reminder를 등록한다.
5. Task 상태를 `accepted -> completed`로 변경한다.
6. Dashboard가 상태를 갱신한다.
7. 시간이 되면 reminder event를 발행한다.
8. IoT bridge가 LED/부저 알림을 보낸다.

### Flow B: Wellness

1. 사용자가 웹에서 요청한다.
2. Assistant router가 Wellness Agent를 선택한다.
3. 추가 질문이 필요하면 task 상태를 `waiting_input`으로 둔다.
4. 사용자 응답이 들어오면 Wellness Agent가 추천을 생성한다.
5. 결과 요약을 저장한다.
6. Dashboard와 IoT에 완료 이벤트를 보낸다.

## Assistant Router Contract

### Input

- user message
- current session summary
- optional active task context

### Output

- selected agent
- normalized task type
- required follow-up questions
- execution payload

## Agent Contract

모든 agent는 같은 형태를 따르는 것이 좋다.

### Input

- taskId
- userId
- sessionId
- normalized payload

### Output

- status
- humanReadableSummary
- structuredResult
- followUpNeeded
- followUpQuestion

## What We Reuse From OpenClaw

- 중앙 control plane이 상태를 소유하는 사고방식
- 세션 기준 실행 일관성
- accepted 후 비동기 progress 흐름
- assistant는 하나로 보이고 내부에서만 라우팅되는 UX

## What We Explicitly Reject

- 채널/계정/peer 기준 범용 routing
- node/canvas/pairing/remote gateway 생태계
- 조기 sub-agent depth 확장
- 범용 plugin platform

## Phase Plan

### Phase 1

- React dashboard
- API server
- assistant router
- Scheduler Agent
- Wellness Agent
- WebSocket 상태 갱신
- ESP32 LED 알림

### Phase 2

- Code Review Agent 추가
- task 결과 이력 강화
- agent별 prompt/policy 분리

### Phase 3

- mobile app 검토
- health data integration 검토
- sub-agent delegation 필요 시 도입

## Immediate Decisions

1. MVP 두 번째 agent를 Wellness로 할지 Code Review로 할지 정한다.
2. 메인 백엔드를 FastAPI 중심으로 할지 Spring Boot 중심으로 할지 정한다.
3. IoT는 LED-only로 시작할지 부저까지 포함할지 정한다.

## Current Recommendation

- MVP는 `Scheduler + Wellness + Dashboard + ESP32 LED`가 가장 현실적이다.
- Code Review는 발표 임팩트는 있지만, 실제 품질과 Git 연동 복잡도가 더 크다.
- 따라서 1차는 Wellness를 넣고, 2차에 Code Review를 붙이는 쪽이 구현 리스크가 낮다.

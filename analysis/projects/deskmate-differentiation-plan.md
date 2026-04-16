# DeskMate Differentiation Plan

## Goal

- OpenClaw, Hermes, NemoClaw를 비교해서 DeskMate가 어떤 제품으로 차별화될지 정리한다.

## One-Line Thesis

- DeskMate는 범용 agent platform이 아니라, 사용자의 작업과 생활 루틴을 함께 관리하고 웹과 IoT로 상태를 보여주는 `desk assistant product`로 가야 한다.

## Reference Read Summary

### OpenClaw

- 강점은 멀티채널 personal assistant와 gateway control plane이다.
- DeskMate에 유의미한 것은 `state ownership`, `session-first execution`, `assistant UX`다.
- 하지만 채널 확장성과 platform breadth는 우리 MVP와 맞지 않는다.

### Hermes

- 강점은 self-improving assistant platform, memory, skills, automation, delegate 구조다.
- DeskMate에 유의미한 것은 `확장 가능한 assistant 철학`과 `도구/agent 분리 가능성`이다.
- 하지만 초기 단계에서 너무 넓은 product surface를 만들 위험이 있다.

### NemoClaw

- 강점은 OpenClaw를 더 안전하게 배포하기 위한 sandbox, policy, onboarding discipline이다.
- DeskMate에 유의미한 것은 `runtime hardening`과 `host/runtime 분리` 개념이다.
- 하지만 제품 기능 차별화와는 거리가 있고 MVP 단계에는 과하다.

## DeskMate Product Position

- 사용자에게는 하나의 비서로 보인다.
- 내부적으로는 기능형 agent가 라우팅된다.
- 차별화 포인트는 채널 수나 학습 루프가 아니라 `보이는 상태`, `실제 알림`, `생활과 작업을 잇는 흐름`이다.

## What Makes DeskMate Different

### 1. Desk Context

- 일반적인 chat assistant가 아니라 책상 위에서 쓰는 assistant로 정의한다.
- 웹 대시보드와 IoT 장치를 통해 현재 상태가 물리적으로 보인다.

### 2. Work + Routine Integration

- 일정, 리마인더, 루틴, 가벼운 웰니스가 같은 assistant 안에서 이어진다.
- 생산성과 생활 지원이 분리된 별도 앱이 아니라 하나의 흐름으로 연결된다.

### 3. Explainable Orchestration

- 어떤 요청이 어떤 agent로 갔는지 설명 가능해야 한다.
- agent를 많이 두는 것보다 "왜 이 agent가 선택됐는가"가 더 중요하다.

### 4. Narrower but More Intentional Scope

- OpenClaw처럼 모든 채널을 지원하지 않는다.
- Hermes처럼 모든 agent 기능을 다 품지 않는다.
- NemoClaw처럼 운영 stack 자체를 제품 메시지로 내세우지 않는다.
- 대신 발표와 데모에서 강하게 보이는 경험을 먼저 만든다.

## Recommended DeskMate Message

- "사용자의 작업과 생활 루틴을 함께 관리하는 AI desk assistant"
- "멀티 에이전트는 내부 구현 방식이고, 사용자는 하나의 비서를 경험한다"
- "웹 대시보드와 IoT 피드백으로 상태가 보이는 assistant"

## What To Borrow

- OpenClaw에서
  - central orchestration
  - session/state ownership
  - assistant-first UX
- Hermes에서
  - 확장 가능한 assistant 구조
  - automation 감각
  - 장기적으로 memory를 붙일 수 있는 방향
- NemoClaw에서
  - security boundary 사고방식
  - onboarding validation
  - runtime isolation 개념

## What Not To Build First

- 멀티채널 메신저 assistant
- self-improving skill loop
- 무거운 sandbox platform
- 복수 subagent의 복잡한 병렬 협업
- 모바일 앱과 외부 건강 데이터 연동

## Recommended MVP Identity

- assistant entry 1개
- Scheduler Agent
- Wellness Agent
- dashboard
- ESP32 LED 또는 부저 알림

## Presentation Angle

- 기술 비교보다 제품 차별화가 먼저다.
- "왜 이 제품이 필요한가"를 `보이는 상태`, `실제 개입`, `책상 위 경험`으로 설명한다.
- 오픈소스 분석은 "우리가 그대로 베끼지 않고 왜 자체 구조로 갔는가"를 설득하는 근거로 쓴다.

# Project Guide

## Purpose

이 문서는 우리 프로젝트의 기준 문서다.

- 기획서 원문을 보관한다.
- 구현 가능성 판단을 누적한다.
- MVP 범위와 구조 방향을 계속 갱신한다.
- 세부 분석 문서가 늘어나더라도 최종 요약은 다시 이 문서로 모은다.

## Current Project Name

- Working name: `DeskMate`

## One-Line Summary

- 하나의 비서 AI가 여러 전문 agent를 호출해 사용자 요청을 처리하고, 웹과 IoT 디바이스로 상태와 결과를 보여주는 AI 비서형 멀티 에이전트 서비스

## Current Judgment

- 구현 자체는 가능하다.
- 하지만 현재 기획 범위는 한 번에 만들기에는 넓다.
- 특히 `멀티 에이전트 + 코드리뷰 + 일정 + 웰니스 + IoT + 삼성 헬스 연동 + 웹/앱`을 동시에 잡으면 MVP가 흐려질 가능성이 크다.
- 따라서 1차 구현은 핵심 흐름만 남긴 축소 버전으로 시작하는 것이 맞다.
- 방향은 `오픈소스 재사용 서비스`가 아니라 `오픈소스 분석 기반 자체 개발`로 잡는다.

## Product Positioning

- 사용자는 이 서비스를 "멀티 에이전트 플랫폼"보다 "개인 비서 서비스"로 느껴야 한다.
- 멀티 에이전트는 내부 구현 방식이고, 외부 제품 메시지는 비서 경험에 맞춘다.

## Differentiation

### What We Should Not Be

- OpenClaw, Hermes, Claw3D를 그대로 묶은 재포장 서비스
- agent 수만 많고 사용자 가치가 약한 데모
- 기술 스택만 복잡한 멀티 에이전트 실험 프로젝트

### What We Should Be

- 생산성과 생활 루틴을 함께 다루는 AI desk assistant
- 상태가 보이는 비서 서비스
- 웹 + IoT를 연결한 물리적 피드백이 있는 비서 경험
- 왜 이 agent가 선택됐는지 설명 가능한 orchestration

### Internal Differentiation Rule

- OpenClaw, Hermes, Claw3D는 구현 복제 대상이 아니다.
- 각 오픈소스에서 책임 분리 방식과 좋은 구조만 추출한다.
- 최종 시스템은 우리 요구사항에 맞는 자체 구조로 다시 설계한다.

### Differentiation Against References

- OpenClaw와의 차이
  - OpenClaw는 멀티채널 assistant product가 강점이다.
  - DeskMate는 채널 확장보다 책상 위에서 보이는 dashboard와 IoT 피드백이 강점이어야 한다.
- Hermes와의 차이
  - Hermes는 self-improving, memory-heavy, broad platform agent에 가깝다.
  - DeskMate는 범용 agent OS보다 일상과 작업 흐름에 바로 닿는 assistant UX를 우선한다.
- NemoClaw와의 차이
  - NemoClaw는 secure runtime reference stack이다.
  - DeskMate는 runtime hardening을 장기 과제로 두고, 초기에는 제품 경험과 도메인 집중도를 우선한다.

## Recommended MVP

### Must Have

- 비서 AI 진입점 1개
- agent 라우팅 2종
  - Scheduler / Reminder Agent
  - Diet / Wellness Agent 또는 Code Review Agent 중 1개
- 웹 대시보드
  - 현재 작업 상태
  - 최근 완료 작업
  - 예정된 리마인더
- IoT 알림 1종
  - LED 또는 단순 부저

### Should Defer

- 모바일 앱
- 삼성 헬스 연동
- 복수 agent 동시 협업
- 복잡한 memory
- 정교한 approval flow
- PR URL만 넣으면 자동 인증까지 처리하는 완전한 코드리뷰 파이프라인

## Feasibility Review

### Overall

- 서비스 방향은 충분히 구현 가능하다.
- 데모성과 발표력도 강하다.
- 다만 기능 종류가 너무 많아 초기 구조가 무거워질 위험이 있다.

### What Is Realistic Now

- 자연어 요청 -> 라우터 -> agent 실행 -> 상태 업데이트 -> 웹 표시 -> IoT 알림
- 이 핵심 루프는 현재 기술로 안정적으로 만들 수 있다.

### What Is Harder Than It Looks

- 진짜 멀티 에이전트 협업
- 건강 데이터 기반 개인화 추천
- Git provider 인증이 포함된 코드리뷰 자동화
- 모바일 앱, 웹, IoT를 동시에 완성도 있게 만드는 것

## Main Product Decomposition

### 1. Assistant Layer

- 사용자 요청을 받는 단일 진입점
- 요청 분류
- agent 선택
- 결과 요약

### 2. Agent Layer

- 기능별 작업 실행
- 초기에는 agent 수를 최소화한다
- agent는 플러그인처럼 교체 가능해야 한다

### 3. Orchestrator / Backend Layer

- 요청 접수
- 작업 상태 관리
- 스케줄 관리
- 이벤트 발행
- 결과 저장

### 4. Interface Layer

- 웹 대시보드
- IoT 상태 표시
- 추후 모바일 앱

## Architecture Direction

### Recommended Early Shape

- `Frontend`
  - Web dashboard 1개로 시작
- `Backend`
  - API + task orchestration + scheduler + event publisher
- `Agent services`
  - 기능별 실행 모듈
- `IoT bridge`
  - MQTT 또는 WebSocket으로 상태 수신

### Important Direction

- 처음부터 “복잡한 멀티 에이전트 협업”으로 가지 않는다.
- 먼저 “비서 AI가 적절한 agent 하나를 호출하는 구조”로 시작한다.
- 그 다음 필요하면 `assistant -> sub-agent delegation` 구조로 확장한다.

### Reference Mapping

- Hermes
  - 운영 방식과 역할 분리 참고
- OpenClaw
  - runtime, execution, tool 구조 참고
- Claw3D
  - 상태 시각화, gateway, control plane 분리 참고
- NemoClaw
  - runtime hardening, onboarding, sandbox 참고 대상으로 유지

### OpenClaw-Specific Takeaway

- OpenClaw는 "product = assistant, gateway = control plane" 관점이 강하다.
- DeskMate도 사용자에게는 하나의 비서로 보이고, 내부에서만 agent 라우팅이 보이게 하는 방향이 맞다.
- 다만 OpenClaw의 다채널 플랫폼 복잡도는 DeskMate MVP에 과하므로 가져오지 않는다.

### Self-Build Rule

- runtime, orchestration, state flow는 우리 제품 요구에 맞게 직접 설계한다.
- 특정 오픈소스의 내부 모델이나 flow를 그대로 재현하는 것을 목표로 두지 않는다.
- 분석 결과는 "가져올 것 / 버릴 것 / 직접 만들 것" 관점으로 정리한다.

## Tech Stack Review

### Current Proposal

- Frontend: React 또는 React Native
- Backend: Spring Boot
- AI / Agent: Python FastAPI
- Database: PostgreSQL
- IoT: ESP32 + MQTT or WebSocket

### Review

- 기술적으로 가능하다.
- 하지만 MVP 기준으로는 stack 수가 많다.
- 팀 규모가 크지 않다면 backend와 agent orchestration을 너무 분리하지 않는 편이 낫다.

### Recommendation

- 웹 데모 우선이면:
  - React
  - Backend 1개
  - Agent execution 1개
  - PostgreSQL
  - ESP32 + MQTT
- 팀이 Python 기반 AI 개발에 익숙하면:
  - FastAPI 중심으로 시작하는 쪽이 MVP 속도에 유리할 수 있다.
- 팀이 Spring Boot에 더 익숙하고 AI 호출만 분리하고 싶다면:
  - Spring Boot를 메인 서버
  - Python agent worker를 보조 서비스

## Major Risks

### 1. Scope Explosion

- 일정, 코드리뷰, 웰니스, 건강 데이터, IoT를 다 동시에 넣으면 구조보다 기능만 늘어난다.

### 2. False Multi-Agent Complexity

- 실제로는 agent가 여러 개여도 orchestration이 단순 라우팅일 수 있다.
- 이를 억지로 복잡한 multi-agent처럼 만들면 개발 비용만 커진다.

### 3. Health Data Integration

- 삼성 헬스와 Health Connect는 권한, 플랫폼 제약, 사용자 동의가 중요하다.
- 핵심 기능이 아니라면 반드시 후순위로 둬야 한다.

### 4. Code Review Agent Reliability

- 코드리뷰는 단순 요약은 쉽지만, 실제로 신뢰할 만한 리뷰 품질을 만들기는 어렵다.
- 초기에는 “도움이 되는 리뷰 보조”로 포지셔닝하는 편이 안전하다.

### 5. Too Many Clients

- 웹, 모바일, IoT를 동시에 잡으면 발표용 데모는 화려해지지만 구현 안정성이 떨어질 수 있다.

## Recommended MVP Scenario

### Scenario A

- 사용자가 웹에서 “오후 5시에 회의 준비하라고 알려줘” 요청
- assistant가 Scheduler Agent 호출
- 작업 등록
- 웹 대시보드에 예정 작업 표시
- 시간 도달 시 IoT LED 또는 부저 알림

### Scenario B

- 사용자가 웹에서 “오늘 저녁 식단 추천해줘” 요청
- assistant가 Wellness Agent 호출
- 간단한 질의응답 후 추천 제공
- 결과를 웹과 IoT 완료 알림으로 표시

이 두 시나리오만 안정적으로 구현해도 MVP 데모는 충분히 성립한다.

## Open Questions

- 1차 MVP에서 Code Review Agent를 넣을지, Wellness Agent를 넣을지
- 모바일 앱을 진짜 만들지, 발표용 웹만 먼저 할지
- 메인 서버를 Spring Boot로 갈지 FastAPI 중심으로 갈지
- 상태 관리를 polling이 아니라 event-driven으로 어디까지 구현할지
- IoT 디바이스는 LED 중심으로 단순화할지, 소형 디스플레이까지 넣을지

## Next Decisions Needed

1. MVP agent 2개 확정
2. 메인 backend stack 확정
3. 웹 우선인지 앱 동시 개발인지 확정
4. IoT 알림 수준 확정
5. 건강 데이터 연동 제외 여부 확정

## Minimal Runtime Architecture

- 현재 최소 구조 기준 문서는 `minimal-runtime-architecture.md`다.
- 이 문서를 바탕으로 MVP 구현 단위를 자른다.
- OpenClaw에서 배운 `gateway owns state`, `session-first execution`은 이 문서에 번역해 둔다.

## Analysis Rule Going Forward

- OpenClaw, Hermes, Claw3D를 보면서 바로 구현하지 않는다.
- 먼저 각 소스에서:
  - 가져올 것
  - 버릴 것
  - 직접 만들 것
  을 나눈다.
- 그 뒤에만 DeskMate 구조를 갱신한다.

## Presentation Rule

- 발표자료는 `../presentation` 폴더에 따로 쌓는다.
- 발표용 문서는 기술 분석 문서의 요약본이어야 한다.
- 발표 메시지는 "멀티 에이전트 기술"보다 "왜 이 제품이 사용자에게 의미 있는가"를 먼저 설명해야 한다.
- 비교 기반 제품 차별화 초안은 `../../../analysis/projects/deskmate-differentiation-plan.md`를 기준으로 한다.

## Original Brief

### Project Name

- `DeskMate`

### Project Summary

- AI agent를 연결해 사용자의 작업과 생활 루틴을 도와주고, 결과와 상태를 웹과 IoT 디바이스로 직관적으로 보여주는 개인 비서 서비스

### Background

- 기존 AI 서비스는 답변형 챗봇에 머무는 경우가 많다.
- 사용자는 단순 답변보다 실제 작업 실행, 완료 알림, 생활 루틴 개입까지 해주는 비서형 서비스를 원한다.
- 본 서비스는 비서 AI가 전문 agent를 연결하고, 웹과 IoT로 상태를 보여준다는 점에서 차별화를 둔다.

### Core Goals

- 자연어 요청을 받아 적절한 agent를 선택하고 실행하는 멀티 에이전트 오케스트레이션 구조
- 코드리뷰, 일정 알림, 루틴 추천 등을 플러그인형 agent 구조로 분리
- 웹/앱 + IoT 기반 상태 전달
- 삼성 헬스 기반 웰니스 개인화 기능 확장

### Candidate Functions

- Code Review Agent
- Scheduler / Reminder Agent
- Diet / Wellness Agent
- Health Data Companion Agent

### Interfaces

- 모바일 앱 / 웹
- 시각화 웹 대시보드
- IoT 디바이스

### Suggested Stack

- React 또는 React Native
- Spring Boot
- Python FastAPI
- PostgreSQL
- ESP32
- MQTT 또는 WebSocket
- Health Connect

## Notes From Brief

- 웰니스 기능은 실제 사용자 식사/운동 맥락을 묻고 이어서 추천하는 대화형 흐름이 중요하다.
- Health 데이터는 핵심 기능이 아니라 개인화 강화를 위한 부가 기능으로 보는 게 맞다.
- 발표/데모 관점에서는 IoT와 상태 시각화가 강한 차별점이다.

## Next Update Rule

- 기획 변경이 생기면 먼저 이 문서를 갱신한다.
- 구현 가능성 판단이 바뀌면 `Current Judgment`와 `Feasibility Review`를 같이 수정한다.
- 세부 설계가 생기면 별도 문서를 만들되 결론은 다시 이 문서로 올린다.

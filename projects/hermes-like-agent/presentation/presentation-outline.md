# DeskMate Presentation Outline

## 1. Problem

- 기존 AI 챗봇은 답변은 잘하지만 사용자의 실제 작업 흐름과 생활 루틴에 깊게 개입하지 못한다.
- 상태가 보이지 않고, 결과가 물리적으로 체감되지 않는 경우가 많다.

## 2. Opportunity

- 사용자는 단순 답변형 AI보다 "일을 맡기고, 상태를 보고, 적절한 시점에 개입받는 비서"를 원한다.
- 책상 위 환경에서는 dashboard와 IoT를 통해 이 경험을 더 직관적으로 만들 수 있다.

## 3. Product

- DeskMate는 작업과 생활 루틴을 함께 관리하는 AI desk assistant다.
- 사용자에게는 하나의 비서로 보이지만, 내부적으로는 기능형 agent가 요청을 처리한다.

## 4. Why Multi-Agent

- 멀티 에이전트는 목적이 아니라 구현 방식이다.
- 요청 종류에 따라 적절한 specialist agent를 고르는 구조가 유지보수와 확장에 유리하다.

## 5. Differentiation

- OpenClaw와 달리 멀티채널 assistant가 아니라 desk context에 집중한다.
- Hermes와 달리 범용 self-improving platform이 아니라 제품 경험과 데모 명확성에 집중한다.
- NemoClaw와 달리 secure runtime stack이 아니라 사용자-facing assistant 경험을 먼저 만든다.

## 6. Core Experience

- 자연어 요청
- 적절한 agent 라우팅
- dashboard 상태 반영
- IoT 알림 피드백

## 7. MVP

- Scheduler Agent
- Wellness Agent
- Web Dashboard
- ESP32 LED 또는 부저 알림

## 8. Architecture

- Assistant Router
- Feature Agents
- State Store
- Dashboard
- IoT Bridge

## 9. Demo Scenario

- "오후 5시에 회의 준비하라고 알려줘"
- "오늘 저녁 식단 추천해줘"
- 요청 처리 상태가 웹과 IoT에 함께 반영됨

## 10. Expected Impact

- 사용자는 단순 답변이 아니라 실제 개입형 assistant 경험을 얻는다.
- 팀은 오픈소스 재포장이 아니라 자체 구조 설계 능력을 보여줄 수 있다.

# Orchestrator

## One-Line Definition

- `orchestrator`는 여러 작업, agent, 상태, 이벤트의 흐름을 조정하는 제어 계층이다.

## Why It Matters

- agent 시스템이 커질수록 "누가 무엇을 언제 실행할지"를 정하는 계층이 필요해진다.
- orchestrator가 없으면 기능은 많아져도 흐름이 엉키고, 상태 추적과 확장이 어려워진다.

## What An Orchestrator Usually Does

- 요청을 분류한다
- 적절한 agent나 tool을 선택한다
- 실행 순서를 정한다
- 상태를 기록한다
- 진행 이벤트를 외부에 전달한다
- 실패나 재시도를 관리한다

## Easy Analogy

- orchestrator는 오케스트라의 지휘자와 비슷하다.
- 직접 악기를 연주하지는 않지만, 누가 언제 들어오고 어떤 순서로 흐를지 결정한다.

## In Agent Systems

- 단일 agent 시스템에서도 orchestrator는 있을 수 있다.
- 사용자가 보기엔 하나의 assistant여도, 내부에서는:
  - 어떤 session으로 갈지
  - 어떤 tool을 쓸지
  - 어떤 agent에게 넘길지
  - 어떤 상태를 업데이트할지
  를 조정하는 계층이 필요하다.

## Orchestrator vs Agent

- agent는 실제 작업을 수행하는 실행 주체에 가깝다.
- orchestrator는 그 agent들을 언제 어떻게 쓰는지 결정하는 제어자에 가깝다.

## Orchestrator vs Runtime

- runtime은 "어디서 돌고 있나"에 더 가깝다.
- orchestrator는 "어떻게 흐름을 조정하나"에 더 가깝다.

## OpenClaw Context

- OpenClaw에서는 gateway가 많은 orchestration 책임을 함께 가진다.
- session, routing, accepted -> progress -> result 흐름, agent binding 등이 모두 orchestration 성격을 띤다.

## DeskMate Context

- DeskMate에서는 assistant router가 초반 orchestrator 역할을 맡는 구조가 자연스럽다.
- 예를 들면:
  - 일정 요청이면 Scheduler Agent
  - 루틴/식단 요청이면 Wellness Agent
  - 결과는 dashboard와 IoT에 이벤트로 반영

## Why This Matters For DeskMate

- DeskMate는 "멀티 에이전트"를 보여주기 위해 agent 수를 늘리기보다, orchestrator가 명확하게 흐름을 관리하는 쪽이 중요하다.
- 발표에서도 agent 수보다 orchestration의 설명 가능성이 더 설득력 있다.

## Short Summary

- `orchestrator`는 agent 시스템의 흐름 관리자다.
- 멀티 에이전트의 핵심은 agent 수보다 orchestrator의 구조가 더 중요하다.

# Project Overview

## Goal

- Hermes와 유사한 운영 철학을 참고하되, 우리 요구사항에 맞는 자체 AI agent 시스템을 만든다.

## Working Name

- `DeskMate`

## Likely Reference Inputs

- Hermes
- OpenClaw
- Claw3D
- NemoClaw

## Open Questions

- 단일 agent 중심으로 시작할지 multi-agent로 바로 갈지
- runtime과 orchestration을 어디서 나눌지
- approval, memory, tool execution을 어떤 경계로 분리할지

## Current Analysis Order

1. Claw3D
2. OpenClaw
3. Hermes
4. NemoClaw
5. 우리 프로젝트 구조 초안

## MVP Direction

- 비서 AI 진입점 1개
- Scheduler / Reminder Agent
- Wellness Agent 또는 Code Review Agent 중 1개
- 웹 대시보드
- 단순 IoT 알림

## Runtime Baseline

- 최소 구조 기준은 `minimal-runtime-architecture.md`를 따른다.

## Build Stance

- OpenClaw, Hermes, Claw3D를 그대로 가져다 쓰지 않는다.
- 분석을 통해 좋은 구조를 추출하고, DeskMate는 자체 개발 구조로 만든다.

## Current Differentiation Direction

- OpenClaw처럼 채널 중심 assistant로 가지 않는다.
- Hermes처럼 범용 self-improving agent platform으로 바로 가지 않는다.
- NemoClaw처럼 runtime hardening stack 자체를 제품 핵심으로 삼지 않는다.
- 대신 `desk assistant`, `상태 가시화`, `IoT 피드백`, `work + routine 통합 경험`을 제품 핵심으로 둔다.

## Presentation Materials

- 발표 정리 초안은 `../presentation` 폴더에 모은다.
- 차별화 기획 기준 문서는 `../../../analysis/projects/deskmate-differentiation-plan.md`다.

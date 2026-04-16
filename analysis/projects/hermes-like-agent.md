# Hermes-Like Agent Project Analysis

## Goal

- Hermes 방식에 가깝지만 우리 요구사항에 맞는 자체 AI agent 구조를 설계한다.
- 현재 working product name은 `DeskMate`다.

## Candidate References

- Claw3D
- OpenClaw
- Hermes
- NemoClaw

## Questions To Keep Updating

- runtime orchestration은 어디까지 직접 만들 것인가
- UI는 초기에 필요한가
- gateway 또는 adapter 계층이 필요한가
- agent memory, tool execution, approval flow를 어떻게 나눌 것인가
- 어떤 오픈소스 구조를 가져오고 어떤 부분은 버릴 것인가

## Current Plan

- 구조 요약은 `../requests/workspace-current-structure.md`를 기준으로 본다.
- 분석 순서와 산출물은 `hermes-like-agent-analysis-roadmap.md`를 기준으로 누적한다.
- 제품 기준 문서는 `../../projects/hermes-like-agent/docs/project-guide.md`를 우선 참조한다.
- 외부 오픈소스는 복제 대상이 아니라 분석 대상이다.

## Current Synthesis

- OpenClaw에서 참고할 핵심은 `assistant product + gateway control plane`이다.
- Hermes에서 참고할 핵심은 `확장 가능한 assistant 운영 철학`이다.
- NemoClaw에서 참고할 핵심은 `runtime hardening과 onboarding discipline`이다.
- DeskMate의 제품 차별화는 위 세 가지를 섞는 것이 아니라, `웹 대시보드 + IoT 피드백 + work/routine 통합 비서 경험`으로 다시 설계하는 데 있다.

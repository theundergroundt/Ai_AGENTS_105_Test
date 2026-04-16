# Hermes-Like Agent Analysis Roadmap

## Goal

- Claw3D, OpenClaw, Hermes, NemoClaw를 비교 분석해서 우리 프로젝트의 초기 구조를 결정한다.

## Analysis Principles

- 외부 소스는 그대로 따라 만들지 않고 역할과 경계만 뽑아낸다.
- UI, runtime, orchestration, tool execution, memory를 분리해서 본다.
- 문서화는 "사실", "해석", "우리 프로젝트 적용 포인트" 순서로 누적한다.
- 하나의 저장소를 다 읽기보다 진입점과 핵심 흐름부터 잡는다.

## Priority Order

1. Claw3D
2. OpenClaw
3. Hermes
4. NemoClaw
5. 우리 프로젝트 구조 초안

## Why This Order

- Claw3D는 현재 가장 익숙한 기준이며 UI, gateway, control plane 분리를 보는 데 유리하다.
- OpenClaw는 runtime과 실행 경계를 이해하는 핵심 참고 대상이다.
- Hermes는 우리 프로젝트와 가장 가까운 운영 방식 후보라서, 앞선 두 분석 위에서 비교할 때 더 선명해진다.
- NemoClaw는 제품 기능보다 runtime hardening 참고 대상으로, 구조 비교의 마지막에 보는 편이 맞다.

## Phase 1: Claw3D

### Questions

- Studio와 upstream runtime의 경계는 어디인가
- gateway proxy와 adapter는 어떤 책임을 가지는가
- agent 상태, 이벤트, approvals는 어떻게 전달되는가
- UI가 runtime에 얼마나 강하게 결합돼 있는가

### Outputs

- 실행 진입점 요약
- gateway 흐름 요약
- state/event 모델 요약
- 우리 프로젝트에 참고할 UI 없는 구조 포인트

## Phase 2: OpenClaw

### Questions

- 실제 agent runtime 진입점은 어디인가
- tool execution, plugin, provider, channel 계층은 어떻게 나뉘는가
- state와 config는 어디서 관리되는가
- Claw3D가 붙을 수 있는 경계는 어디인가

### Outputs

- runtime lifecycle 요약
- execution loop 요약
- extension/plugin 구조 요약
- 우리 프로젝트에 필요한 최소 runtime 요소 목록

## Phase 3: Hermes

### Questions

- multi-agent 역할 분리는 어떻게 되는가
- orchestration은 어떤 단위로 흐르는가
- task delegation, memory, approval, tool usage는 어떤 방식으로 연결되는가
- 우리 프로젝트가 바로 가져올 수 있는 핵심 패턴은 무엇인가

### Outputs

- 역할 모델 요약
- orchestration 흐름 요약
- 참고할 패턴과 버릴 패턴 구분
- 우리 프로젝트 MVP용 운영 모델 초안

## Phase 4: NemoClaw

### Questions

- NemoClaw는 assistant 제품인가, runtime reference stack인가
- sandbox, blueprint, onboarding은 어떤 책임으로 나뉘는가
- 우리 프로젝트가 나중에 참고할 운영 안정성 포인트는 무엇인가
- MVP에 지금 당장 가져오면 과한 복잡도는 무엇인가

### Outputs

- runtime hardening 관점 요약
- host / sandbox state 분리 요약
- 추후 security roadmap 참고 포인트
- MVP에선 보류할 운영 복잡도 목록

## Phase 5: Synthesis

### Questions

- 우리 프로젝트의 최소 구성 요소는 무엇인가
- 초기 버전에서 UI가 필요한가
- gateway가 필요한가 아니면 직접 runtime만 만들면 되는가
- 단일 agent 기반에서 시작한 뒤 multi-agent로 확장 가능한가

### Outputs

- 프로젝트 초기 아키텍처 초안
- 핵심 컴포넌트 목록
- 구현 우선순위
- 보류할 기능 목록
- 최소 runtime 구조 문서

## Immediate Next Documents

- `analysis/upstreams/claw3d.md` 보강
- `analysis/upstreams/openclaw.md` 보강
- `analysis/upstreams/hermes.md` 보강
- `analysis/upstreams/nemoclaw.md` 보강
- `projects/hermes-like-agent/docs/project-overview.md` 갱신
- `projects/hermes-like-agent/docs/minimal-runtime-architecture.md`

## Current Working Definition

현재 목표는 "Hermes와 유사한 운영 철학을 가진 자체 AI agent"를 만드는 것이다.
하지만 구현 시작 전에는 먼저:

- UI 없는 최소 runtime
- orchestration 책임
- tool execution 경계
- memory와 state 모델

이 네 가지를 확정하는 쪽을 우선한다.

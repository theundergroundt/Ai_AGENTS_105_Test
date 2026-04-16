# OpenClaw Agent Flow Intake

## Purpose

팀원이 정리한 OpenClaw agent flow 원문을 붙여 넣는 파일이다.

- 먼저 원문을 보관한다.
- 그 다음 해석 포인트를 분리한다.
- 최종적으로 DeskMate에 가져올 구조를 판단한다.

## How To Use

- 팀원이 정리한 내용을 `Raw Note` 섹션에 그대로 붙여 넣는다.
- 내가 이후 이 파일을 기준으로 OpenClaw flow를 분석한다.
- 분석 후 핵심 결론은 `analysis/upstreams/openclaw.md`에도 반영한다.

## Raw Note

아직 비어 있음.

## Current Note Status

- 팀원 원문 메모는 아직 붙지 않았다.
- 대신 이번 문서는 `forks/openclaw`의 공식 문서와 핵심 소스를 기준으로 1차 해석을 채운다.

## Questions To Answer From This Note

- OpenClaw의 실제 진입점은 어디인가
- assistant와 agent 역할이 분리돼 있는가
- orchestration이 단순 라우팅인지, 다단계 흐름인지
- tool 실행과 상태 관리는 어디서 일어나는가
- DeskMate에 바로 가져갈 구조는 무엇인가
- DeskMate에서 버려야 할 복잡도는 무엇인가

## Extraction Template

### Observed Flow

- CLI 진입점은 `src/entry.ts` -> `src/cli/run-main.ts` 흐름이다.
- OpenClaw는 루트에서 바로 agent를 실행하기보다, 먼저 CLI routing과 gateway/bootstrap을 통과시킨다.
- 핵심 철학은 `Gateway = control plane`, `assistant = product`다.
- 실질적인 agent loop 진입점은 문서 기준 `Gateway RPC: agent / agent.wait`, `CLI: agent`다.
- agent run은 세션 단위로 serialize되고, session state는 gateway가 소유한다.
- multi-agent는 여러 agent가 자유롭게 협업하는 구조라기보다, `workspace + auth + sessions`가 분리된 복수 assistant profile에 가깝다.
- sub-agent는 존재하지만 기본 철학은 "복잡한 협업"보다 "격리된 background run"에 더 가깝다.
- inbound routing은 channel/account/peer/session 기준으로 deterministic binding을 통해 agent를 고른다.

### Good Patterns To Reuse

- `Gateway owns state`
  - 세션과 상태를 클라이언트가 아니라 중앙 control plane이 가지는 구조
- `Session-first execution`
  - 요청을 세션에 매핑하고, 세션 단위로 실행 serialize
- `Deterministic routing`
  - channel/account/peer 기준으로 어떤 agent가 받을지 명확히 결정
- `Isolated agent profile`
  - agent별 workspace, auth, session store 분리
- `Immediate accept + async progress`
  - 요청 수락 후 진행 상태를 이벤트로 흘리는 방식
- `Sub-agent as optional background worker`
  - 메인 assistant를 막지 않는 백그라운드 실행 모델

### Complexity To Avoid

- 너무 많은 채널 지원
- gateway, nodes, canvas, pairing, remote access까지 한 번에 가져오는 것
- session scope, dm isolation, identity links 같은 범용 메신저 플랫폼 복잡도
- nested sub-agent orchestration을 초반부터 구현하는 것
- plugin/runtime/provider/channel/security 구성을 OpenClaw 수준으로 세분화하는 것
- "멀티 에이전트"를 위해 다단계 session tooling까지 먼저 만드는 것

### DeskMate Implications

- DeskMate도 중앙 orchestrator가 세션/작업 상태를 소유하는 구조가 좋다.
- 하지만 OpenClaw처럼 수십 개 채널을 받는 게 아니라, 웹 + IoT 중심으로 단순화해야 한다.
- agent는 "플랫폼 participant"보다 "기능별 worker"로 재정의하는 편이 맞다.
- 1차 버전은 `assistant -> selected agent -> result/event -> dashboard/iot` 흐름이면 충분하다.
- OpenClaw의 multi-agent는 참고하되, DeskMate는 "개인 비서 UX"가 중심이어야 한다.

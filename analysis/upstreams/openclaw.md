# OpenClaw Analysis

## Status

- source checkout: `../../forks/openclaw`
- remote `origin`: `https://github.com/theundergroundt/openclaw_fork.git`
- current branch: `main`
- current HEAD: `7fd57717a9`

## Bottom Line

- OpenClaw의 본질은 "멀티 채널 개인 비서"와 "gateway control plane"이다.
- DeskMate가 여기서 그대로 가져와야 하는 것은 agent profile 분리보다 `state ownership`, `session-first execution`, `deterministic routing`이다.
- 반대로 채널 플랫폼 복잡도와 광범위한 gateway 기능은 초기 DeskMate에 과하다.

## Core Reading Basis

- `README.md`
- `src/entry.ts`
- `src/cli/run-main.ts`
- `docs/concepts/architecture.md`
- `docs/concepts/agent.md`
- `docs/concepts/session.md`
- `docs/concepts/multi-agent.md`
- `docs/concepts/agent-loop.md`
- `docs/tools/subagents.md`

## Observed Structure

- `entry.ts`에서 CLI 진입을 잡고, `run-main.ts`에서 bootstrap / route / plugin registration / command parsing을 수행한다.
- OpenClaw는 처음부터 "agent run"보다 "gateway + CLI control plane"을 앞세운다.
- Gateway는 장기 실행 프로세스로서 provider 연결, WS API, event push, session state를 소유한다.
- Agent loop는 session을 기준으로 직렬화되고, `agent` / `agent.wait` 같은 API를 통해 비동기적으로 실행된다.
- Multi-agent는 자유로운 협업 군집보다 `agentId`별로 workspace / auth / session store가 분리된 profile 집합에 가깝다.
- Sub-agent는 존재하지만 기본 모델은 "메인 assistant를 보조하는 isolated background worker"다.

## OpenClaw Flow Summary

1. 사용자의 요청 또는 channel inbound가 gateway로 들어온다.
2. binding / session rule로 어떤 agentId, 어떤 sessionKey로 갈지 결정한다.
3. gateway가 session metadata와 session store를 관리한다.
4. agent run은 즉시 accepted 응답을 돌려주고 실제 처리는 비동기 loop에서 수행한다.
5. 실행 중 assistant/tool/lifecycle 이벤트가 stream으로 흘러간다.
6. 최종 결과는 session과 event 흐름에 기록되고, 필요하면 외부 채널로 delivery 된다.

## Assistant vs Agent Interpretation

- README 기준 product message는 "personal AI assistant"다.
- 내부 구현에서는 여러 agent profile, sub-agent, tools가 있지만, 사용자-facing 개념은 assistant 쪽이 더 강하다.
- 이 점은 DeskMate에도 중요하다. 사용자 경험은 "하나의 비서"로 보이고 내부에서만 라우팅이 일어나야 한다.

## What To Reuse For DeskMate

- 중앙 orchestrator가 상태를 소유하는 구조
- session 단위 실행 직렬화
- 요청 accept 후 async progress/event 전파
- agent별 역할 분리 아이디어
- background worker로서의 sub-agent 개념
- control plane과 user-facing interface를 분리하는 사고방식

## What To Avoid For DeskMate

- 다채널 메신저 플랫폼 복잡도
- pairing / remote gateway / node / canvas까지 포함한 확장 표면
- session scope 옵션의 과도한 일반화
- nested sub-agent와 복잡한 session tool 체계의 조기 도입
- plugin/runtime/provider/channel/security를 OpenClaw 수준으로 세분화하는 것

## What To Build Ourselves

- DeskMate 전용 assistant entry
- 기능형 agent abstraction
  - scheduler
  - wellness
  - code review
- 웹 대시보드용 상태 모델
- IoT 이벤트 모델
- 발표/데모에 맞는 단순 orchestration 정책

## DeskMate Implications

- DeskMate는 OpenClaw처럼 "assistant product"라는 메시지를 유지하는 것이 맞다.
- 단, OpenClaw의 강점은 멀티채널/개인 비서 범용성이고, DeskMate의 차별화는 웹 상태판 + IoT + 생활/생산성 결합이다.
- 따라서 DeskMate는 gateway를 더 작게 만들고, channel 대신 `web request / scheduled task / iot event` 중심으로 설계하는 편이 낫다.

## 가져올 것 / 버릴 것 / 직접 만들 것

### 가져올 것

- Gateway가 상태를 소유하는 구조
- Session-first execution
- Deterministic routing
- Accepted -> streaming progress -> final result 흐름
- Agent profile isolation 사고방식

### 버릴 것

- 광범위한 채널 지원
- 복잡한 pairing / remote / node / canvas 생태계
- OpenClaw식 full plugin platform 지향
- 조기 nested sub-agent orchestration

### 직접 만들 것

- DeskMate assistant UX
- 기능형 agent orchestration
- dashboard 상태 이벤트
- IoT notification bridge
- wellness / scheduler 중심 domain model

## Next

- OpenClaw의 `agent` 명령과 실제 runtime 결합 지점을 추가로 본다.
- team note가 들어오면 현재 1차 해석과 비교해서 보정한다.

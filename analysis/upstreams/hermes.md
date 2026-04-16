# Hermes Analysis

## Status

- source checkout: `../../forks/hermes`
- remote `origin`: `https://github.com/theundergroundt/hermes_agent_fork.git`
- current branch: `main`
- current HEAD: `cc6e8941`

## Bottom Line

- Hermes의 본질은 "self-improving agent platform"과 "multi-surface personal assistant"의 결합이다.
- DeskMate가 여기서 바로 가져갈 것은 `gateway + automation + subagent delegation`보다 `단일 assistant UX`, `확장 가능한 agent 구조`, `장기적으로 붙일 memory/skills 철학`이다.
- 반대로 Hermes의 강한 범용성, 학습 루프, 다중 실행 환경, 광범위한 툴셋은 DeskMate MVP에는 과하다.

## Core Reading Basis

- `README.md`
- `cli.py`
- `run_agent.py`
- `gateway/run.py`
- `gateway/platforms/`
- `agent/`
- `tools/`
- `cron/`

## Observed Structure

- Hermes는 CLI와 messaging gateway를 모두 1급 entrypoint로 둔다.
- 코드 구조상 `agent`, `tools`, `gateway`, `cron`, `plugins/memory`, `environments`가 각각 큰 축이다.
- 단순한 task router보다 "오랫동안 켜져 있고, 기억하고, 학습하고, 여러 환경에서 일하는 agent platform" 쪽에 가깝다.
- `gateway/platforms/`가 매우 넓어서 개인 assistant 경험을 여러 채널로 확장하는 데 강하다.
- `plugins/memory/`, `agent/memory_manager.py`, `agent/skill_utils.py` 계열은 학습/기억/skill 진화를 핵심 철학으로 밀고 있다.
- `cron/`과 delegate 관련 툴은 agent를 "요청 응답 시스템"이 아니라 "지속적으로 일하는 운영체"처럼 다룬다.
- `environments/`와 `tools/environments/`는 실행 환경 자체를 추상화해 로컬, Docker, SSH, Modal 같은 백엔드까지 포괄한다.

## Hermes Flow Summary

1. 사용자는 CLI 또는 messaging gateway로 Hermes에 들어온다.
2. gateway/session 계층이 대화 맥락과 플랫폼 흐름을 유지한다.
3. agent loop가 tool 호출, memory 참조, skill 활용, model routing을 수행한다.
4. 필요하면 cron, subagent, 다양한 execution environment로 작업을 넘긴다.
5. 결과는 현재 세션뿐 아니라 장기 기억과 skill 개선 흐름으로 이어질 수 있다.

## Assistant vs Platform Interpretation

- Hermes는 겉으로는 개인 assistant이지만, 내부 철학은 강하게 platform 지향이다.
- OpenClaw가 "assistant product + gateway control plane" 쪽이라면, Hermes는 "assistant product + self-improving agent operating system"에 더 가깝다.
- 이 차이는 DeskMate에 중요하다. 우리는 초기부터 운영체 수준으로 가기보다, 제품 UX와 기능형 agent 분리에 집중해야 한다.

## What To Reuse For DeskMate

- 사용자에게는 하나의 assistant로 보이게 하는 방식
- 기능이 늘어날 때 agent나 toolset을 분리하기 쉬운 구조
- scheduler/automation을 자연어 UX와 연결하는 사고방식
- 장기적으로 memory, skill, delegate를 붙일 수 있는 확장 방향
- gateway와 CLI/관리 인터페이스를 분리하는 사고방식

## What To Avoid For DeskMate

- 초기에 learning loop와 self-improving skill 시스템까지 구현하는 것
- 다수의 메시징 플랫폼을 동시에 지원하는 구조
- 너무 넓은 tool/platform/environment 추상화
- "멀티 에이전트"를 보여주기 위해 과도한 delegate/subagent 계층을 넣는 것
- 발표용 MVP 단계에서 memory platform까지 함께 만드는 것

## What To Build Ourselves

- DeskMate assistant 중심 UX
- 기능형 agent 라우팅
- dashboard와 IoT를 기준으로 한 상태 모델
- 필요 최소한의 task execution / schedule / notification 흐름
- 나중에 memory를 붙일 수 있는 단순한 state/event 저장 구조

## DeskMate Implications

- DeskMate는 Hermes처럼 "오래 살아 있는 비서"라는 철학은 참고할 가치가 있다.
- 하지만 차별화 포인트는 자가학습 agent보다 `책상 위에서 보이고 반응하는 비서 경험`이다.
- 따라서 발표와 MVP 기준으로는 Hermes식 학습 루프보다 `설명 가능한 라우팅`, `도메인 특화 agent`, `웹 + IoT 상태 경험`을 앞세우는 편이 맞다.

## 가져올 것 / 버릴 것 / 직접 만들 것

### 가져올 것

- 단일 assistant UX
- agent/tool 분리 가능한 확장 구조
- scheduler/automation 감각
- 장기적으로 memory를 붙일 수 있는 설계 여지

### 버릴 것

- self-improving loop의 조기 도입
- 광범위한 messaging surface
- 너무 많은 execution backend
- 범용 agent platform 지향

### 직접 만들 것

- DeskMate 도메인 모델
- dashboard 상태판
- IoT 피드백 루프
- work + routine 결합 agent 흐름

## Next

- Hermes에서 실제로 `delegate`, `memory`, `cron`이 어디까지 core인지 추가 확인한다.
- DeskMate에 필요한 것은 "Hermes 전체"가 아니라 "assistant 운영 철학"이라는 점을 비교 문서에 반영한다.

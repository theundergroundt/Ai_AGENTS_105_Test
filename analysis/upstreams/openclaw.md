# OpenClaw Analysis

## 분석 범위

- 분석 대상: `../../forks/openclaw_fork`
- 분석 관점: 시스템 설계 분석 과목 기준
- 중점 항목:
  - 요구사항 분석
  - 시스템 구조 설계
  - 아키텍처 분해와 인터페이스 설계
  - 성능, 확장성, 유지보수성 같은 품질 속성
  - 에이전트 역할 분리

## 읽은 근거 파일

- `forks/openclaw_fork/README.md`
- `forks/openclaw_fork/src/entry.ts`
- `forks/openclaw_fork/src/cli/run-main.ts`
- `forks/openclaw_fork/docs/concepts/architecture.md`
- `forks/openclaw_fork/docs/concepts/agent.md`
- `forks/openclaw_fork/docs/concepts/session.md`
- `forks/openclaw_fork/docs/concepts/agent-loop.md`
- `forks/openclaw_fork/docs/concepts/multi-agent.md`

## 1. 사실

### 1.1 문제 정의

- OpenClaw는 자신을 `personal AI assistant`로 정의한다.
- 하지만 README와 구조 문서를 같이 보면, 제품 핵심은 단순 채팅 앱이 아니라 `local-first gateway + assistant runtime` 조합이다.
- 해결하려는 문제는 다음과 같이 정리된다.
  - 사용자가 이미 쓰는 채널들에서 하나의 assistant를 지속적으로 사용
  - 장기 실행되는 gateway가 세션, 채널, 도구, 이벤트를 통합 관리
  - 하나의 호스트에서 여러 agent profile을 분리 운영
  - session 단위로 안정적이고 일관된 agent 실행 제공

즉, OpenClaw는 `assistant 제품`을 표방하지만 내부 설계 문제는 `gateway control plane 위에서 personal assistant를 안정적으로 운영하는 것`에 가깝다.

### 1.2 요구사항 분석

#### 기능 요구사항

- 다양한 외부 채널과 연결되어야 한다.
- CLI, 앱, 웹, 자동화 클라이언트가 gateway에 접속할 수 있어야 한다.
- agent 실행 요청을 비동기적으로 받아들이고 진행 상황을 스트리밍해야 한다.
- session별 대화 이력과 상태를 관리해야 한다.
- 여러 agent를 한 gateway 안에서 분리 운영할 수 있어야 한다.
- workspace, bootstrap 파일, skills, tools를 agent별로 다르게 구성할 수 있어야 한다.

#### 비기능 요구사항

- 장기 실행 daemon 구조가 필요하다.
- session race를 막기 위한 직렬화가 필요하다.
- channel 확장을 감당할 수 있는 아키텍처 분리가 필요하다.
- single-user assistant처럼 보여야 하지만 내부적으로는 state isolation이 필요하다.
- 원격 연결과 다채널 연결을 다루므로 보안과 pairing 통제가 중요하다.

### 1.3 시스템 구조 분해

OpenClaw는 크게 5개 계층으로 나눠 볼 수 있다.

#### 1. 진입 및 제어 계층

- `src/entry.ts`
- `src/cli/run-main.ts`

이 계층의 책임:

- CLI 진입 처리
- profile/container/runtime 전처리
- 명령 라우팅
- program 초기화

`src/entry.ts`는 얇은 entry wrapper이고, 실제 CLI bootstrap은 `src/cli/run-main.ts`가 담당한다.

#### 2. Gateway control plane 계층

- `docs/concepts/architecture.md` 기준 Gateway

이 계층의 책임:

- 장기 실행 프로세스 유지
- 채널 연결 유지
- WebSocket API 제공
- event push
- health, presence, agent 이벤트 관리

OpenClaw에서 gateway는 주변 기능이 아니라 시스템 중심 control plane이다.

#### 3. 핵심 agent runtime 계층

- `docs/concepts/agent.md`
- `docs/concepts/agent-loop.md`

이 계층의 책임:

- embedded agent runtime 실행
- system prompt 구성
- workspace와 bootstrap 파일 주입
- skills, tools, 모델 설정 결합
- 한 번의 agent loop 수행

중요한 사실:

- OpenClaw는 `single embedded agent runtime`을 사용한다.
- 즉, 기본 구조는 여러 runtime이 자유롭게 협력하는 구조가 아니라, gateway가 하나의 runtime을 적절히 호출하는 구조다.

#### 4. 세션 및 상태 관리 계층

- `docs/concepts/session.md`
- `docs/concepts/multi-agent.md`

이 계층의 책임:

- session key 결정
- DM, room, group, cron, webhook별 세션 분리
- transcript 저장
- agent별 세션 경계 유지

문서상 session state는 gateway가 소유한다.

#### 5. 확장 계층

- plugins
- nodes
- canvas
- channels

이 계층의 책임:

- 새로운 channel 추가
- node 디바이스 연결
- canvas와 web surface 제공
- plugin 기반 기능 확장

이 때문에 OpenClaw는 assistant product이면서 동시에 plugin-capable platform 성격을 가진다.

### 1.4 인터페이스 설계

#### 외부 인터페이스

- CLI
- WebSocket gateway API
- messaging channels
- node 연결 인터페이스

Gateway architecture 문서 기준으로, 클라이언트와 노드는 모두 같은 WS 서버에 연결되지만 역할이 다르다.

#### 내부 인터페이스

- `agent` / `agent.wait`
  - agent 실행과 완료 대기 인터페이스
- session routing
  - inbound 메시지를 어떤 session과 agentId로 보낼지 결정
- embedded runtime 호출
  - 실제 모델 실행과 tool loop는 내부 runtime에서 수행

시스템 설계 과목 관점에서는 `control plane 인터페이스`와 `agent execution 인터페이스`가 분리된 구조라고 볼 수 있다.

### 1.5 핵심 실행 흐름

1. 사용자가 CLI 또는 외부 채널을 통해 요청한다.
2. gateway가 연결된 채널과 클라이언트 요청을 받는다.
3. routing 규칙이 agentId와 sessionKey를 결정한다.
4. `agent` 요청은 즉시 accepted 응답을 반환한다.
5. 내부적으로 embedded runtime이 실행된다.
6. 실행 중 assistant/tool/lifecycle 이벤트가 스트리밍된다.
7. session transcript와 상태가 저장되고, 최종 결과가 전달된다.

이 흐름의 핵심은 `즉시 수락 + 비동기 실행 + session 일관성 유지`다.

### 1.6 에이전트 분리 관점

OpenClaw를 단순히 멀티 에이전트 시스템이라고 부르면 정확도가 떨어진다. 역할 단위로 분리해서 보는 게 맞다.

| 역할 | 주요 근거 | 책임 | 해석 |
| --- | --- | --- | --- |
| 진입 제어기 | `src/entry.ts`, `src/cli/run-main.ts` | CLI 시작, 환경 준비, 명령 라우팅 | bootstrap/controller |
| Gateway coordinator | `docs/concepts/architecture.md` | 채널, 이벤트, 세션, WS API 통합 | 시스템의 중앙 coordinator |
| 핵심 실행 에이전트 | `docs/concepts/agent.md`, `docs/concepts/agent-loop.md` | 실제 대화, tool, inference 수행 | single embedded runtime |
| agent profile | `docs/concepts/multi-agent.md` | workspace, auth, sessions 분리 | 여러 runtime 동시 협업보다 격리된 persona 단위 |
| 하위 작업 에이전트 | `docs/tools/subagents.md`를 추가 확인해야 함 | 보조 background worker | 선택적 subagent |
| 상태 관리 서브시스템 | `docs/concepts/session.md` | session ownership, transcript 저장 | gateway-owned state layer |

핵심 정리:

- OpenClaw의 기본 단위는 `세션 위에서 실행되는 단일 embedded runtime`이다.
- multi-agent는 "여러 agent가 동시에 토론하는 구조"가 아니라 `agent profile isolation + routing`에 더 가깝다.
- 따라서 발표에서는 OpenClaw를 `gateway 중심 assistant 시스템`으로 설명하는 것이 적절하다.

### 1.7 session-first 설계

OpenClaw의 중요한 설계 선택은 session을 first-class 객체로 둔 것이다.

- Direct message, group, room, cron, webhook이 각기 다른 session 정책을 가진다.
- DM은 기본적으로 shared session이지만, `dmScope`를 통해 분리 수준을 높일 수 있다.
- session state는 gateway가 소유한다.
- transcript는 agent별 경로 아래 JSONL로 저장된다.

이 구조는 채널이 많아져도 처리 일관성을 유지하게 해 준다.

### 1.8 품질 속성 관점

#### 성능

- `agent` 요청을 즉시 accepted로 반환해 사용자 체감 지연을 줄인다.
- 진행 상황은 스트리밍 이벤트로 전달한다.
- session별 serialized run을 통해 충돌을 줄이는 대신, 한 세션 내 병렬성은 제한한다.

#### 확장성

- gateway + WS API 구조라 다양한 클라이언트와 node를 붙이기 쉽다.
- multi-agent routing으로 여러 persona를 같은 gateway 위에 올릴 수 있다.
- plugin과 channel 확장 경계가 분리되어 있다.

#### 유지보수성

- 개념 문서 기준 경계가 비교적 명확하다.
  - gateway
  - session
  - agent runtime
  - plugin
  - channel
- 다만 표면적 기능이 매우 넓어서 전체 복잡도는 높다.
- 즉, 모듈 경계는 좋지만 시스템 전체 학습 비용이 크다.

#### 안정성

- per-session serialization으로 상태 오염 가능성을 줄인다.
- gateway가 상태를 단일 소유해 일관성을 확보한다.
- pairing, auth, sandbox, dm isolation 같은 안전장치가 구조 차원에서 강조된다.

## 2. 해석

### 2.1 시스템 설계 관점 해석

- OpenClaw의 핵심 선택은 `assistant를 gateway control plane 위에 올린 것`이다.
- 그래서 UI나 채널은 많지만, 실제 중심은 gateway와 session ownership이다.
- 사용자는 assistant를 보지만, 설계자는 `control plane + embedded runtime + routing`을 보게 된다.

### 2.2 Hermes와의 구조 차이

- Hermes는 `중심 agent`가 강하고 주변 기능이 붙는 구조에 가깝다.
- OpenClaw는 `gateway와 session control plane`이 먼저 있고, 그 위에 agent runtime이 올라가는 구조에 가깝다.
- 따라서 같은 personal assistant라도 설계 중심축이 다르다.

### 2.3 장점

- session ownership이 명확하다.
- 채널과 클라이언트를 한 control plane으로 통합할 수 있다.
- multi-agent를 격리된 profile 방식으로 운영할 수 있다.
- 이벤트 스트리밍과 비동기 실행이 잘 드러난다.

### 2.4 한계

- 시스템 표면적이 매우 넓다.
- 채널, node, canvas, plugin까지 포함되면 발표 주제가 쉽게 분산된다.
- MVP 관점에서는 지나치게 큰 구조일 수 있다.

## 3. 우리 프로젝트 시사점

### 3.1 가져올 점

- gateway가 상태를 소유하는 방식
- session-first execution
- accepted -> streaming -> final result 흐름
- routing을 통해 기능이나 persona를 분리하는 방식
- control plane과 assistant 실행을 구분하는 사고방식

### 3.2 그대로 가져오면 과한 점

- 지나치게 넓은 multi-channel 지원
- node, canvas, remote access까지 포함한 전체 control plane
- plugin ecosystem 전체를 초기부터 가져가는 것
- 복잡한 multi-agent/profile 구성을 조기에 도입하는 것

### 3.3 발표에서 강조할 문장

- OpenClaw는 personal assistant를 표방하지만, 구조적으로는 gateway control plane이 중심인 시스템이다.
- 기본 실행 단위는 `single embedded agent runtime`이며, multi-agent는 협업 군집보다 `isolated profile routing`에 가깝다.
- 따라서 우리 프로젝트는 OpenClaw에서 `state ownership`과 `session-first orchestration`은 가져오고, 채널 확장성과 플랫폼 표면은 줄이는 것이 적절하다.

## 4. 다음 확인 항목

- `docs/tools/subagents.md`를 읽고 OpenClaw의 subagent가 기본 모델인지 부가 기능인지 확인
- 실제 gateway server 코드와 session manager 코드를 읽어 session ownership 근거를 더 구체화
- OpenClaw와 Hermes 비교 문서에서 `중심 축` 차이를 명시
  - Hermes: agent 중심
  - OpenClaw: gateway/session 중심

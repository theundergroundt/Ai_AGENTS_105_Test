# Spring Agent Runtime Development Plan

## 문서 목적

- `Hermes` 분석 결과를 바탕으로 우리 프로젝트의 자체 개발 방향을 정리한다.
- 이 문서는 구현 계획서다.
- 이후 작성할 `요구사항 명세서`와 `API 명세서`의 기준 문서로 사용한다.

## 전제

- 우리는 `Hermes`를 그대로 복제하지 않는다.
- `Hermes`는 분석 대상이고, 우리는 자체 구조를 `Spring` 중심으로 구현한다.
- 초기 목표는 `Hermes 전체 기능 재현`이 아니라 `관찰 가능한 agent runtime`을 만드는 것이다.

## Hermes에서 사실로 가져온 점

- Hermes의 중심은 `단일 핵심 agent loop`다.
- tool 사용은 `모델 판단 -> tool call -> handler 실행 -> tool result 반영 -> 모델 재호출` 구조다.
- subagent는 항상 떠 있는 구조가 아니라, 부모 agent가 필요할 때 `delegate_task`로 만드는 임시 child agent다.
- Hermes는 `assistant platform` 성격이 강하고, runtime 책임이 넓다.
- Hermes의 subagent 내부 작업은 부모에게 `summary` 중심으로만 돌아오므로, 세부 진행 과정이 사용자에게 충분히 보이지 않는다.

## Hermes 기준 runtime 경계

`runtime`은 추상적인 개념이 아니라, Hermes에서 실제 agent를 실행하는 코드 묶음이다.

Hermes를 가장 이해하기 쉬운 방식으로 나누면 아래 3층이다.

```text
[UI / 입력층]
CLI, Telegram, Slack 같은 사용자 접점
        |
        v
[Gateway / Adapter 층]
메시지를 받아 세션을 준비하고 runtime 호출
        |
        v
[Runtime 층]
agent를 실제로 실행하고 상태를 관리
```

### 1. UI / 입력층

주요 위치:

- `cli.py`
- `gateway/platforms/*`

역할:

- 사용자 입력 수집
- 사용자에게 응답 출력

### 2. Gateway / Adapter 층

주요 위치:

- `gateway/run.py`
- `gateway/session.py`

역할:

- 메시지 수신
- 세션 생성 또는 조회
- transcript 로드
- `AIAgent` 생성
- runtime 실행 요청 연결

즉 Hermes의 gateway는 runtime 자체라기보다 `runtime으로 들어가는 중간 제어 계층`이다.

### 3. Runtime 층

주요 위치:

- `run_agent.py`
- `model_tools.py`
- `tools/registry.py`
- `tools/*.py`
- `hermes_state.py`
- `agent/memory_manager.py`
- `tools/delegate_tool.py`

역할:

- prompt 조립
- memory 주입
- 허용 tool 목록 구성
- 모델 호출 loop 수행
- tool 실행
- 결과 반영
- 상태 저장
- 필요 시 subagent 생성

즉 Hermes 기준으로 `runtime`은 `사용자 요청을 받아 agent를 실제로 실행하고, tool과 상태와 결과를 관리하는 실행 본체`다.

## Hermes 3층 구조를 우리 Spring 구조로 옮기면

| 구분 | Hermes 기준 | 우리 프로젝트 Spring 기준 | 설명 |
| --- | --- | --- | --- |
| UI / 입력층 | `cli.py`, `gateway/platforms/*` | React UI 또는 웹 프론트엔드 | 사용자 입력과 시각화 담당 |
| Gateway / Adapter 층 | `gateway/run.py`, `gateway/session.py` | Spring Controller, Session API, Run API | 요청 수신, 세션 준비, runtime 호출 연결 |
| Runtime 중심 loop | `run_agent.py` | `AgentOrchestrator` | prompt 조립, 모델 호출 loop, 종료 판단 |
| Tool orchestration | `model_tools.py`, `tools/registry.py` | `ToolRegistry`, `ToolExecutionService` | 허용 tool 목록 구성, handler dispatch |
| Tool handler | `tools/*.py` | 개별 Tool Handler Bean | 파일 읽기, 검색, 외부 호출 등 실제 실행 |
| State / Memory | `hermes_state.py`, `agent/memory_manager.py` | `RunStore`, `SessionStore`, `MemoryService` | 상태 저장, 세션 기록, 기억 관리 |
| Delegation | `tools/delegate_tool.py` | 추후 `ChildTaskExecutor` 또는 `SubagentService` | child task 실행, 후순위 기능 |
| Runtime event emission | Hermes에는 약하게 드러남 | `RuntimeEventPublisher` | 내부 상태를 event로 외부에 발행 |
| Event to UI state | Hermes 외부에서 약함 | `RuntimeStateProjector` | event를 현재 UI 상태로 환원 |

이 매핑표의 핵심은 다음이다.

- `Spring Controller`는 runtime이 아니다
- `AgentOrchestrator`가 runtime의 중심이다
- UI는 상태를 소유하지 않고, runtime이 발행한 event와 state snapshot을 보여준다

## 쉽게 이해하는 runtime 정리

어렵게 보지 말고 `runtime = 실제로 agent를 돌리는 엔진룸`이라고 보면 된다.

비유:

- UI = 손님이 주문하는 테이블
- Gateway = 주문을 받아 주방에 전달하는 직원
- Runtime = 실제로 요리하는 주방

Hermes로 보면:

`사용자`
-> `CLI 또는 gateway`
-> `run_agent.py`
-> `모델 호출`
-> `tool 실행`
-> `결과 저장`
-> `응답 반환`

여기서 `run_agent.py`부터 뒤쪽이 runtime이다.

우리 Spring 프로젝트로 바꾸면:

- UI = React 화면
- Gateway = Spring Controller
- Runtime = `AgentOrchestrator`, `ToolExecutionService`, `RunStore`, `RuntimeEventPublisher`

즉:

- Controller는 주문을 받는 곳이다
- `AgentOrchestrator`는 실제 작업을 진행하는 중심 엔진이다
- UI는 runtime이 만든 상태를 받아서 보여주는 쪽이다

## 우리 프로젝트의 핵심 차별점

우리 프로젝트는 `agent가 무엇을 하고 있는지 사용자에게 실시간으로 보여주는 것`을 핵심 요구사항으로 둔다.

즉 단순히 답변을 잘 만드는 agent가 아니라, 아래가 보여야 한다.

- 지금 계획 수립 중인지
- 자연어 분석 중인지
- 코드베이스 탐색 중인지
- 어떤 tool을 실행 중인지
- 어떤 파일을 읽는지
- 결과를 통합 중인지
- 사용자 승인을 기다리는지
- 하위 작업이 있으면 어떤 child task가 돌고 있는지

이 요구사항 때문에 우리 구조는 `숨겨진 내부 loop`보다 `이벤트 기반 가시성`이 우선되어야 한다.

## Claw3D 분석에서 추가로 가져와야 할 점

Claw3D 계열 분석에서 중요한 교훈은 `추적은 감시가 아니라 계약`이라는 점이다.

즉 UI가 agent 내부를 직접 해석하거나 몰래 감시하는 것이 아니라,

1. runtime이 실행과 상태를 소유하고
2. runtime이 상태와 이벤트를 외부로 내보내고
3. UI 계층이 그 이벤트를 자기 상태 모델로 환원해서 보여준다

는 구조가 핵심이다.

우리 프로젝트는 Claw3D를 직접 쓰지 않더라도, 아래 원칙은 그대로 가져와야 한다.

- 실행 상태의 진실 원천은 runtime이다
- UI는 runtime 내부를 추측하지 않는다
- 이벤트 스트림만으로 부족하면 상태 질의 API도 함께 제공한다
- 외부 agent를 붙일 가능성이 있다면 adapter가 protocol 번역을 담당한다

이 원칙은 현재 계획서의 `실시간 시각화` 요구를 더 구현 가능한 형태로 바꿔준다.

## 문제 정의

기존 agent 프로젝트 다수는 최종 답변은 제공하지만, 다음이 부족한 경우가 많다.

- 중간 단계 추적성 부족
- 사용자 입장에서 현재 작업 상태 확인 어려움
- 장시간 작업의 진행률과 실패 지점 파악 어려움
- 하위 작업 분리 시 내부 흐름이 가려짐

우리 프로젝트는 이를 해결하기 위해 다음 문제를 직접 다룬다.

- agent 작업 과정을 실시간으로 추적 가능한 형태로 모델링할 것
- 사용자가 웹 화면에서 현재 작업 상태를 이해할 수 있을 것
- 이후 요구사항 명세서와 API 명세서로 이어질 만큼 구조가 명확할 것
- Spring 기반으로 실제 구현 가능한 수준에서 설계할 것

## 제품 방향

초기 제품은 `웹 기반 agent 작업 대시보드 + 대화형 실행기`로 정의한다.

사용자 경험은 다음을 목표로 한다.

1. 사용자가 자연어로 작업 요청을 보낸다.
2. 시스템이 해당 요청을 세션과 run 단위로 기록한다.
3. agent가 수행하는 단계가 실시간 이벤트로 화면에 표시된다.
4. 사용자는 진행 상태, 현재 단계, 사용 tool, 중간 결과, 승인 필요 여부를 본다.
5. 작업 완료 후 최종 답변과 실행 이력을 함께 확인한다.

## 설계 원칙

### 1. 단일 중심 agent부터 시작

- 초기에는 `단일 orchestrator agent`로 시작한다.
- `subagent`는 1차 릴리스 필수 기능으로 두지 않는다.
- 대신 subagent가 들어와도 수용 가능한 `task tree` 구조로 설계한다.

이유:

- Hermes도 실제 중심은 `AIAgent` 하나다.
- 실시간 시각화 요구가 강하므로, 먼저 단일 loop를 투명하게 보여주는 것이 우선이다.
- 처음부터 멀티에이전트로 가면 복잡도만 커지고 추적 모델도 불안정해진다.

### 2. 모든 실행을 이벤트로 남긴다

- agent 내부 주요 단계는 모두 `runtime event`로 기록한다.
- UI는 최종 답변이 아니라 `event stream`을 기준으로 상태를 렌더링한다.

추가 원칙:

- UI는 event를 그대로 렌더링하지 않는다.
- `event -> local runtime state` 변환 계층을 반드시 둔다.
- 이벤트 누락이나 지연이 있더라도 상태 질의 API로 보정 가능해야 한다.

### 3. Tool보다 상태 모델을 먼저 설계한다

- 어떤 tool을 붙일지보다, agent 상태를 어떤 단위로 보여줄지가 우선이다.
- 상태 모델이 먼저 잡혀야 API와 UI가 안정된다.

### 4. Prompt보다 orchestration을 먼저 고정한다

- 프롬프트는 바뀔 수 있다.
- 하지만 `run`, `task`, `step`, `event`, `approval` 구조는 먼저 고정해야 한다.

## 제안 아키텍처

```text
웹 프론트엔드
-> Spring API
-> Agent Orchestrator
-> LLM Gateway
-> Tool Execution Layer
-> Event Publisher
-> Runtime State Projector
-> Session / Run / Event Store
```

### 1. Web Frontend

책임:

- 사용자 입력
- 세션 목록 표시
- 현재 run 상태 표시
- step timeline 표시
- tool 실행 이력 표시
- approval 요청 표시

실시간 연결:

- 우선 `SSE`
- 필요 시 이후 `WebSocket` 확장

초기에는 서버 단방향 이벤트 전송이 중심이므로 `SSE`가 구현 난이도와 운영 복잡도 측면에서 더 적절하다.

### 2. Spring API Layer

책임:

- 세션 생성/조회
- run 시작
- 현재 상태 조회
- event stream 제공
- approval 입력 처리
- 최종 결과 조회
- 필요 시 run 상태 재동기화 제공

추천 구성:

- `Spring Boot`
- `Spring Web`
- `Spring WebFlux` 또는 MVC 기반 `SseEmitter`
- `Spring Data JPA`

### 3. Agent Orchestrator

책임:

- system prompt 조립
- 현재 문맥 구성
- 허용 tool 목록 구성
- 모델 호출 loop 제어
- tool 결과 반영
- 종료 조건 판단
- 각 단계를 event로 발행

이 계층은 Hermes의 `run_agent.py`에 해당하는 역할을 한다.
하지만 우리는 여기에 `관찰 가능성`을 더 강하게 넣는다.

### 4. LLM Gateway

책임:

- 모델 호출 추상화
- provider별 요청/응답 변환
- tool schema 전달
- 응답 파싱

초기에는 provider를 하나로 제한하는 편이 낫다.
다중 provider는 나중에 adapter로 확장한다.

### 5. Tool Execution Layer

책임:

- tool registry 관리
- tool schema 제공
- handler 실행
- 실행 결과와 실패를 event로 발행

초기 tool 후보:

- `read_file`
- `search_files`
- `list_files`
- `http_fetch` 또는 `web_search`
- `ask_user_clarification`

`terminal` 같은 위험 tool은 후순위로 둔다.

### 6. Event Publisher

책임:

- runtime 내부 상태 변화를 표준 event로 변환
- UI 스트림과 저장소에 동시에 전달

이 계층이 있어야 `agent 내부 작업 시각화`가 가능하다.

### 7. Runtime State Projector

책임:

- event를 받아 현재 run/task/step 상태로 환원
- UI 조회용 read model 유지
- event 누락 또는 지연 시 상태 질의 결과로 보정

이 계층이 필요한 이유:

- 실시간 UI는 raw event만으로 안정적으로 그리기 어렵다
- Claw3D도 `event -> agent state -> UI` 구조를 둔다
- 따라서 우리도 `event stream`과 별도로 `현재 상태 projection`을 유지하는 편이 안전하다

### 8. Session / Run / Event Store

책임:

- 사용자 세션 저장
- 개별 실행(run) 저장
- step/task/event 이력 저장
- 재연 가능한 실행 로그 저장

추천 저장 구조:

- `PostgreSQL`
- 필요 시 `Redis`는 stream fan-out 용도로만 추가

초기에는 DB만으로도 충분히 시작 가능하다.

## 핵심 도메인 모델

이 부분은 이후 요구사항 명세서와 API 명세서의 기반이 된다.

### Session

- 하나의 사용자 대화 단위
- 여러 run을 가진다

### Run

- 사용자 요청 1회에 대한 실행 단위
- 상태:
  - `QUEUED`
  - `RUNNING`
  - `WAITING_APPROVAL`
  - `SUCCEEDED`
  - `FAILED`
  - `CANCELLED`

### Task

- run 내부의 작업 단위
- 초기는 `root task` 하나만 둔다
- 이후 subagent 도입 시 child task 확장

### Step

- task 내부의 세부 단계
- 예:
  - `UNDERSTANDING_REQUEST`
  - `PLANNING`
  - `CALLING_MODEL`
  - `SELECTING_TOOL`
  - `RUNNING_TOOL`
  - `PROCESSING_TOOL_RESULT`
  - `SUMMARIZING`
  - `WAITING_USER_INPUT`

### Runtime Event

- UI와 저장소가 같이 소비하는 표준 이벤트
- 예:
  - `run.created`
  - `step.started`
  - `step.completed`
  - `tool.called`
  - `tool.succeeded`
  - `tool.failed`
  - `message.delta`
  - `approval.requested`
  - `approval.resolved`
  - `task.spawned`
  - `task.completed`
  - `run.completed`
  - `run.failed`

### Runtime State Snapshot

- 현재 UI가 바로 조회할 수 있는 상태 요약 모델
- 예:
  - `runId`
  - `sessionId`
  - `status`
  - `currentStep`
  - `currentTool`
  - `latestPreview`
  - `waitingApproval`
  - `startedAt`
  - `lastActivityAt`

이 모델은 이후 API 명세에서 `run 상태 조회 응답`의 기준이 된다.

## 실시간 시각화 모델

이 프로젝트의 핵심은 여기다.

Hermes는 내부 loop와 child 작업이 외부에 충분히 보이지 않는다.
우리는 그 반대로 설계한다.

### UI에서 반드시 보여야 하는 정보

- 현재 run 상태
- 현재 실행 중 step
- 직전 완료 step
- 현재 사용 중 tool
- 최근 tool 결과 요약
- 누적 이벤트 타임라인
- 승인 대기 여부
- child task 존재 여부

### 실시간 전송 방식

초기 선택:

- `SSE /runs/{runId}/events`

이유:

- 서버에서 클라이언트로 흐르는 단방향 업데이트가 중심이다.
- 구현이 단순하다.
- 대시보드형 UI에 적합하다.

후속 확장:

- WebSocket
- 다중 클라이언트 구독
- 협업 모드

### 상태 질의 API가 왜 필요한가

이벤트 스트림만 있으면 화면은 빨라 보이지만, 다음 문제가 생긴다.

- 중간에 연결이 끊어질 수 있음
- 초기 진입 사용자는 과거 이벤트를 다 모를 수 있음
- 일부 이벤트 유실 시 현재 상태가 틀어질 수 있음

따라서 우리 시스템은 `event stream + 상태 조회 API`를 같이 제공해야 한다.

초기 최소 구조:

- `GET /runs/{runId}`
- `GET /runs/{runId}/events`

즉 `실시간 스트림`과 `현재 상태 조회`를 분리해서 설계하는 게 맞다.

### 이벤트 발행 단위

모델 호출 전후, tool 실행 전후, step 전환 시점에 이벤트를 발행한다.

최소 발행 지점:

1. run 생성
2. 사용자 입력 수신
3. planning 시작/종료
4. 모델 호출 시작/종료
5. tool 선택
6. tool 실행 시작/종료
7. approval 요청
8. 최종 응답 생성
9. run 종료

## Subagent 전략

### 현재 판단

- subagent는 `즉시 구현 필수`가 아니다.
- 하지만 나중에 넣을 가능성이 높으므로 데이터 구조는 미리 대비한다.

### 이유

- Hermes에서도 subagent는 기본 실행 방식이 아니라 선택적 위임이다.
- 현재 우리 요구의 핵심은 `가시성`이다.
- 처음부터 subagent까지 넣으면 다음 문제가 생긴다.
  - 상태 모델 복잡도 증가
  - 부모/child 이벤트 연계 복잡도 증가
  - UI 표현 난이도 증가

### 초기 방침

- `root task only`
- step 기반 실행 가시화 먼저 구현
- child task는 스키마만 허용

### 확장 방침

subagent를 넣을 때는 숨기지 않고 아래를 모두 노출한다.

- 어떤 task가 child를 생성했는지
- child task 목적이 무엇인지
- child 진행 상태
- child가 실행한 step 요약
- child 완료 후 parent에 어떤 summary가 전달됐는지

즉 우리 시스템에서 subagent는 `숨겨진 내부 실행`이 아니라 `추적 가능한 task node`여야 한다.

## 외부 agent 연동 가능성에 대한 방침

현재 제품은 `Spring 기반 자체 runtime`을 우선 구현한다.
하지만 나중에 외부 agent나 다른 실행기를 붙일 수 있으므로, 내부 구조는 adapter 확장이 가능해야 한다.

### 1. 현재 기본 방식

- 우리가 runtime을 직접 소유한다
- run 상태도 우리가 직접 기록한다
- 이벤트도 우리가 직접 발행한다

즉 초기 버전은 `wrapper`보다 `자체 runtime` 방식이다.

### 2. 나중에 열어둘 확장 방식

- 외부 agent별 adapter 추가
- adapter가 외부 상태를 우리 공통 event로 변환
- 공통 event를 projector가 우리 state로 환원

즉 지금 당장 외부 runtime adapter를 구현하지는 않지만,
도메인 모델은 adapter를 수용 가능한 형태로 두는 것이 좋다.

## 추적 계약 초안

Claw3D 분석을 반영하면, 우리 프로젝트의 최소 추적 계약은 다음처럼 잡는 것이 적절하다.

### 명령 계층

- run 생성
- run 취소
- approval 응답

### 상태 조회 계층

- run 현재 상태 조회
- run step 목록 조회
- run event 목록 조회

### 실시간 이벤트 계층

- `run.created`
- `run.started`
- `step.started`
- `step.completed`
- `tool.called`
- `tool.succeeded`
- `tool.failed`
- `approval.requested`
- `approval.resolved`
- `message.delta`
- `run.completed`
- `run.failed`

이 계약을 먼저 고정하면, 이후 요구사항과 API를 더 일관되게 정의할 수 있다.

## 기능 범위 제안

### MVP

- 웹 UI에서 자연어 요청 입력
- 세션 생성/조회
- run 생성 및 상태 추적
- run 현재 상태 조회 API
- run event stream API
- 단일 agent loop 실행
- 안전한 기본 tool 3~5개 지원
- SSE 기반 실시간 event stream
- step timeline 표시
- 최종 응답과 실행 로그 저장

### Phase 2

- approval flow
- 장기 memory
- run 재실행
- 실패 지점 재시도
- 관리자용 run inspection 화면

### Phase 3

- subagent / child task
- 병렬 task
- 위험 tool sandboxing
- provider 다중화

## 기술 스택 제안

### Backend

- Java 21
- Spring Boot
- Spring Web
- Spring Data JPA
- SSE 지원 계층
- 비동기 실행용 `@Async` 또는 별도 executor

### Storage

- PostgreSQL
- Redis optional

### Frontend

- React 또는 Spring 서버와 분리된 SPA
- 실시간 event timeline UI

### LLM 연동

- 초기에는 단일 provider
- SDK 직접 사용 또는 추상화 계층을 얇게 유지

## 구현 가능성 기준 판단

### 바로 구현 가능한 부분

- 세션/런 저장
- 단일 agent orchestration
- tool registry
- step/event 저장
- 상태 projection
- SSE 실시간 전송
- 웹 대시보드 시각화

### 기술적으로 가능하지만 후순위인 부분

- 장기 memory
- 안전한 shell/terminal 실행
- subagent
- 병렬 task orchestration
- 복수 provider 전략

### 지금 넣으면 과한 부분

- Hermes 수준의 광범위한 self-improving skill system
- 다중 메시징 플랫폼
- 복잡한 cron 자동화
- 다중 실행 환경 추상화

## 초기 구현 시나리오

### 시나리오 1. 코드 분석 요청

사용자:

- "이 프로젝트의 인증 구조를 분석해줘"

시스템:

1. run 생성
2. `UNDERSTANDING_REQUEST`
3. `PLANNING`
4. `RUNNING_TOOL: search_files`
5. `RUNNING_TOOL: read_file`
6. `PROCESSING_TOOL_RESULT`
7. `SUMMARIZING`
8. 최종 결과 반환

사용자 화면:

- 현재 step
- 읽은 파일 수
- 최근 tool 결과 요약
- 최종 분석 결과

### 시나리오 2. 자연어 정리 요청

사용자:

- "이 회의록을 요약하고 action item 뽑아줘"

시스템:

1. run 생성
2. 요청 이해
3. 모델 호출
4. 요약 생성
5. action item 분리
6. 결과 저장

이 경우 tool이 거의 없더라도 step timeline은 그대로 보여줘야 한다.

## 향후 명세 문서로 이어지는 기준

이 계획서 다음에는 아래 문서로 분리하는 것이 맞다.

### 1. 요구사항 명세서

정리 대상:

- 사용자 요구사항
- 기능 요구사항
- 비기능 요구사항
- 상태 전이 규칙
- 승인 흐름
- 오류 처리 기준

### 2. API 명세서

정리 대상:

- 세션 API
- run 생성 API
- run 상태 조회 API
- SSE event stream API
- approval 응답 API
- run 결과 조회 API
- step/event 조회 API

## 현재 결론

- 우리는 Hermes를 참고하되 복제하지 않는다.
- Claw3D 분석을 반영하면, 추적의 핵심은 감시가 아니라 `runtime contract`다.
- 초기 구조는 `Spring 기반 단일 agent orchestrator + tool layer + event stream + state query API + run store`가 적절하다.
- 가장 중요한 차별점은 `agent 내부 작업을 실시간으로 사용자에게 보이게 하는 것`이다.
- 따라서 우리 프로젝트의 첫 설계 중심은 `프롬프트`가 아니라 `run/task/step/event/state snapshot` 모델이어야 한다.

# Hermes Analysis

## 목차

- [분석 범위](#분석-범위)
- [읽은 근거 파일](#읽은-근거-파일)
- [1. 사실](#1-사실)
  - [1.1 문제 정의](#11-문제-정의)
  - [1.2 요구사항 분석](#12-요구사항-분석)
  - [1.3 시스템 구조 분해](#13-시스템-구조-분해)
  - [1.4 인터페이스 설계](#14-인터페이스-설계)
  - [1.5 핵심 실행 흐름](#15-핵심-실행-흐름)
  - [1.6 에이전트 분리 관점](#16-에이전트-분리-관점)
  - [1.7 품질 속성 관점](#17-품질-속성-관점)
- [2. 해석](#2-해석)
  - [2.1 시스템 설계 관점 해석](#21-시스템-설계-관점-해석)
  - [2.2 에이전트 분리 관점 해석](#22-에이전트-분리-관점-해석)
  - [2.3 장점](#23-장점)
  - [2.4 한계](#24-한계)
- [3. 우리 프로젝트 시사점](#3-우리-프로젝트-시사점)
- [4. 다음 확인 항목](#4-다음-확인-항목)

## 분석 범위

- 분석 대상: `../../forks/hermes_agent_fork`
- 분석 관점: 시스템 설계 분석 과목 기준
- 중점 항목:
  - 요구사항 분석
  - 시스템 구조 설계
  - 아키텍처 분해와 인터페이스 설계
  - 성능, 확장성, 유지보수성 같은 품질 속성
  - 에이전트 역할 분리

## 읽은 근거 파일

- `forks/hermes_agent_fork/README.md`
- `forks/hermes_agent_fork/run_agent.py`
- `forks/hermes_agent_fork/model_tools.py`
- `forks/hermes_agent_fork/cli.py`
- `forks/hermes_agent_fork/gateway/run.py`
- `forks/hermes_agent_fork/hermes_state.py`
- `forks/hermes_agent_fork/cron/scheduler.py`
- `forks/hermes_agent_fork/tools/delegate_tool.py`

## 1. 사실

### 1.1 문제 정의

- Hermes는 단순 챗봇보다 `항상 켜져 있는 personal assistant`에 가깝다.
- `README.md` 기준으로 핵심 목표는 다음 다섯 축으로 보인다.
  - 여러 채널에서 같은 assistant를 지속적으로 사용
  - tool calling 기반 작업 자동화
  - memory와 skill을 통한 장기적 사용자 적응
  - cron 기반 예약 자동화
  - subagent delegation과 여러 실행 환경 지원
- 따라서 Hermes가 해결하려는 문제는 `한 번 답하고 끝나는 모델 인터페이스`가 아니라 `장기적 상태와 실행 능력을 가진 assistant 운영`이다.

### 1.2 요구사항 분석

#### 기능 요구사항

- CLI와 messaging gateway를 모두 지원해야 한다.
- 모델 호출 중 tool calling loop를 계속 수행할 수 있어야 한다.
- 세션 상태와 대화 이력을 지속적으로 저장해야 한다.
- 검색 가능한 메모리와 세션 검색을 제공해야 한다.
- 예약 작업과 백그라운드 자동화를 지원해야 한다.
- 필요 시 하위 에이전트에 작업을 위임할 수 있어야 한다.

#### 비기능 요구사항

- 긴 세션에서도 동작해야 하므로 context 길이 관리가 필요하다.
- 여러 플랫폼과 세션이 동시에 돌아가므로 상태 저장의 동시성 처리가 필요하다.
- assistant가 오래 살아 있는 구조이므로 비용 제어와 캐시 전략이 중요하다.
- 다양한 실행 환경을 지원하므로 확장 가능성과 설정 유연성이 중요하다.
- 위험한 tool 실행이 가능한 구조라서 안정성과 운영 통제가 중요하다.

### 1.3 시스템 구조 분해

Hermes는 크게 5개 계층으로 분해된다.

#### 1. 사용자 접점 계층

- `cli.py`
- `gateway/run.py`
- `ui-tui/`, `tui_gateway/`는 별도 TUI 경로로 존재한다.

이 계층의 책임:

- 사용자 입력 수집
- 세션 시작과 재개
- 플랫폼별 UX 제공
- agent 실행 요청 전달

#### 2. 핵심 에이전트 계층

- `run_agent.py`

이 계층의 책임:

- system prompt 구성
- 메모리 주입
- tool schema 제공
- 모델 호출 반복
- tool 결과를 다시 대화 흐름에 반영
- iteration budget 관리
- 응답 종료 조건 판단

Hermes의 실질적인 핵심 제어기는 `AIAgent`다.

#### 3. 도구 오케스트레이션 계층

- `model_tools.py`
- `tools/registry.py`
- `tools/*.py`

이 계층의 책임:

- tool discovery
- toolset 단위 필터링
- tool schema 제공
- sync/async bridge 처리
- tool dispatch

`model_tools.py`는 tool registry 위의 얇은 orchestration layer로 설계되어 있다.

#### 4. 상태 및 기억 계층

- `hermes_state.py`
- `agent/memory_manager.py`

이 계층의 책임:

- 세션 저장
- 메시지 검색
- 장기 기억과 컨텍스트 구성
- 검색 가능한 session history 제공

`hermes_state.py`는 SQLite + FTS5 + WAL 모드 기반으로 세션 저장소를 구현한다.

#### 5. 확장 및 자동화 계층

- `gateway/run.py`
- `cron/scheduler.py`
- `tools/delegate_tool.py`
- `tools/environments/`

이 계층의 책임:

- 메시징 플랫폼 통합
- 예약 작업 실행
- subagent 위임
- 로컬, Docker, SSH 등 실행 환경 추상화

즉, Hermes는 `단일 agent 앱`이 아니라 `assistant platform` 쪽에 더 가깝다.

### 1.4 인터페이스 설계

#### 외부 인터페이스

- CLI 인터페이스: `cli.py`
- Messaging gateway 인터페이스: `gateway/run.py`
- TUI 인터페이스: `ui-tui/` + `tui_gateway/`

이 구조는 사용자 접점을 분리하면서도 내부의 핵심 agent는 공통으로 재사용하는 형태다.

#### 내부 인터페이스

- `AIAgent.run_conversation(...)`
  - 핵심 대화 실행 인터페이스
- `get_tool_definitions(...)`
  - 현재 세션에서 사용 가능한 tool schema 제공
- `handle_function_call(...)`
  - tool dispatch 인터페이스
- `SessionDB`
  - 세션 저장과 검색 인터페이스

과목 관점에서 보면 Hermes는 `UI/채널 계층`과 `핵심 처리 계층`을 인터페이스로 분리한 구조를 가진다.

### 1.4.1 tool call 구조 구분

Hermes의 tool 사용 구조는 아래 네 개념으로 나눠서 봐야 한다.

| 개념 | 역할 | Hermes 위치 |
| --- | --- | --- |
| tool call | 모델이 생성한 "이 도구를 이 인자로 써라"라는 요청 | `run_agent.py`의 모델 응답 |
| tool registry | 사용 가능한 tool 이름, schema, handler 연결 정보 저장 | `tools/registry.py` |
| tool handler | 실제 기능을 수행하는 Python 함수/로직 | `tools/*.py` |
| tool result | handler 실행 결과 | 다시 `run_agent.py`의 messages로 주입 |

즉, 모델은 직접 파일을 읽거나 명령을 실행하지 않는다.  
모델은 `tool call`만 만들고, 실제 실행은 Hermes 코드가 담당한다.

예시:

`README.md를 읽어줘`
-> 모델이 `read_file(path="README.md")` 같은 `tool call` 생성
-> `handle_function_call()`이 `read_file` handler 실행
-> 파일 내용이 `tool result`로 반환
-> 모델이 그 결과를 보고 최종 요약 답변 생성

### 1.5 핵심 실행 흐름

1. 사용자가 CLI 또는 gateway를 통해 요청한다.
2. `cli.py` 또는 `gateway/run.py`가 세션과 설정을 준비한다.
3. `AIAgent`가 prompt, memory, tool definitions를 조합한다.
4. `run_agent.py`의 loop가 모델 호출을 수행한다.
5. 모델이 tool call을 반환하면 `model_tools.py`가 tool handler를 실행한다.
6. tool 결과를 다시 messages에 넣고 다음 모델 호출을 수행한다.
7. 최종 응답이 생성되면 세션 상태와 사용량 정보가 저장된다.

이 흐름은 전형적인 `LLM + tool calling loop`이지만, Hermes는 여기에 `memory`, `session search`, `delegation`, `cron`이 결합되어 있다.

### 1.5.1 화살표로 본 실행 흐름

#### CLI 흐름

`사용자 입력`
-> `HermesCLI.run() (cli.py)`
-> `chat() (cli.py)`
-> `self.agent.run_conversation() (run_agent.py)`
-> `get_tool_definitions() (model_tools.py)`
-> `memory/context 조합 (run_agent.py + agent/memory_manager.py)`
-> `모델 호출 loop (run_agent.py)`
-> `tool call 시 handle_function_call() (model_tools.py)`
-> `개별 tool 실행 (tools/*.py)`
-> `최종 응답`
-> `CLI 출력 (cli.py)`

#### Gateway 흐름

`사용자 메시지`
-> `GatewayRunner._handle_message() (gateway/run.py)`
-> `GatewayRunner._handle_message_with_agent() (gateway/run.py)`
-> `SessionStore.get_or_create_session() (gateway/session.py)`
-> `SessionStore.load_transcript() (gateway/session.py)`
-> `AIAgent(...) 생성 (gateway/run.py)`
-> `run_conversation() (run_agent.py)`
-> `tool orchestration (model_tools.py)`
-> `개별 tool 실행 (tools/*.py)`
-> `최종 응답`
-> `SessionStore.append_to_transcript() (gateway/session.py)`
-> `플랫폼 전달 (gateway/platforms/*)`

#### Subagent 흐름

`부모 agent`
-> `delegate_task 호출`
-> `tools/delegate_tool.py`
-> `child AIAgent 생성`
-> `child run_conversation()`
-> `child 결과 요약 반환`
-> `부모 agent가 계속 진행`

요약하면 Hermes의 중심 축은 `입력 계층 -> AIAgent -> tool orchestration -> tool 실행 -> 응답 반환`이고, gateway는 이 위에 세션 관리와 플랫폼 전달을 얹는 구조다.

### 1.5.2 어떤 tool을 쓸지는 어떻게 정해지나

Hermes에서 tool 선택은 두 단계로 결정된다.

#### 1. 코드가 후보 tool 목록을 제한

- `run_agent.py`는 `get_tool_definitions(...)`를 호출해 현재 세션에서 모델에게 보여줄 tool 목록을 만든다.
- `model_tools.py`는 enabled toolset, disabled toolset, plugin 등록 상태를 반영해서 실제 tool schema를 필터링한다.
- 따라서 모든 tool이 항상 모델에게 보이는 것은 아니다.

#### 2. 모델이 후보들 중 하나를 선택

- 모델은 사용자 요청, system prompt, tool schema를 보고 어떤 tool call이 적절한지 판단한다.
- Hermes는 prompt에서 tool-use guidance를 강하게 넣어, 가능한 경우 tool을 직접 쓰도록 유도한다.

중요한 구분:

- `tool`은 실행 기능이다.
- `skill`은 주로 작업 지침과 절차 지식이다.

즉, skill이 많다고 해서 skill 자체가 전부 callable function인 것은 아니다.  
대부분의 skill은 모델이 "어떻게 접근할지"를 안내하고, 실제 실행은 여전히 tool call과 tool handler가 담당한다.

### 1.5.3 skill, memory, tool 차이

| 항목 | 본질 | 역할 | Hermes에서의 위치 | 예시 |
| --- | --- | --- | --- | --- |
| skill | 절차 지식 | 작업 방법과 접근 절차 제공 | `tools/skills_tool.py`, `tools/skill_manager_tool.py`, `agent/prompt_builder.py` | "이 유형의 코드베이스는 먼저 구조를 훑고 핵심 파일을 읽은 뒤 수정하라" |
| memory | 지속 사실 | 사용자/환경/반복 규칙 저장 | `agent/memory_manager.py`와 관련 memory store | "사용자는 한국어 설명을 선호한다" |
| tool | 실행 기능 | 실제 읽기, 검색, 실행, 수정 수행 | `tools/*.py`, `tools/registry.py` | `read_file`, `terminal`, `web_search` |

짧게 말하면 `skill = 방법`, `memory = 기억`, `tool = 손발`이다.

### 1.5.4 skill 수정은 어떻게, 언제 일어나나

Hermes는 skill을 수동 문서가 아니라 agent가 관리 가능한 절차 지식으로 본다.

#### 어떻게 수정하나

- `skill_manage` tool로 수정한다.
- `tools/skill_manager_tool.py` 기준 action은 다음과 같다.
  - `create`
  - `edit`
  - `patch`
  - `delete`
  - `write_file`
  - `remove_file`

실제 유지보수에서는 작은 수정은 `patch`, 큰 내용 교체는 `edit`, 새 절차 저장은 `create`에 가깝다.

#### 언제 수정하나

- `agent/prompt_builder.py`의 `SKILLS_GUIDANCE`는
  - 복잡한 작업을 마치면 skill로 저장하라
  - 사용 중 outdated, incomplete, wrong이면 즉시 patch하라
  는 지침을 넣는다.
- `build_skills_system_prompt()`도
  - 관련 skill이 있으면 `skill_view(name)`로 읽으라
  - 문제가 있으면 `skill_manage(action='patch')`로 수정하라
  는 식으로 모델을 유도한다.

즉, Hermes는 사람이 매번 직접 skill 수정을 트리거하는 구조가 아니라, prompt가 유지보수를 유도하고 모델이 작업 중 필요하다고 판단하면 `skill_manage` tool call을 생성하는 구조다.

### 1.5.5 `허용된 tool 목록 + prompt/skill/memory + 현재 문맥`의 구현

이 조합은 순차적으로 만들어진다.

#### 1. 허용된 tool 목록 생성

- `run_agent.py`에서 `self.tools = get_tool_definitions(...)`를 호출한다.
- `model_tools.py`의 `get_tool_definitions()`가 enabled toolset, disabled toolset, plugin 등록 상태를 반영해 현재 세션의 tool schema 목록을 만든다.
- 이 결과로 `self.valid_tool_names`가 구성된다.

#### 2. system prompt 조립

- `run_agent.py`의 `_build_system_prompt()`가 다음 요소를 합친다.
  - agent identity 또는 `SOUL.md`
  - memory/session_search/skills guidance
  - tool-use enforcement guidance
  - user system message
  - memory store 내용
  - external memory block
  - skills prompt
  - context files
  - timestamp, model/provider 정보, environment/platform hints

#### 3. skill 정보 주입

- skill 관련 tool이 활성화되어 있으면 `_build_system_prompt()`가 `build_skills_system_prompt(...)`를 호출한다.
- 여기서 available tools와 available toolsets를 기반으로 skill index와 skill 사용 지침이 system prompt에 들어간다.

#### 4. 현재 문맥 결합

- 현재 사용자 메시지
- 이전 대화 history
- memory context
- session search 결과
- 직전 tool result

가 messages에 합쳐진다.

#### 5. 모델이 tool 선택

- 모델은 `허용된 tool 목록 + system prompt + skill guidance + memory + 현재 문맥`을 보고 다음 tool call을 생성한다.
- 그 뒤 `handle_function_call()`가 실제 tool handler를 실행한다.

즉 Hermes의 구현은 다음 한 줄로 요약할 수 있다.

`코드가 후보를 제한`
-> `코드가 prompt/skill/memory/context를 조립`
-> `모델이 그 위에서 tool을 선택`
-> `handler가 실제 실행`

### 1.5.6 subagent는 언제, 어떻게 쓰이나

Hermes의 subagent는 항상 떠 있는 별도 agent 집합이 아니다.  
부모 agent가 현재 턴 도중 `delegate_task` tool call을 만들었을 때 생성되는 임시 child agent다.

짧은 흐름:

`부모 run_conversation()`
-> 모델이 `delegate_task` tool call 생성
-> `handle_function_call()`
-> `tools/delegate_tool.py`
-> child `AIAgent` 생성
-> child가 자기 `run_conversation()` 수행
-> 최종 summary만 부모에게 반환
-> 부모 agent가 계속 진행

중요한 특징:

- child는 fresh conversation으로 시작한다
- child는 자기 `task_id`를 가진다
- child는 제한된 toolset만 사용한다
- parent는 child의 intermediate tool calls나 reasoning을 직접 보지 않는다
- final summary만 부모 context에 들어온다

### 1.5.7 언제 직접 처리하고, 언제 subagent를 쓰는가

Hermes에서는 부모 agent가 모든 것을 기본적으로 직접 처리하고, 특정 조건에서만 `delegate_task`로 하위 작업을 분리한다.

핵심 경계는 다음 한 줄로 정리할 수 있다.

`부모가 중간 산출물을 직접 보고 이어서 판단해야 하면 직접 처리`
-> `부모가 summary만 받아도 충분하면 subagent 위임`

#### 일반 tool 직접 처리 vs subagent 위임

| 기준 | 일반 tool 직접 처리 | subagent 위임 |
| --- | --- | --- |
| 작업 길이 | 짧거나 보통 | 길고 복합적 |
| 중간 결과 필요성 | 부모가 중간 산출물을 직접 봐야 함 | 부모는 summary만 받아도 됨 |
| 문맥 의존성 | 현재 대화 문맥과 강하게 얽힘 | 독립 task로 잘 잘라짐 |
| 실행 방식 | 부모가 단계별 tool call 수행 | child agent가 하위 task를 처리 |
| context 비용 | 낮음 | 높아서 분리 가치가 큼 |
| 병렬화 가치 | 보통 낮음 | 높을 수 있음 |

#### subagent가 적절한 경우

- reasoning-heavy subtask
  - 디버깅
  - 코드 리뷰
  - 리서치 정리
- intermediate data가 많아 부모 context를 오염시킬 수 있는 작업
- 서로 독립적인 하위 작업을 병렬 실행할 때

#### subagent가 부적절한 경우

- 부모가 1~3번 정도의 tool call로 직접 끝낼 수 있는 짧은 작업
- 부모가 중간 결과를 바로 보고 이어서 판단해야 하는 작업
- 사용자 직접 상호작용이나 clarify가 필요한 작업
- 장기 memory를 직접 읽고 수정해야 하는 작업

즉 Hermes의 subagent는 "기본 실행 방식"이 아니라, 독립적인 하위 목표가 있고 부모가 결론만 받으면 충분할 때 쓰는 선택적 위임 기능이다.

### 1.5.8 subagent와 새 agent/session의 차이

코드 수준에서는 child subagent도 새 `AIAgent` 인스턴스를 생성한다.  
하지만 시스템 설계 관점에서는 "사용자와 독립적인 새 agent 세션"이라기보다 "부모 agent가 현재 턴 안에서 잠깐 호출하는 delegated worker"에 가깝다.

| 항목 | subagent delegation | 완전히 새로운 agent/session |
| --- | --- | --- |
| 시작 시점 | 부모 agent가 현재 턴 도중 필요할 때 | 사용자가 새 실행을 직접 시작할 때 |
| 목적 | 하위 작업 위임 | 독립 작업 시작 |
| 문맥 관계 | 부모 턴 안에 종속 | 독립 실행 |
| 반환값 | summary만 부모에게 반환 | 결과를 자기 세션에 유지 |

즉 "새 agent 생성"이 코드적으로는 맞지만, 의미적으로는 "부모가 호출한 하위 작업자"라는 표현이 더 정확하다.

### 1.5.9 orchestration은 어디를 말하나

Hermes의 orchestration은 레벨별로 나뉜다.

| 레벨 | 파일 | 역할 |
| --- | --- | --- |
| 시스템 orchestration | `gateway/run.py` | 세션, 플랫폼, 메시지 전달, transcript 관리 |
| 단일 agent orchestration | `run_agent.py` | prompt 조립, tool loop, 결과 통합, 종료 판단 |
| subagent orchestration | `tools/delegate_tool.py` | child agent 생성, 제한, 병렬 실행, summary 수집 |

따라서 개발 계획서 관점에서는 `run_agent.py`가 핵심 orchestration, `delegate_tool.py`는 선택적 하위 작업 orchestration으로 보는 것이 적절하다.

### 1.5.10 한 요청 안에서 왜 모델을 여러 번 호출하나

Hermes는 한 요청을 한 번 호출하고 끝내는 구조가 아니라 `tool-calling loop`로 처리한다.

즉 한 요청 안에서도 다음이 반복될 수 있다.

`모델 호출`
-> `tool call 생성`
-> `tool 실행`
-> `tool result를 messages에 추가`
-> `모델 재호출`

따라서 부모 agent는 한 요청 안에서 여러 번 다시 판단할 수 있다.

중요한 구분:

- base system prompt는 비교적 안정적이다
- 하지만 실제 모델 입력(messages)은 tool result와 history가 누적될 때마다 다시 구성된다

즉 "prompt를 다시 만든다"는 말은 보통 완전히 새 agent를 만드는 것이 아니라, 누적된 messages를 바탕으로 다음 모델 호출 입력을 다시 구성한다는 뜻이다.

대표 예시:

`사용자: 이 레포 인증 구조 분석해줘`
-> `search_files(...)`
-> `tool result 추가`
-> `read_file(...)`
-> `tool result 추가`
-> 범위가 너무 크면 `delegate_task`
-> `child summary 추가`
-> 최종 구조 설명 생성

### 1.5.11 부모 agent 의사결정 tree

Hermes의 단일 요청 처리는 다음처럼 이해할 수 있다.

```text
[사용자 요청]
   |
   v
[모델 호출 1]
   |
   |-- 바로 답 가능
   |    -> 최종 응답
   |
   |-- 추가 정보 필요
   |    -> 일반 tool call
   |
   |-- 처음부터 분리 가치가 큼
   |    -> delegate_task
   v
[tool result 또는 child summary 추가]
   |
   v
[모델 호출 2]
   |
   |-- 충분히 알게 됨
   |    -> 최종 응답
   |
   |-- 추가 tool 필요
   |    -> 또 tool call
   |
   |-- 너무 길거나 독립적임
   |    -> delegate_task
   v
[반복]
```

즉 subagent는 보통 "처음부터 고정된 구성"이 아니라, 부모가 루프 중 어느 턴에서든 현재까지 누적된 문맥을 보고 선택할 수 있는 분기다.

### 1.6 에이전트 분리 관점

Hermes를 "여러 agent가 협업하는 시스템"으로 보기 전에, 먼저 역할 단위로 분리해서 보는 게 맞다.

| 역할 | 주요 파일 | 책임 | 해석 |
| --- | --- | --- | --- |
| 사용자 접점 관리자 | `cli.py`, `gateway/run.py` | 입력 수집, 세션 관리, 플랫폼 UX | 에이전트 자체보다 채널/세션 coordinator |
| 핵심 대화 에이전트 | `run_agent.py` | 모델 호출, tool loop, memory 반영, 응답 생성 | 시스템의 중심 agent |
| 하위 작업 에이전트 | `tools/delegate_tool.py` | 격리된 context와 제한된 toolset으로 하위 작업 수행 | 명시적 subagent |
| 자동화 실행자 | `cron/scheduler.py` | 예약된 작업을 적절한 시점에 실행 | background worker에 가까움 |
| 상태/기억 서브시스템 | `hermes_state.py`, `agent/memory_manager.py` | 세션 저장, 검색, 기억 주입 | agent를 지원하는 persistence layer |
| 도구 실행 서브시스템 | `model_tools.py`, `tools/*.py` | 기능 실행, 외부 자원 접근 | capability layer |

중요한 점:

- Hermes의 "주 에이전트"는 `AIAgent` 하나가 중심이다.
- `delegate_tool.py`는 실제로 별도 child `AIAgent`를 생성하므로, 여기서만 명시적인 agent 분리가 일어난다.
- `gateway`, `cron`, `memory`는 별도 agent라기보다 main agent를 둘러싼 운영 서브시스템으로 보는 편이 정확하다.

즉, Hermes를 처음부터 멀티 에이전트 시스템으로 분류하기보다 `단일 핵심 에이전트 + 보조 운영 계층 + 선택적 subagent` 구조로 해석하는 것이 맞다.

### 1.7 품질 속성 관점

#### 성능

- `run_agent.py`는 iteration budget을 둬 무한 loop를 제한한다.
- `ContextCompressor`를 사용해 긴 대화에서 컨텍스트 길이를 줄인다.
- `gateway/run.py`는 세션별 `AIAgent` 캐시를 둬 프롬프트 캐시를 보존하려고 한다.
- `model_tools.py`는 persistent event loop를 사용해 async tool 호출 오버헤드를 줄이려 한다.

#### 확장성

- tool registry 기반 구조라 새 도구 추가가 쉽다.
- gateway platform adapter 구조로 채널 확장이 가능하다.
- 여러 실행 환경을 추상화해 배포 선택지를 넓힌다.

#### 유지보수성

- 책임 분리는 어느 정도 되어 있다.
  - 예: `run_agent.py`, `model_tools.py`, `gateway/`, `cron/`, `tools/`
- 하지만 핵심 로직이 `run_agent.py`에 매우 많이 집중되어 있어 유지보수 비용이 높아질 위험이 있다.
- 즉, 모듈 분리는 되어 있으나 핵심 제어기의 응집도가 지나치게 높다.

#### 안정성

- `hermes_state.py`는 WAL 모드와 retry 로직으로 동시성 충돌을 줄이려 한다.
- `gateway/run.py`는 세션별 agent 캐시 상한과 idle TTL을 둔다.
- iteration budget, 세션 저장, background watcher 구조를 통해 장시간 동작을 염두에 둔 설계가 보인다.

## 2. 해석

### 2.1 시스템 설계 관점 해석

- Hermes의 핵심 설계 선택은 `assistant product`보다 `assistant platform` 쪽에 무게를 둔 것이다.
- 이 선택 때문에 CLI, gateway, memory, cron, delegation, environment abstraction이 모두 1급 구성요소가 되었다.
- 결과적으로 Hermes는 기능 범위가 넓고 확장성은 좋지만, 학습용 발표나 MVP 개발 관점에서는 구조 복잡도가 빠르게 커진다.

### 2.2 에이전트 분리 관점 해석

- Hermes는 겉보기와 달리 "처음부터 여러 agent가 분산 협업하는 구조"는 아니다.
- 실제 중심은 `AIAgent` 하나이고, 하위 작업이 필요한 경우에만 child agent를 추가 생성한다.
- 따라서 Hermes는 `단일 중심 agent + 선택적 subagent + 주변 운영 계층` 구조로 이해하는 것이 가장 정확하다.

### 2.3 장점

- 사용자 접점과 핵심 에이전트를 분리해 여러 채널을 수용할 수 있다.
- tool registry와 toolset 구조가 확장에 유리하다.
- 세션 저장, memory, 검색, cron이 통합되어 장기 assistant 경험을 구현하기 좋다.
- delegation 구조가 있어 기능 확장 여지가 크다.

### 2.4 한계

- 중심 제어기인 `run_agent.py`에 책임이 많이 집중되어 있다.
- 기능이 매우 넓어서 발표에서 핵심 설계 포인트를 좁히지 않으면 흐려지기 쉽다.
- self-improving, memory, gateway, multi-environment까지 동시에 가져가면 MVP 기준으로 과설계가 된다.

## 3. 우리 프로젝트 시사점

### 3.1 가져올 점

- 사용자에게는 하나의 assistant처럼 보이게 하고, 내부는 기능 단위로 분해하는 방식
- `UI/채널 계층`과 `핵심 agent 계층`을 분리하는 구조
- session-first 구조와 상태 저장 관점
- 나중에 delegation이나 memory를 붙일 수 있는 확장 여지

### 3.2 그대로 가져오면 과한 점

- self-improving loop
- 여러 메시징 플랫폼 동시 지원
- 너무 넓은 실행 환경 추상화
- 광범위한 memory/skills platform

### 3.3 핵심 정리 문장

- Hermes는 단일 대화형 assistant가 아니라, 장기 상태와 자동화 능력을 가진 assistant platform으로 설계되었다.
- 구조상 핵심은 `AIAgent` 하나이며, 필요 시에만 child agent를 생성하는 선택적 delegation 구조를 가진다.
- 따라서 우리 프로젝트는 Hermes 전체를 모방하기보다, `핵심 agent + 명확한 상태 모델 + 필요한 범위의 기능 분리`만 가져오는 것이 적절하다.

## 4. 다음 확인 항목

- `agent/memory_manager.py`와 관련 memory 플러그인 범위를 더 읽고, memory가 core인지 선택 기능인지 분리 확인
- `gateway/session.py`를 읽고 session ownership 구조를 더 구체화
- `tools/approval.py`, `terminal_tool.py`를 읽고 안전성 설계를 별도 항목으로 보강
- OpenClaw 분석 시 Hermes와의 차이를 `agent 중심성`, `gateway 중심성`, `session ownership` 기준으로 비교

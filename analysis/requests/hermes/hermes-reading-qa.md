# Hermes Reading Q&A

이 문서는 `upstreams/hermes.md`를 읽으면서 생기는 질문과 답을 누적하는 작업용 문서다.

## 목적

- 읽는 중 생긴 질문을 빠르게 기록한다.
- 답변 과정에서 보정된 해석을 남긴다.
- 아직 확정되지 않은 부분과 확정된 결론을 구분한다.
- 확정된 내용만 이후 `../upstreams/hermes.md`에 반영한다.

## 사용 규칙

- 질문은 짧고 구체적으로 적는다.
- 답변은 가능하면 코드 근거 또는 문서 근거를 함께 적는다.
- `확정`, `가설`, `추가 확인 필요`를 섞지 않는다.

## 기록 템플릿

```md
## Q1. 질문 제목

### 질문

- 사용자 질문

### 답변

- 답변 요약

### 근거

- 파일 경로
- 코드/문서 포인트

### 상태

- 확정 / 가설 / 추가 확인 필요

### upstream 반영 여부

- 반영함 / 보류
```

---

## Q1. 문서 시작

### 질문

- Hermes 분석 문서를 읽으면서 생기는 질문을 여기부터 누적한다.

### 답변

- 질문이 들어오면 순서대로 추가한다.

### 근거

- `analysis/upstreams/hermes.md`

### 상태

- 확정

### upstream 반영 여부

- 보류

## Q2. Hermes 레이어를 흐름 화살표로 보면 어떻게 되나

### 질문

- 레이어가 여러 개인데, 실제 실행 흐름을 `사용자 입력 -> 어떤 파일 -> 어떤 파일` 형식으로 정리해 달라는 요청

### 답변

- Hermes는 최소 두 개의 대표 흐름으로 보는 게 정확하다.
- `CLI 흐름`과 `Gateway 흐름`이 다르고, 필요하면 `Subagent 흐름`이 그 아래에서 추가된다.

#### 1. CLI 기준 기본 흐름

`사용자 입력`
-> `HermesCLI.run() (cli.py)`
-> `chat() (cli.py)`
-> `self.agent.run_conversation() (run_agent.py)`
-> `get_tool_definitions() (model_tools.py)`
-> `memory/context 조합 (run_agent.py + agent/memory_manager.py)`
-> `모델 호출 loop (run_agent.py)`
-> `tool call 발생 시 handle_function_call() (model_tools.py)`
-> `개별 tool 실행 (tools/*.py)`
-> `tool 결과를 messages에 반영 (run_agent.py)`
-> `최종 응답 생성 (run_agent.py)`
-> `CLI 출력 (cli.py)`

#### 2. Gateway 기준 기본 흐름

`사용자 메시지`
-> `GatewayRunner._handle_message() (gateway/run.py)`
-> `GatewayRunner._handle_message_with_agent() (gateway/run.py)`
-> `SessionStore.get_or_create_session() (gateway/session.py)`
-> `SessionStore.load_transcript() (gateway/session.py)`
-> `AIAgent(...) 생성 (gateway/run.py)`
-> `run_conversation() (run_agent.py)`
-> `get_tool_definitions() (model_tools.py)`
-> `모델 호출 loop (run_agent.py)`
-> `tool call 시 handle_function_call() (model_tools.py)`
-> `개별 tool 실행 (tools/*.py)`
-> `최종 응답 반환 (run_agent.py)`
-> `SessionStore.append_to_transcript() (gateway/session.py)`
-> `플랫폼별 응답 전송 (gateway/run.py -> gateway/platforms/*)`

#### 3. Subagent 위임 흐름

`부모 agent의 tool call`
-> `delegate_task (run_agent.py에서 처리 분기)`
-> `tools/delegate_tool.py`
-> `child AIAgent 생성`
-> `child run_conversation()`
-> `child tool 실행`
-> `child 요약 반환`
-> `부모 run_agent.py가 결과를 이어서 사용`

- 따라서 Hermes의 핵심은 `입력 계층 -> AIAgent -> tool orchestration -> tool 실행 -> 응답 반환`이다.
- gateway는 이 위에 `세션 관리`와 `플랫폼 전달`을 덧씌운 운영 계층으로 보면 된다.

### 근거

- `forks/hermes_agent_fork/cli.py`
- `forks/hermes_agent_fork/run_agent.py`
- `forks/hermes_agent_fork/model_tools.py`
- `forks/hermes_agent_fork/gateway/run.py`
- `forks/hermes_agent_fork/gateway/session.py`
- `forks/hermes_agent_fork/tools/delegate_tool.py`

### 상태

- 확정

### upstream 반영 여부

- 반영함

## Q6. 한 요청 안에서 왜 모델을 여러 번 호출하나

### 질문

- 부모 agent는 `현재 문맥, prompt, skill, memory`를 한 번만 받는 것 아닌지 묻는 요청
- 한 요청 안에서 subagent 판단이 어떻게 가능한지 묻는 요청
- tool result가 나온 뒤 다시 prompt를 만든다는 말이 무슨 뜻인지 묻는 요청
- 부모 agent 의사결정 경계를 decision tree처럼 정리해 달라는 요청

### 답변

#### 1. 한 요청 안에서도 모델 호출은 여러 번 일어날 수 있다

- Hermes는 한 요청을 `한 번 모델 호출하고 끝내는 구조`가 아니다.
- `run_agent.py`의 `run_conversation()`는 tool-calling loop를 돈다.
- 즉 한 요청 안에서도 다음이 반복될 수 있다.

`모델 호출`
-> `tool call 생성`
-> `tool 실행`
-> `tool result를 messages에 추가`
-> `모델 재호출`

즉 부모 agent는 한 요청 안에서 "여러 번 다시 판단"한다.

#### 2. 그러면 prompt를 매번 새로 만드는가

- base system prompt는 세션 단위로 비교적 안정적이다.
- 하지만 모델 API 호출 때마다 실제 입력(messages)은 다시 조립된다.

구분:

- 상대적으로 안정적인 것
  - identity / SOUL.md
  - memory guidance
  - skills guidance
  - tool-use enforcement guidance
  - memory block
  - skills prompt

- 매 반복마다 달라질 수 있는 것
  - 현재 user message
  - 이전 tool result
  - 새롭게 추가된 assistant/tool 메시지
  - injected recall/session search 결과

즉 "prompt를 다시 만든다"는 말은 보통
`완전히 새 agent를 처음부터 다시 만든다`는 뜻이 아니라,
`누적된 messages를 바탕으로 다음 모델 호출 입력을 다시 구성한다`는 뜻에 가깝다.

#### 3. tool result가 나온다는 건 무슨 의미인가

- 네 해석이 거의 맞다.
- 한 요청 안에 여러 작업이 있거나, 큰 작업을 여러 단계로 풀어야 하면
  모델은 먼저 첫 단계 tool을 호출할 수 있다.
- 그 결과가 `tool result`로 messages에 추가된다.
- 그다음 모델은 그 결과를 보고 다음 행동을 결정한다.

예:

`사용자: 이 레포 인증 구조 분석해줘`

1차 호출:
- `search_files("auth|login|token")`

2차 호출:
- 검색 결과를 보고
- `read_file(...)` 몇 개 호출

3차 호출:
- 읽은 결과를 보고
- 범위가 너무 크면 `delegate_task`

4차 호출:
- child summary를 받고
- 최종 설명 생성

즉 tool result는 "첫 작업을 해본 뒤 얻은 실제 결과"이고,
그걸 다음 판단의 입력으로 다시 넣는 것이다.

#### 4. 부모 agent가 subagent를 언제 판단하나

- 부모 agent는 처음부터 subagent를 고정적으로 들고 시작하는 게 아니다.
- 루프 중 어느 턴에서든 현재까지 누적된 문맥을 보고
  `delegate_task`를 선택할 수 있다.

즉:

`처음 user 요청`
-> `직접 처리 시도`
-> `tool 결과 축적`
-> `이제는 하위 작업 분리가 낫다`고 판단
-> `delegate_task`

이 흐름이 더 정확하다.

#### 5. 부모 agent 의사결정 tree

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

#### 6. 경계 한 줄

- 부모가 중간 산출물을 직접 보고 바로 이어서 판단해야 하면 직접 처리
- 부모가 결론/요약만 받아도 충분하면 subagent 위임

### 근거

- `forks/hermes_agent_fork/run_agent.py`
- `forks/hermes_agent_fork/tools/delegate_tool.py`

### 상태

- 확정

### upstream 반영 여부

- 반영함

## Q5. subagent는 언제 쓰고, agent orchestration은 어디를 말하나

### 질문

- tool 사용 이후 subagent 흐름을 자세히 설명해 달라는 요청
- agent orchestration이 어디를 말하는지 설명해 달라는 요청
- 부모 agent 안에서 subagent가 필요한 시점이 어디인지 묻는 요청
- subagent가 기존 agent 내부 중간 단계인지, 처음부터 새 세션을 만드는 건지, 그냥 새로운 agent 생성과 무엇이 다른지 묻는 요청

### 답변

#### 1. subagent는 Hermes에서 어떻게 생기나

- Hermes에서 subagent는 항상 떠 있는 고정 구성요소가 아니다.
- 부모 agent가 작업 중간에 `delegate_task`라는 tool call을 만들 때 그 순간 생성되는 임시 child agent다.
- 즉 `delegate_task`는 일반 tool call 중 하나이며, `tools/delegate_tool.py`가 그 tool handler다.

짧은 흐름:

`부모 run_conversation() 진행`
-> 모델이 `delegate_task` tool call 생성
-> `handle_function_call()`
-> `tools/delegate_tool.py`
-> child `AIAgent` 생성
-> child가 자기 `run_conversation()` 수행
-> 요약만 부모에게 반환
-> 부모가 그 요약을 받아 계속 진행

#### 2. 언제 subagent를 쓰는 게 적절한가

`delegate_tool.py`의 설명 기준으로 적절한 경우는 다음과 같다.

- reasoning-heavy subtask
  - 디버깅
  - 코드 리뷰
  - 조사/리서치 요약
- intermediate data가 너무 많아 부모 context를 오염시킬 수 있는 작업
- 서로 독립적인 작업을 병렬 처리할 때

즉 subagent는 "하위 task를 분리했을 때 부모 context를 아끼고 구조를 깔끔하게 만들 수 있는 경우"에 적절하다.

#### 3. 언제 부적절한가

- 그냥 부모가 바로 처리해도 되는 짧은 작업
- 사용자와 직접 상호작용이 필요한 작업
- 장기 memory를 직접 만져야 하는 작업
- 재귀적으로 agent를 계속 낳는 구조

코드상으로도 child는 다음을 제한받는다.

- `delegate_task`
- `clarify`
- `memory`
- `send_message`
- `execute_code`

즉 Hermes는 child를 범용 agent라기보다 제한된 하위 작업자처럼 다룬다.

#### 4. 부모 agent 안에 여러 skill이 돌다가 중간에 필요하면 subagent를 만드는 건가

- 이 해석이 더 맞다.
- 부모 agent가 먼저 자기 루프를 돈다.
- 그 과정에서 prompt, memory, skill guidance, 현재 문맥을 보고
  "이 작업은 분리하는 게 낫다"라고 판단하면
  `delegate_task` tool call을 생성한다.
- 즉 subagent는 보통 부모 agent 실행 도중 중간 단계에서 생긴다.

중요한 점:

- skill이 "자동으로 subagent를 만든다"는 것은 아니다.
- skill은 절차 지식이므로 "이런 경우 분리해서 처리하는 게 낫다"는 판단을 유도할 수는 있다.
- 하지만 실제 생성은 결국 모델이 `delegate_task` tool call을 만들 때 일어난다.

#### 5. 그럼 처음부터 새로운 세션/새 agent를 만드는 것과 뭐가 다른가

- child subagent는 실제로는 새로운 `AIAgent` 인스턴스를 생성한다.
- 하지만 제품 의미상 "사용자와 독립적인 새 agent 세션을 시작"하는 것이 아니라,
  부모 agent가 현재 턴 안에서 잠깐 호출하는 하위 작업자에 가깝다.

차이:

| 항목 | subagent delegation | 완전히 새로운 agent/session 시작 |
| --- | --- | --- |
| 시작 시점 | 부모 agent가 현재 턴 도중 필요할 때 | 사용자가 새 대화나 새 실행을 직접 시작할 때 |
| 목적 | 하위 작업 위임 | 독립적인 상위 작업 시작 |
| 문맥 관계 | 부모 턴 안에 종속 | 독립 실행 |
| 반환값 | 요약만 부모에게 반환 | 자기 결과를 자기 세션에서 유지 |
| 사용자 관점 | 부모 assistant의 내부 위임 | 별도 실행으로 인식 가능 |

즉 코드 수준에서는 새 `AIAgent`를 만드는 게 맞지만, 시스템 설계 관점에서는 "부모 agent 내부에서 잠깐 생성되는 delegated child"로 보는 게 더 정확하다.

#### 6. agent orchestration은 어디를 말하나

Hermes의 orchestration은 레벨별로 나눠 보는 게 정확하다.

##### 시스템 orchestration

- `gateway/run.py`
- 세션, 플랫폼, 메시지 전달, transcript 관리

##### 단일 agent orchestration

- `run_agent.py`
- prompt 조립, tool call loop, 결과 통합, 종료 판단

##### subagent orchestration

- `tools/delegate_tool.py`
- child toolset 제한
- child prompt 구성
- child agent 생성
- 병렬 실행
- summary 수집

즉 "agent orchestration"을 좁게 말하면 `run_agent.py`, 넓게 말하면 `run_agent.py + delegate_tool.py + gateway/run.py`까지 포함해 볼 수 있다.

#### 7. 한 줄 정리

- subagent는 보통 부모 agent가 현재 턴 도중 필요하다고 판단했을 때 생성되는 임시 child agent다.
- 코드적으로는 새 `AIAgent` 인스턴스를 만들지만, 설계적으로는 "독립 제품 agent"가 아니라 "delegated worker"에 가깝다.

### 근거

- `forks/hermes_agent_fork/tools/delegate_tool.py`
- `forks/hermes_agent_fork/run_agent.py`
- `forks/hermes_agent_fork/model_tools.py`
- `forks/hermes_agent_fork/gateway/run.py`

### 상태

- 확정

### upstream 반영 여부

- 반영함

## Q4. skill 수정은 어떻게 하고, 언제 판단하며, tool/prompt/skill/memory/문맥 결합은 어떻게 구현되나

### 질문

- skill 수정은 어떻게 하는지
- 언제 skill을 수정해야 한다고 판단하는지
- `허용된 tool 목록 + prompt/skill/memory + 현재 문맥`이 실제 코드에서 어떻게 구현되는지
- `skill`, `memory`, `tool` 차이를 표로 정리해 달라는 요청

### 답변

#### 1. skill 수정은 어떻게 하나

- Hermes는 `skill_manage`라는 전용 tool로 skill을 수정한다.
- 구현은 `tools/skill_manager_tool.py`에 있다.
- 지원 action은 다음과 같다.
  - `create`
  - `edit`
  - `patch`
  - `delete`
  - `write_file`
  - `remove_file`

실무적으로는:

- 작은 수정은 `patch`
- 큰 내용 교체는 `edit`
- 새 procedural knowledge 저장은 `create`

로 보는 게 맞다.

#### 2. 언제 skill을 수정한다고 판단하나

- 1차로는 prompt가 그렇게 유도한다.
- `agent/prompt_builder.py`의 `SKILLS_GUIDANCE`에 다음 의미가 들어 있다.
  - 복잡한 작업을 마치면 skill로 저장하라
  - skill을 써봤는데 outdated, incomplete, wrong이면 즉시 `skill_manage(action='patch')`로 고쳐라
- `build_skills_system_prompt()` 쪽에도
  - 관련 skill이 있으면 `skill_view(name)`로 로드하라
  - 문제가 있으면 `skill_manage(action='patch')`로 수정하라
  는 지시가 들어간다.

즉, Hermes는 사람이 매번 직접 판단하는 구조라기보다:

- prompt가 skill 유지보수를 강하게 권장하고
- 모델이 현재 작업 중 skill이 틀렸다고 판단하면
- `skill_manage` tool call을 생성하는 방식이다

예:

- skill에 적힌 명령어가 실제 레포 구조와 맞지 않음
- skill이 빠뜨린 단계 때문에 모델이 추가 시행착오를 겪음
- 더 나은 절차를 작업 중 발견함

이런 경우 모델이 `skill_manage(action='patch', ...)`를 호출할 수 있다.

#### 3. skill / memory / tool 차이 표

| 항목 | 본질 | 역할 | Hermes 구현 위치 | 예시 |
| --- | --- | --- | --- | --- |
| skill | 절차 지식 | 어떻게 접근할지 알려줌 | `tools/skills_tool.py`, `tools/skill_manager_tool.py`, `agent/prompt_builder.py` | "이 레포에서는 테스트 전에 setup 스크립트를 먼저 확인하라" |
| memory | 지속 사실 | 사용자/환경/규칙 같은 장기 정보 저장 | `agent/memory_manager.py`, memory 관련 store | "사용자는 한국어 설명을 선호한다" |
| tool | 실행 기능 | 실제로 읽고, 검색하고, 실행함 | `tools/*.py`, `tools/registry.py` | `read_file`, `terminal`, `web_search` |

짧게 말하면:

- skill = 방법
- memory = 기억
- tool = 손발

#### 4. `허용된 tool 목록 + prompt/skill/memory + 현재 문맥`은 어떻게 구현되나

이건 순서대로 조립된다.

##### 1단계: 허용된 tool 목록 만들기

- `run_agent.py`에서 `self.tools = get_tool_definitions(...)`를 호출한다.
- `model_tools.py`의 `get_tool_definitions()`가 enabled toolset, disabled toolset, plugin 등록 상태를 반영해 실제 tool schema 목록을 만든다.
- 이 결과로 `self.valid_tool_names`도 구성된다.

즉:

- 어떤 tool이 모델에게 보일지 먼저 코드가 결정한다.

##### 2단계: system prompt 만들기

- `run_agent.py`의 `_build_system_prompt()`가 prompt를 조립한다.
- 이때 들어가는 요소는 대략 다음과 같다.
  - agent identity 또는 `SOUL.md`
  - memory guidance / session_search guidance / skills guidance
  - tool-use enforcement guidance
  - user system message
  - memory store 내용
  - external memory manager block
  - skills prompt
  - context files
  - timestamp / model / provider / platform hints

##### 3단계: skills prompt 주입

- `_build_system_prompt()` 안에서 skill 관련 tool이 활성화되어 있으면 `build_skills_system_prompt(...)`를 호출한다.
- 이 함수는 available tools, available toolsets를 기준으로 skill index와 skill 사용 지침을 system prompt에 넣는다.
- 관련 skill이 있으면 `skill_view(name)`로 로드하라고 모델에게 알려준다.

##### 4단계: 현재 문맥 결합

- 현재 사용자 메시지
- 이전 대화 history
- session search 결과
- memory context block
- 필요 시 tool result

가 함께 messages에 들어가서 모델 호출에 사용된다.

##### 5단계: 모델이 최종 선택

- 모델은 위에서 조립된
  - 허용된 tool 목록
  - system prompt
  - skill guidance
  - memory
  - 현재 대화 문맥

을 보고 어떤 tool call을 낼지 결정한다.

즉 구현적으로는:

`코드가 후보를 제한`
-> `코드가 prompt와 memory와 skill 정보를 조립`
-> `모델이 현재 문맥을 보고 tool call 생성`
-> `handle_function_call()`가 실제 handler 실행

#### 5. 한 줄 정리

- skill 수정은 `skill_manage` tool로 한다.
- 수정 시점은 prompt가 강하게 유도하고, 모델이 실제 작업 중 skill이 틀리거나 부족하다고 판단할 때 결정된다.
- tool 선택은 자유 추측이 아니라 `코드가 만든 허용 목록 + 조립된 prompt/memory/skill/context` 위에서 모델이 선택하는 구조다.

### 근거

- `forks/hermes_agent_fork/tools/skill_manager_tool.py`
- `forks/hermes_agent_fork/tools/skills_tool.py`
- `forks/hermes_agent_fork/agent/prompt_builder.py`
- `forks/hermes_agent_fork/run_agent.py`
- `forks/hermes_agent_fork/model_tools.py`

### 상태

- 확정

### upstream 반영 여부

- 반영함

## Q3. tool call, tool handler, tool result는 각각 무엇인가

### 질문

- `tool call 후에 tool handler 실행`이라는 표현이 정확히 무슨 뜻인지
- `tool call`, `tool registry`, `tool handler`, `tool result`를 구분해서 설명해 달라는 요청
- 사용자가 입력했을 때 어떤 tool을 쓸지는 어떻게 정하는지 설명해 달라는 요청

### 답변

- Hermes에서 모델은 직접 Python 함수를 실행하지 못한다.
- 대신 먼저 "어떤 도구를 어떤 인자로 써라"라는 구조화된 요청을 만든다. 이게 `tool call`이다.
- 그다음 Hermes 코드가 이 요청을 받아 실제 함수로 연결해서 실행한다. 이 실제 함수가 `tool handler`다.
- 실행이 끝나면 결과가 JSON 문자열 등으로 반환되는데, 이게 `tool result`다.

#### 1. 개념 구분

##### tool call

- 모델이 만든 도구 사용 요청
- 예: `read_file(path="README.md")`를 호출하라는 구조화된 출력
- 아직 실제 파일을 읽은 것은 아니다

##### tool registry

- 어떤 tool이 존재하는지, 이름이 무엇인지, 어떤 schema를 쓰는지, 실제 어느 handler와 연결되는지 모아둔 등록소
- Hermes에서는 `tools/registry.py`가 이 역할을 맡는다

##### tool handler

- 특정 tool 이름에 대응되는 실제 Python 함수 또는 실행 로직
- 예: `read_file` 요청이 오면 파일을 읽는 코드가 실제로 실행된다

##### tool result

- handler가 실행된 뒤 반환하는 실제 결과
- 이 결과는 다시 `run_agent.py` 쪽 대화 메시지에 들어가고, 모델은 그걸 보고 다음 행동 또는 최종 답변을 만든다

#### 2. 짧은 예시

사용자:

- `README.md 읽고 핵심만 요약해줘`

흐름:

`사용자 입력`
-> `run_conversation()`
-> 모델이 `read_file(path="README.md")` 같은 `tool call` 생성
-> `handle_function_call()`이 `read_file`에 연결된 `tool handler` 실행
-> 실제 파일 내용이 `tool result`로 반환
-> 그 결과를 다시 모델에 넣음
-> 모델이 최종 요약 답변 생성

즉:

- `tool call`은 주문서
- `tool handler`는 실제 작업자
- `tool result`는 작업 결과물

#### 3. 어떤 tool을 쓸지는 누가 정하나

- 1차로는 코드가 후보를 제한한다.
- 2차로는 모델이 그 후보들 중 하나를 선택한다.

##### 1차: 코드가 후보 tool 목록을 정함

- `run_agent.py`에서 `self.tools = get_tool_definitions(...)`를 호출한다.
- `model_tools.py`의 `get_tool_definitions()`는 현재 enabled toolset, disabled toolset, plugin 등록 여부를 기준으로 실제로 모델에게 보여줄 tool 목록을 만든다.
- 즉, 모든 tool이 항상 보이는 게 아니다.

##### 2차: 모델이 그중에서 선택함

- 모델은 system prompt, 현재 사용자 요청, tool schema를 보고 어떤 tool이 적절한지 판단한다.
- 예를 들어 파일 읽기 요청이면 `read_file`, 웹 검색 요청이면 `web_search`, 터미널 작업이면 `terminal` 쪽으로 tool call을 생성한다.
- Hermes는 prompt에 tool-use guidance를 넣어, 가능하면 말로만 설명하지 말고 tool을 실제로 쓰도록 유도한다.

#### 4. skill이 많으면 tool 선택이 어떻게 되나

- 여기서 `skill`과 `tool`은 구분해야 한다.
- `tool`은 직접 실행 가능한 함수다.
- `skill`은 보통 모델에게 주는 작업 지침, 절차, 노하우에 가깝다.

즉:

- skill은 "어떻게 할지"를 알려주는 지식
- tool은 "실제로 손발처럼 실행하는 기능"

Hermes에서는:

- `build_skills_system_prompt(...)`가 skills 정보를 system prompt 쪽에 넣는다
- 모델은 그 skill 지침을 참고해서 행동 방식을 정한다
- 하지만 실제 실행은 여전히 tool call로 한다

예를 들어:

- skill이 "코드 분석할 때 먼저 파일 목록을 보고, 그다음 핵심 파일을 읽고, 마지막에 요약하라"를 알려줄 수 있다
- 그러면 모델은 그 지침을 참고해서
  - `search_files`
  - `read_file`
  - 필요시 `terminal`
  같은 tool call을 순서대로 만들 수 있다

즉, skill이 tool을 직접 대체하는 게 아니라 tool 선택과 사용 순서를 유도하는 경우가 많다.

#### 5. 한 줄 정리

- 어떤 tool을 쓸지는 `코드가 보여준 후보 목록` 안에서 `모델이 prompt와 schema를 보고 선택`한다.
- skill은 주로 선택 전략과 절차를 보조하고, 실제 실행은 tool handler가 담당한다.

### 근거

- `forks/hermes_agent_fork/run_agent.py`
- `forks/hermes_agent_fork/model_tools.py`
- `forks/hermes_agent_fork/tools/registry.py`
- `forks/hermes_agent_fork/agent/prompt_builder.py`

### 상태

- 확정

### upstream 반영 여부

- 반영함

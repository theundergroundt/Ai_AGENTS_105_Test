# Hermes Agent Project Analysis

agent 시스템을 `시스템 설계 분석` 관점으로, 템플릿 구조에 맞춰 다시 정리한 문서다.
기존 누적 분석본은 `../upstreams/hermes.md`를 기준으로 한다.

## 1. 기본 정보

- 프로젝트명: Hermes
- 저장소 링크: `https://github.com/theundergroundt/hermes_agent_fork.git`
- 분석 날짜: `2026-04-19 19:36`
- 분석 버전 또는 커밋: `3a635145`
- 분석 범위: `Ai_AGENTS_105_Test/forks/hermes_agent_fork`
- 분석 목적:
  - 시스템 설계 분석 과목 기준으로 Hermes의 구조를 템플릿 형식에 맞춰 재정리
  - 우리 Spring 기반 agent runtime 설계에 참고할 포인트 도출

## 2. 한 줄 정의

- 이 agent 시스템은 `장기 상태를 가진 personal assistant가 여러 채널 입력을 받고, tool-calling loop로 작업을 수행하는 구조`다.

## 3. 문제 정의와 사용자 작업

- 해결하려는 문제:
  - 한 번 답하고 끝나는 챗봇이 아니라, 세션과 기억을 유지하면서 반복적으로 작업을 처리하는 personal assistant 운영
- 주요 사용자:
  - 개인 사용자
  - 여러 채널에서 동일한 assistant를 쓰려는 사용자
- 대표 작업 3개:
  - 대화형 질의응답
  - tool 기반 작업 자동화
  - 예약 작업 또는 background task 실행
- 기존 방식의 한계:
  - 단발성 대화 중심
  - 장기 상태, memory, cron, delegation이 약함
- 이 시스템이 agent 방식을 택한 이유:
  - tool use, memory, delegation, session continuity를 한 runtime 안에 결합하기 위해

## 4. 기능 기준 분석

### 핵심 기능

- 기능 1: 대화형 agent loop 실행
- 기능 2: tool registry 기반 도구 실행
- 기능 3: 세션/메모리 기반 상태 유지
- 기능 4: 선택적 subagent delegation

### 기능별 메모

| 기능 | 입력 | 내부 처리 | 도구/모델 사용 | 출력 | 메모 |
| --- | --- | --- | --- | --- | --- |
| 대화형 실행 | 사용자 메시지 | prompt 조립, 모델 호출 loop | LLM + tool schema | assistant 응답 | `run_agent.py` 중심 |
| 도구 실행 | 모델의 tool call | handler dispatch | `model_tools.py`, `tools/*.py` | tool result | 다시 messages에 주입 |
| 상태 유지 | 세션, memory | transcript 저장, memory recall | SQLite, memory manager | 지속 상태 | `hermes_state.py`, `memory_manager.py` |
| 하위 작업 위임 | 부모 agent 판단 | child agent 생성 | `delegate_task` | summary | 세부 중간 과정은 부모에 직접 안 돌아옴 |

## 5. 요구사항 해석

### 기능 요구사항

- 어떤 작업을 반드시 수행해야 하는가:
  - 여러 채널 또는 CLI에서 입력 처리
  - tool calling loop 수행
  - 세션 상태 저장
  - memory/context 구성
- 어떤 작업은 선택적인가:
  - subagent delegation
  - cron 자동화
  - 다양한 실행 환경 추상화

### 비기능 요구사항

- 응답 속도:
  - 긴 세션에서도 실행 가능해야 함
- 정확도:
  - tool 사용을 통한 추측 최소화 필요
- 비용:
  - 장기 실행 구조라 모델 호출 비용 관리 중요
- 안전성:
  - 위험 tool 사용 통제 필요
- 확장성:
  - tool registry, gateway, environment abstraction 필요
- 운영성:
  - 세션 저장, 동시성, 장시간 동작 고려 필요

## 6. 시스템 경계와 외부 의존성

- 사용자 접점:
  - `cli.py`
  - `gateway/run.py`
- 모델 API:
  - provider abstraction을 통해 호출
- 도구 실행 환경:
  - `tools/*.py`
  - local / Docker / SSH 등 환경 추상화 가능
- 메모리 또는 저장소:
  - `hermes_state.py`
  - `agent/memory_manager.py`
- 외부 서비스:
  - 모델 provider
  - 메시징 플랫폼
- 시스템 경계:
  - 입력 수집, agent 실행, tool 실행, 상태 저장은 Hermes 내부
  - 모델 provider와 외부 플랫폼은 외부 의존성

## 7. 런타임 흐름 분석

### 기본 흐름

1. 입력 수집:
   - CLI 또는 gateway에서 메시지 수집
2. 컨텍스트 구성:
   - 세션, memory, history, tool definitions 조립
3. 의도 해석 또는 라우팅:
   - gateway가 세션과 agent 생성 연결
4. 계획 수립:
   - 모델이 현재 문맥 기준 다음 행동 판단
5. 도구 선택:
   - 허용된 tool 목록 중 모델이 선택
6. 실행:
   - `handle_function_call()`로 handler 실행
7. 검증 또는 재시도:
   - tool result 반영 후 재호출
8. 결과 통합:
   - messages 누적 후 최종 응답 생성
9. 최종 응답:
   - CLI 출력 또는 platform 응답

### 실패 흐름

- 도구 실패 시:
  - failure result를 messages에 반영하고 다음 판단 수행 가능
- 모델 실패 시:
  - run 자체가 실패하거나 재시도 필요
- 권한 문제 시:
  - 사용 불가 tool 또는 environment 제한 발생 가능
- 사용자 승인 필요 시:
  - 관련 tool 정책 또는 human-in-the-loop로 멈출 수 있음

### 상태 변화 메모

- 어떤 상태가 언제 생성되는가:
  - 세션 생성 후 run loop 진행 중 tool result와 transcript가 누적됨
- 세션 상태와 장기 상태는 어떻게 나뉘는가:
  - 세션 transcript는 대화 흐름 중심
  - memory는 더 오래 유지할 가치가 있는 사실 중심

## 8. agent 설계

### 에이전트 유형

- 단일 에이전트 / 오케스트레이터 + 워커 / 멀티 에이전트:
  - 기본은 단일 중심 agent
  - 필요 시 child agent를 추가 생성하는 선택적 subagent 구조
- 역할 분리 기준:
  - `AIAgent`가 중심
  - `delegate_tool.py`가 child agent 생성

### Planning

- 계획 수립 방식:
  - 명시적 planner 분리보다 loop 중 모델 판단에 가까움
- planner와 executor 분리 여부:
  - 엄격하게 분리되어 있지 않음
- 장기 계획 / 단기 실행 분리 여부:
  - 부분적, prompt와 skill이 절차를 유도

### Memory

- 세션 메모리:
  - transcript/history 중심
- 장기 메모리:
  - 사용자 선호, 환경 정보 등
- 컨텍스트 축소 방식:
  - `ContextCompressor` 사용

### Tool Use

- 도구 등록 방식:
  - registry 기반
- 도구 선택 기준:
  - 코드가 후보 제한, 모델이 선택
- 호출 제약:
  - enabled/disabled toolset과 plugin 상태 반영
- 실패 처리:
  - tool result를 다음 문맥에 반영
- 검증 방식:
  - 추가 tool call과 후속 모델 판단 중심

### Reflection / Self-correction

- 재검토 단계:
  - 명시적 reflection보다 loop 재호출 방식
- 재시도 전략:
  - tool 결과를 보고 다른 행동 선택 가능
- 품질 보정 방식:
  - skill guidance, tool-use guidance, additional tool calls

### Human-in-the-loop

- 승인 단계:
  - 정책과 tool에 따라 개입 가능
- 위험 작업 제한:
  - toolset, child blocked tools 등으로 제한
- 사용자 개입 지점:
  - clarify나 approval 류 흐름에서 가능

## 9. 코드 구조와 근거

- 엔트리 포인트:
  - `cli.py`
  - `gateway/run.py`
- 메인 루프:
  - `run_agent.py`
- 프롬프트 위치:
  - `run_agent.py`
  - `agent/prompt_builder.py`
- 도구 레지스트리 위치:
  - `tools/registry.py`
- 상태 관리 위치:
  - `hermes_state.py`
  - `agent/memory_manager.py`
- 테스트 위치:
  - 별도 심층 확인 필요
- 확장 포인트:
  - `tools/*.py`
  - gateway/platforms
  - environments

## 10. 핵심 파일 메모

| 파일 또는 모듈 | 기능상 역할 | 흐름상 위치 | 설계상 중요 이유 | 메모 |
| --- | --- | --- | --- | --- |
| `run_agent.py` | 핵심 agent loop | 중심 | orchestration의 심장 | prompt, tool loop, 종료 판단 담당 |
| `model_tools.py` | tool orchestration | 중간 | 모델 출력과 실제 실행 연결 | tool schema, dispatch 처리 |
| `tools/delegate_tool.py` | child delegation | 선택 흐름 | subagent 구조 핵심 | parent-child 경계 형성 |
| `gateway/run.py` | gateway coordinator | 입력 계층 | 세션/플랫폼 연결 | runtime 진입점 역할 |
| `hermes_state.py` | 상태 저장 | persistence | session ownership과 transcript 보관 | SQLite 기반 |

## 11. 품질 속성과 trade-off

### 장점

- 장기 assistant 운영에 필요한 기능이 넓게 통합돼 있다.
- tool registry와 session 저장 구조가 확장에 유리하다.
- 선택적 delegation으로 큰 작업 분해 여지가 있다.

### 한계

- 핵심 로직이 `run_agent.py`에 많이 집중된다.
- 구조 표면적이 넓어서 학습 비용이 크다.
- MVP 관점에서는 과설계 위험이 있다.

### 기술적 리스크

- 복잡도 증가에 따른 유지보수 부담
- 위험 tool 사용 통제 필요
- memory, gateway, cron, delegation이 한 시스템에 엮여 있어 변경 영향 범위가 넓음

### 설계 trade-off

- 무엇을 얻었는가:
  - 확장 가능한 assistant platform 성격
- 무엇을 포기했는가:
  - 단순성과 작은 MVP 구조

## 12. 우리 프로젝트 적용성

### 바로 가져올 점

- 단일 중심 agent loop
- tool registry와 상태 저장 분리
- `UI/채널`과 `핵심 agent` 계층 분리

### 그대로 가져오면 과한 점

- self-improving skill system
- 광범위한 multi-platform 지원
- 복잡한 environment abstraction

### 변형해서 적용할 점

- subagent는 후순위로 두되 task tree 구조만 미리 준비
- memory는 장기 기능으로 미루고 run/task/step/event 상태 모델 우선
- runtime 상태를 UI에 실시간 노출하는 event-first 구조로 변형

## 13. 빠른 마무리 체크

- 문제 정의가 명확한가
  - 예
- 기능과 흐름이 연결되어 보이는가
  - 예
- planning, memory, tool use가 빠지지 않았는가
  - 예
- 코드 근거가 있는가
  - 예
- 우리 프로젝트 적용성까지 적었는가
  - 예

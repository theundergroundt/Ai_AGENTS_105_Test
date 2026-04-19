# 작업 로그

## 시간

2026-04-19 18:22

## 사용자 요청

- `runtime` 개념이 이해되지 않는다는 질문
- Hermes 기준으로 `runtime`을 설명해 달라는 요청
- 이어서 그 내용을 문서에 반영하고, 우리 Spring 구조로 옮긴 매핑표를 만들어 달라는 요청

## 답변/작업 요약

- Hermes를 `UI / 입력층`, `Gateway / Adapter 층`, `Runtime 층`의 3층 구조로 설명했다.
- `runtime`은 Hermes에서 실제 agent를 실행하는 코드 묶음이며, 핵심은 `run_agent.py` 중심 loop라는 점을 정리했다.
- 이 설명을 현재 개발 계획서에 반영했다.
- Hermes 구성 요소를 우리 Spring 구조의 `Controller`, `AgentOrchestrator`, `ToolExecutionService`, `RunStore`, `RuntimeStateProjector` 등에 대응시키는 매핑표를 추가했다.

## 변경 사항

- `analysis/projects/spring-agent-runtime-development-plan.md`
  - `Hermes 기준 runtime 경계` 섹션 추가
  - `Hermes 3층 구조를 우리 Spring 구조로 옮기면` 매핑표 추가
- `work_logs/2026-04-19/1822-runtime-경계-설명-및-spring-매핑표-추가.md`
  - 현재 작업 로그 신규 작성

## 관련 파일

- `Ai_AGENTS_105_Test/analysis/projects/spring-agent-runtime-development-plan.md`
- `Ai_AGENTS_105_Test/analysis/upstreams/hermes.md`

## 결정 또는 해석

- 우리 문서에서는 `runtime`을 모호한 표현으로 두지 않고, `실행 본체`라는 의미로 고정하는 것이 좋다.
- Spring 기준으로는 `Controller`가 아니라 `AgentOrchestrator`가 runtime 중심이라는 점을 초기에 명확히 해야 이후 요구사항/API 설계가 덜 꼬인다.

## 다음 단계

- 요구사항 명세서에서 `runtime`, `gateway`, `event projection` 용어를 같은 의미로 고정
- 이어서 API 명세서에서 `run 생성`, `run 상태 조회`, `run event stream`을 runtime contract로 정의

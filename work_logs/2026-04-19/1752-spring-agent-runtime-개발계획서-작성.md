# 작업 로그

## 시간

2026-04-19 17:52

## 사용자 요청

- `Hermes`는 분석만 하고 자체 개발할 예정이라는 전제에서 개발 계획서를 작성해 달라는 요청
- `Spring` 중심으로 구성하고 싶다는 방향 제시
- `Hermes`에서는 subagent 내부 작업이 충분히 보이지 않는다는 점을 고려해, 우리 프로젝트는 agent 작업을 실시간으로 시각화하고 사용자가 추적할 수 있어야 한다는 요구 반영 요청
- 이후 `요구사항 명세서`, `API 명세서`로 이어질 수 있게 사실 기반, 구현 가능성 기반으로 계획서를 작성해 달라는 요청

## 답변/작업 요약

- `Hermes` 분석 결과를 참고하되 복제하지 않는 방향으로 개발 계획서를 새로 작성했다.
- 핵심 방향을 `Spring 기반 단일 agent orchestrator + event stream + run/task/step 상태 모델`로 잡았다.
- 실시간 시각화 요구를 중심으로 `Session`, `Run`, `Task`, `Step`, `Runtime Event` 도메인 구조를 정리했다.
- 초기에는 `subagent`를 필수 구현 범위에서 제외하고, 이후 확장을 고려한 `task tree` 구조로 설계하는 방침을 문서에 반영했다.
- 이후 문서화 순서를 `요구사항 명세서 -> API 명세서`로 자연스럽게 이어질 수 있도록 섹션을 구성했다.

## 변경 사항

- `analysis/projects/spring-agent-runtime-development-plan.md`
  - 신규 작성
  - Hermes 기반 사실 요약
  - 프로젝트 차별점
  - Spring 중심 제안 아키텍처
  - 실시간 시각화 모델
  - 핵심 도메인 모델
  - MVP/확장 범위
  - 향후 명세 문서 기준
- `work_logs/2026-04-19/1752-spring-agent-runtime-개발계획서-작성.md`
  - 현재 작업 로그 신규 작성

## 관련 파일

- `Ai_AGENTS_105_Test/analysis/upstreams/hermes.md`
- `Ai_AGENTS_105_Test/analysis/projects/spring-agent-runtime-development-plan.md`

## 결정 또는 해석

- 우리 프로젝트의 핵심 차별점은 `agent 작업의 실시간 가시성`이다.
- 초기 구현의 중심은 `프롬프트`보다 `run/task/step/event 상태 모델`이 되어야 한다.
- `subagent`는 지금 당장 구현할 핵심 기능이 아니라, 추후 확장 포인트로 두는 것이 구현 난이도와 추적 가능성 측면에서 유리하다.

## 다음 단계

- 이 계획서를 기준으로 `요구사항 명세서` 초안 작성
- 이어서 `세션`, `run`, `event stream`, `approval` 중심 API 명세 초안 작성

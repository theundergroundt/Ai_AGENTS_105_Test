# 작업 로그

## 시간

2026-04-19 19:41

## 사용자 요청

- `C:/Users/sangjikim/e105/agentcoding/analysis/templates` 폴더를 `Ai_AGENTS_105_Test` 안으로 옮겨 달라는 요청
- `analysis` 안의 `hermes.md`를 기반으로 템플릿 형식에 맞춘 분석 파일을 만들어 달라는 요청

## 답변/작업 요약

- 루트 `analysis/templates` 폴더를 `Ai_AGENTS_105_Test/analysis/templates`로 이동했다.
- 기존 누적 분석본 `analysis/upstreams/hermes.md`를 기준으로, 템플릿 구조에 맞춘 별도 문서를 `analysis/projects/hermes-agent-project-analysis.md`로 새로 만들었다.
- 새 문서는 `agent-project-analysis-template.md`의 큰 구조를 따르되, Hermes의 누적 분석 내용을 템플릿 문맥에 맞게 재배치한 형태로 작성했다.

## 변경 사항

- `analysis/templates/`
  - 루트 저장소에서 `Ai_AGENTS_105_Test/analysis/templates/`로 이동
- `analysis/projects/hermes-agent-project-analysis.md`
  - 신규 작성
- `work_logs/2026-04-19/1941-templates-이동-및-hermes-템플릿-분석문서-추가.md`
  - 현재 작업 로그 신규 작성

## 관련 파일

- `Ai_AGENTS_105_Test/analysis/templates/agent-project-analysis-template.md`
- `Ai_AGENTS_105_Test/analysis/templates/system-design-analysis-guide.md`
- `Ai_AGENTS_105_Test/analysis/upstreams/hermes.md`
- `Ai_AGENTS_105_Test/analysis/projects/hermes-agent-project-analysis.md`

## 결정 또는 해석

- 템플릿 자체는 `analysis/templates` 아래 두고, 실제 템플릿 기반 결과물은 `analysis/projects`에 두는 구성이 가장 자연스럽다.
- `hermes.md`는 누적 분석본으로 유지하고, 템플릿 적합성은 별도 문서에서 맞추는 편이 추적성이 좋다.

## 다음 단계

- 필요하면 `openclaw.md`도 같은 방식으로 템플릿 기반 문서로 분리

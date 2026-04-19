# 작업 로그

## 시간

2026-04-19 15:00

## 사용자 요청

- `tool call`, `tool handler` 개념을 구분해서 설명해 달라는 요청
- 어떤 tool을 쓸지는 어떻게 정해지는지, skill이 많을 때 선택이 어떻게 되는지 설명하고 문서에도 반영해 달라는 요청

## 작업 요약

- `run_agent.py`, `model_tools.py`, `tools/registry.py`, `agent/prompt_builder.py`를 기준으로 tool 선택 구조와 skill 역할을 다시 확인했다.
- 질문/답변을 `analysis/requests/hermes/hermes-reading-qa.md`에 추가했다.
- 확정된 내용을 `analysis/upstreams/hermes.md`에 반영해 `tool call 구조 구분`과 `tool 선택 방식` 섹션을 추가했다.

## 변경 사항

- `analysis/requests/hermes/hermes-reading-qa.md`에 Q3 추가
- `analysis/upstreams/hermes.md`에 `1.4.1 tool call 구조 구분` 추가
- `analysis/upstreams/hermes.md`에 `1.5.2 어떤 tool을 쓸지는 어떻게 정해지나` 추가
- 오늘 날짜 작업 로그 추가

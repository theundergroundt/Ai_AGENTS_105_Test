# 작업 로그

## 시간

2026-04-19 17:24

## 사용자 요청

- 한 요청 안에서 왜 모델 호출이 여러 번 일어나는지 설명하고 반영해 달라는 요청
- 부모 agent 의사결정 tree를 정리해 달라는 요청

## 작업 요약

- `run_agent.py`의 tool loop와 tool result 재주입 구조를 다시 확인했다.
- 한 요청 안에서 모델이 여러 번 판단할 수 있는 이유를 `tool-calling loop` 관점으로 정리했다.
- `analysis/requests/hermes/hermes-reading-qa.md`에 Q6를 추가하고, `analysis/upstreams/hermes.md`에 loop와 decision tree 섹션을 반영했다.

## 변경 사항

- `analysis/requests/hermes/hermes-reading-qa.md`에 Q6 추가
- `analysis/upstreams/hermes.md`에 `1.5.10`, `1.5.11` 섹션 추가
- 오늘 날짜 작업 로그 추가

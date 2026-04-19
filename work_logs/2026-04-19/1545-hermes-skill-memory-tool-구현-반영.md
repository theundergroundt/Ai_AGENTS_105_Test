# 작업 로그

## 시간

2026-04-19 15:45

## 사용자 요청

- 방금 설명한 내용도 반영하라는 요청
- `skill`, `memory`, `tool`을 표로 정리해 달라는 요청
- skill 수정 방식과 시점, 그리고 `허용된 tool 목록 + prompt/skill/memory + 현재 문맥`이 실제로 어떻게 구현되는지 설명하고 반영해 달라는 요청

## 작업 요약

- `skill_manager_tool.py`, `skills_tool.py`, `prompt_builder.py`, `run_agent.py`, `model_tools.py`를 기준으로 skill 관리와 prompt 조립 구조를 다시 확인했다.
- `analysis/requests/hermes/hermes-reading-qa.md`에 Q4를 추가했다.
- `analysis/upstreams/hermes.md`에 `skill, memory, tool 차이`, `skill 수정`, `tool 선택 구현` 섹션을 추가했다.

## 변경 사항

- `analysis/requests/hermes/hermes-reading-qa.md`에 Q4 추가
- `analysis/upstreams/hermes.md`에 `1.5.3`, `1.5.4`, `1.5.5` 섹션 추가
- 오늘 날짜 작업 로그 추가

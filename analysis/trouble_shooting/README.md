# Trouble Shooting

문제 분석 기록은 아래 구조를 따른다.

- 카테고리 폴더: `analysis/trouble_shooting/<category>/`
- 날짜 폴더: `analysis/trouble_shooting/<category>/YYYY-MM-DD/`
- 파일명 예시: `HHMM-문제-요약.md`

기본 카테고리 예시:

- `git`
- `github-actions`
- `build`
- `runtime`
- `docs`

오류 분석이 끝나면 먼저 사용자에게 trouble shooting 기록 여부를 묻는다.
사용자가 `기록해줘`라고 하면 해당 카테고리에 Markdown 파일을 만들거나 기존 파일을 보완한다.

권장 템플릿:

```md
# Trouble Shooting

## 날짜

2026-04-19 12:41

## 내가 시도한 부분

- 무엇을 확인했는지
- 어떤 명령이나 설정을 대조했는지

## 실패 결과

- 어디서 실패했는지
- 오류 메시지 또는 관찰 결과

## 해결해야하는 부분

- 남아 있는 핵심 문제

## 해결 방법

- 다음 조치
- 수정 또는 확인 포인트

## 요약

- 한 줄 또는 몇 줄로 핵심 정리
```

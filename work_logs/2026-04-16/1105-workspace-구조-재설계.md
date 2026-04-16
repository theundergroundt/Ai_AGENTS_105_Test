# Workspace 구조 재설계

## 변경 내용

- 외부 저장소용 `forks` 폴더를 추가했다.
- 단어/개념 정리용 `knowledge` 폴더를 추가했다.
- 요청 메모와 누적 분석을 나누기 위해 `analysis/requests`, `analysis/upstreams`, `analysis/projects`를 추가했다.
- 자체 프로젝트용 `projects/hermes-like-agent` 폴더와 시작 문서를 추가했다.
- 루트 `README.md`, `AGENTS.md`를 새 구조 기준으로 다시 정리했다.

## 의도

- 외부 코드, 분석 메모, 개념 정리, 자체 프로젝트를 서로 다른 책임으로 분리한다.
- 이후 사용자가 질문한 내용이 어떤 성격인지에 따라 저장 위치를 바로 결정할 수 있게 한다.

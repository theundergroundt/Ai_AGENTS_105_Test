# Analysis Notes

이 폴더는 요청 기반 분석과 누적 분석을 저장하는 기본 공간이다.

## Subfolders

- `requests`
  사용자 요청 단위의 분석 메모를 둔다.
- `upstreams`
  Claw3D, OpenClaw, Hermes 같은 외부 소스별 누적 분석을 둔다.
- `projects`
  우리 프로젝트 관련 기술 메모와 구조 분석을 둔다.

## Writing Rule

- 성격이 다른 분석이 시작되면 새 `.md` 파일을 만든다.
- 같은 주제의 후속 설명이면 기존 파일을 갱신한다.
- 코드 checkout 자체는 여기 두지 않고 `../forks` 아래에 둔다.

## Legacy

- `analysis/claw3d`는 이전 방식으로 누적된 정리본이다.
- 새 작업의 기본 경로는 아니지만 필요하면 참고 자료로 사용한다.

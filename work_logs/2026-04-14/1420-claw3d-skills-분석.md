# 작업 로그

## 시간

2026-04-14 14:20

## 사용자 요청

- Claw3D의 skills 구조를 먼저 분석해 달라.
- 내용이 맞으면 이후 분석 문서로 정리하자.

## 작업 요약

- Claw3D 코드에서 skills 관련 UI, hook, library, packaged asset 흐름을 추적했다.
- skills는 크게 `패키지 정의`, `마켓플레이스 표시`, `설치/제거`, `에이전트별 접근 제어`, `오피스 트리거 연출`로 나뉘는 구조라는 점을 확인했다.
- packaged skill은 현재 `soundclaw`, `task-manager`, `todo-board` 세 가지가 기본 정의되어 있다.
- 설치는 단순 로컬 복사가 아니라, 임시 installer agent를 생성해서 workspace 안에 `skills/<skillKey>/...` 파일을 쓰게 하는 gateway 기반 흐름이다.
- 에이전트별 skill on/off는 실제 설치 여부와 별개로 allowlist 기반 접근 제어로 처리된다.
- office에서는 user 메시지와 `SKILL.md`의 Trigger JSON을 매칭해서 특정 장소로 이동시키는 skill-trigger 연출이 연결되어 있다.
- capability 측면에서는 `openclaw`, `hermes`는 skills를 지원하지만 `demo`, `custom`은 현재 skills capability가 없다.
- 아직 skills 분석 문서는 작성하지 않았고, 우선 사용자에게 분석 결과 설명 후 확인받는 단계로 유지한다.

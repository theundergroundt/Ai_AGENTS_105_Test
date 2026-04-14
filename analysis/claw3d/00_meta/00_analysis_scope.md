# Analysis Scope

## Purpose

분석 범위와 제외 범위를 정의한다.

## In Scope

- `claw3d_lab` 기준 현재 앱 구조 분석
- 실행 진입점과 주요 라우트 확인
- Studio 서버, WebSocket proxy, upstream gateway 경계 정리
- runtime provider seam과 상태 흐름 정리
- office 화면과 builder 화면의 책임 분리 확인

## Out of Scope

- OpenClaw 런타임 자체의 내부 구현 분석
- 최종 제품 설계 확정
- UI 리디자인 논의
- 세부 컴포넌트 단위 전체 문서화

## Notes

- 현재 1차 분석 목표는 "어디에 손대야 하는가"를 빠르게 파악하는 것이다.
- 기준 코드베이스는 `C:/Users/SSAFY/ssafy14/sj/agent_test/claw3d_lab`이다.

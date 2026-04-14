# System Overview

## Purpose

시스템 전체를 한 페이지에서 요약한다.

## Summary

- Claw3D는 OpenClaw 자체가 아니라, OpenClaw 계열 runtime 위에 올라가는 Studio/UI 레이어다.
- 기본 사용자 진입점은 `/office`이며, `/`와 `/agents`도 현재는 `/office`로 리다이렉트된다.
- 브라우저는 upstream gateway에 직접 붙지 않고, Studio 서버의 same-origin WebSocket proxy(`/api/gateway/ws`)를 통해 연결된다.
- 로컬 설정과 오피스 레이아웃은 Studio 쪽 로컬 파일 저장소에 보관된다.
- 실시간 agent 상태는 gateway event를 받아 클라이언트 store로 축적되고, 그 결과가 office, chat, panel UI로 파생된다.
- office는 하나의 단일 화면처럼 보이지만 실제로는 두 개의 렌더링 축이 있다.
- `/office` 메인 경험은 React + Three.js 기반 `RetroOffice3D` 쪽이 중심이다.
- `/office/builder`는 Phaser 기반 office map 편집 흐름을 사용한다.

## Core Model

- Browser UI
  - Next.js App Router 기반 화면
  - `/office` 화면에서 runtime 연결, agent store, office overlay를 조합
- Studio server
  - custom Node server가 Next 앱과 WebSocket proxy를 함께 띄움
  - 브라우저 대신 upstream gateway에 연결
- Upstream runtime
  - `openclaw`, `hermes`, `demo`, `custom` provider 중 하나
  - 실제 agent/session/config의 소스 오브 트루스
- Local persistence
  - Studio settings JSON
  - office-store JSON

## Why This Matters

- 이 프로젝트를 기반으로 무언가를 만들려면, 실행엔진을 바꾸기보다 `provider/gateway seam`을 잡는 쪽이 훨씬 자연스럽다.
- 즉 Claw3D를 "멀티 에이전트 운영 콘솔"로 보고, 별도 backend를 붙이는 관점이 맞다.

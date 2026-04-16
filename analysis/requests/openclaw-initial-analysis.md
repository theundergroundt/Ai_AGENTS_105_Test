# OpenClaw Initial Analysis

## One-Line Summary

- OpenClaw는 범용 멀티채널 assistant platform이지만, 핵심 구조는 `gateway control plane + session-first agent loop + isolated agent profiles`로 요약된다.

## Why It Matters For DeskMate

- DeskMate도 사용자는 "하나의 비서"를 보게 하고, 내부에서는 적절한 기능 agent로 라우팅하는 구조가 적합하다.
- OpenClaw에서 배워야 하는 건 채널 수가 아니라 상태 소유 구조와 실행 흐름이다.

## Best Reuse

- accepted 후 비동기 실행
- session 기준 상태 일관성
- 중앙 orchestrator가 상태를 소유
- background worker형 sub-agent 개념

## Best Rejection

- 채널 플랫폼 범용성
- 복잡한 gateway 생태계
- 초반부터 nested multi-agent

## DeskMate Translation

- `channel routing` 대신 `feature routing`
- `multi-channel delivery` 대신 `dashboard + iot delivery`
- `personal AI assistant` 포지셔닝은 유지

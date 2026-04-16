# DeskMate Minimal Runtime Summary

## Bottom Line

- DeskMate MVP는 복잡한 멀티 에이전트 플랫폼이 아니라, `assistant router + feature agents + dashboard + iot bridge` 구조로 시작하는 것이 맞다.

## Minimum Components

- web client
- api/orchestrator server
- assistant router
- scheduler agent
- wellness or code review agent
- state store
- websocket event stream
- iot bridge

## Reused Ideas

- OpenClaw의 state ownership
- session-first execution
- accepted -> progress -> result

## Removed Complexity

- multi-channel routing
- plugin platform
- nested sub-agents
- health integration in MVP

## Recommended MVP

- scheduler
- wellness
- dashboard
- esp32 led

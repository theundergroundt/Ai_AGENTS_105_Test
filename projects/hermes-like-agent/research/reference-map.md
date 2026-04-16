# Reference Map

## Main References

- Hermes
  운영 방식, memory/skills 철학, 장기 assistant 방향 참고
- OpenClaw
  runtime, session-first execution, gateway control plane 참고
- Claw3D
  시각화, gateway, studio 분리 방식 참고
- NemoClaw
  sandbox, onboarding, runtime hardening 비교 참고 대상

## What To Extract

- 아키텍처 패턴
- 역할 분리 방식
- 실행 흐름
- 우리가 그대로 가져오면 안 되는 부분

## Current Extraction Map

- OpenClaw
  - 가져올 것: 상태 소유, 세션 기반 실행, accepted -> progress -> result 흐름
  - 버릴 것: 채널 플랫폼 복잡도
- Hermes
  - 가져올 것: assistant 운영 철학, 확장 가능한 agent/tool 구조
  - 버릴 것: 초반 self-improving loop와 광범위한 플랫폼 지향
- NemoClaw
  - 가져올 것: sandbox와 정책 사고방식
  - 버릴 것: 초기 단계의 무거운 runtime hardening

# NemoClaw Analysis

## Status

- source checkout: `../../forks/nemoclaw`
- remote `origin`: `https://github.com/theundergroundt/NemoClaw_fork.git`
- current branch: `main`
- current HEAD: `56256a2`

## Bottom Line

- NemoClaw의 본질은 "새 assistant 제품"이 아니라 "OpenClaw를 OpenShell 위에서 더 안전하게 돌리기 위한 reference stack"이다.
- DeskMate가 여기서 직접 가져와야 하는 것은 agent UX가 아니라 `sandbox`, `policy`, `onboarding`, `host vs sandbox state separation` 같은 운영 안전성 개념이다.
- 따라서 NemoClaw는 MVP 기능 참고 대상이라기보다, 나중에 우리 agent를 더 안전하게 배포할 때 참고할 인프라 설계 참고서에 가깝다.

## Core Reading Basis

- `README.md`
- `package.json`
- `docs/reference/architecture.md`
- `docs/about/how-it-works.md`
- `src/nemoclaw.ts`
- `bin/lib/agent-runtime.js`
- `nemoclaw/src/`

## Observed Structure

- NemoClaw는 OpenShell 위에 얹는 얇은 CLI/plugin 계층과, 별도로 버전 관리되는 blueprint 개념을 중심으로 구성된다.
- 핵심 관심사는 assistant capability보다 `sandbox creation`, `policy application`, `inference routing`, `credential handling`, `reproducible onboarding`이다.
- `docs/reference/architecture.md` 기준으로 plugin은 작게 유지하고, 실제 orchestration은 blueprint가 담당한다.
- `how-it-works.md`는 `nemoclaw onboard -> plugin -> blueprint -> openshell CLI -> sandboxed OpenClaw` 흐름을 명확히 보여준다.
- 저장소 구조도 `blueprint`, `policies`, `security`, `sandbox`, `onboard`, `validation` 비중이 매우 크다.
- 즉 NemoClaw는 "agent가 무엇을 잘하나"보다 "agent를 어떻게 안전하게 감싸나"에 집중한다.

## NemoClaw Flow Summary

1. 운영자는 `nemoclaw onboard`로 설치와 설정을 시작한다.
2. plugin이 blueprint를 resolve / verify 한다.
3. blueprint가 OpenShell CLI를 호출해 sandbox, policy, inference route, gateway 리소스를 만든다.
4. sandbox 내부에서 OpenClaw가 실행되고, inference는 OpenShell gateway를 통해 우회된다.
5. 네트워크, 파일시스템, 프로세스, credential 접근이 정책 계층으로 제어된다.

## Product vs Runtime Interpretation

- OpenClaw와 Hermes는 사용자-facing assistant 정체성이 강하다.
- NemoClaw는 사용자-facing assistant라기보다 operator-facing runtime packaging에 가깝다.
- 그래서 DeskMate와 비교할 때는 제품 기능 경쟁이 아니라 "운영 안정성 maturity" 관점으로 봐야 한다.

## What To Reuse For DeskMate

- host state와 sandbox state를 분리해서 보는 사고방식
- onboarding에서 설정 검증을 먼저 수행하는 흐름
- inference provider를 직접 노출하지 않고 proxy/routing으로 통제하는 관점
- baseline policy를 두고 예외를 점진적으로 허용하는 방식
- 재현 가능한 배포를 위해 blueprint나 manifest 수준의 선언을 두는 아이디어

## What To Avoid For DeskMate

- MVP 초기에 OpenShell 수준의 복잡한 sandbox 운영을 붙이는 것
- 제품 차별화보다 runtime hardening을 먼저 완성하려는 것
- OpenClaw 전용 reference stack 구조를 그대로 답습하는 것
- 발표용 초기 데모에서 인프라 무게를 과하게 늘리는 것

## What To Build Ourselves

- DeskMate용 단순한 deployment baseline
- 로컬 개발과 데모 환경에서 쓸 수 있는 최소 환경 분리 규칙
- 장기적으로 sandbox/approval을 붙일 수 있는 운영 문서와 인터페이스
- 기능 개발과 운영 안전성 강화를 분리한 단계별 로드맵

## DeskMate Implications

- DeskMate의 1차 차별화는 NemoClaw처럼 "보안 reference stack"이 아니다.
- 대신 나중에 실제 외부 tool 실행이나 코드 작업 agent를 붙일 때, NemoClaw식 `격리`, `정책`, `검증된 onboarding`은 강한 참고가 된다.
- 발표에서는 NemoClaw를 기능 경쟁 상대로 두기보다, "우리는 제품 경험 중심이고, 운영 안전성은 2차 확장 단계에서 강화한다"는 설명이 맞다.

## 가져올 것 / 버릴 것 / 직접 만들 것

### 가져올 것

- Sandbox 사고방식
- Policy baseline 개념
- Onboarding 검증 흐름
- Host와 runtime 상태 분리

### 버릴 것

- OpenShell 중심의 무거운 초기 운영 구조
- Blueprint 기반 전체 lifecycle 재현
- MVP 단계의 과도한 hardening 우선순위

### 직접 만들 것

- DeskMate용 가벼운 runtime baseline
- 단계적 security roadmap
- 제품 기능 중심 orchestration

## Next

- DeskMate가 code review나 외부 툴 실행을 붙일 때 어떤 security boundary가 필요한지 별도 문서로 정리한다.
- NemoClaw는 제품 차별화보다 운영 안정성 참고 문서라는 위치로 비교 문서에 반영한다.

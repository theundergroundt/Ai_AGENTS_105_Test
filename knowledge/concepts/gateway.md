# Gateway

## One-Line Definition

- `gateway`는 외부 입력과 내부 실행 시스템 사이를 연결하고, 요청·상태·이벤트를 중간에서 관리하는 진입 계층이다.

## Why It Matters

- agent 시스템은 보통 입력이 한 군데서만 들어오지 않는다.
- 웹 요청, 메시지 채널, 디바이스 이벤트, 스케줄 작업 같은 여러 입력이 들어올 수 있다.
- gateway가 있으면 이 입력들을 한 기준으로 받아서 내부 실행 흐름을 정리할 수 있다.

## What A Gateway Usually Does

- 외부 입력을 받는다
- 어떤 사용자 또는 세션인지 식별한다
- 요청을 내부 형식으로 정리한다
- 적절한 agent 또는 orchestrator로 넘긴다
- 진행 상태와 결과를 다시 외부로 전달한다
- 필요하면 인증, 정책, 라우팅 규칙도 관리한다

## Easy Analogy

- gateway는 건물의 로비 데스크와 비슷하다.
- 누가 들어왔는지 확인하고, 어디로 안내할지 정하고, 상태를 관리한다.

## Gateway Is Not Just A Proxy

- 단순 proxy는 요청을 그대로 전달하는 데 가까울 수 있다.
- gateway는 그보다 더 많은 책임을 가진다.
- 특히 agent 시스템에서는 `session`, `state`, `routing`, `event delivery`까지 함께 다루는 경우가 많다.

## Gateway vs Orchestrator

- gateway는 "들어오는 입구와 연결 지점"에 더 가깝다.
- orchestrator는 "들어온 뒤 내부에서 어떤 흐름으로 처리할지"에 더 가깝다.
- 실제 시스템에서는 둘이 분리되기도 하고, 하나의 컴포넌트가 둘 다 맡기도 한다.

## Gateway vs Adapter

- adapter는 특정 외부 시스템 하나와 맞물리기 위한 연결 부품에 가깝다.
- 예를 들면 Telegram adapter, Slack adapter, IoT adapter 같은 식이다.
- gateway는 여러 adapter 위에서 전체 입력 흐름을 묶어 관리하는 상위 계층에 가깝다.

## OpenClaw Context

- OpenClaw에서 gateway는 매우 중요한 핵심 계층이다.
- README에서도 `Gateway is just the control plane — the product is the assistant`라고 설명한다.
- 즉 gateway는 제품 자체는 아니지만, 내부적으로는:
  - sessions
  - channels
  - tools
  - events
  - multi-agent routing
  를 소유하는 control plane 역할을 한다.
- 그래서 OpenClaw의 강점은 단순히 채널이 많은 것이 아니라, 그 채널들을 하나의 assistant 실행 흐름으로 묶는 gateway 구조에 있다.

## NemoClaw Context

- NemoClaw에서는 gateway가 더 인프라 쪽 의미를 가진다.
- OpenShell gateway가 credential 저장, inference proxying, policy enforcement 같은 역할을 맡는다.
- 즉 NemoClaw에서는 gateway가 사용자 경험보다는 runtime 통제와 안전성 쪽에서 중요하다.

## Why Gateway Matters For DeskMate

- DeskMate도 나중에는 입력이 여러 종류가 될 수 있다.
- 예를 들면:
  - 웹 대시보드 요청
  - 예약된 스케줄 이벤트
  - IoT 디바이스 상태 이벤트
  - 추후 모바일 또는 외부 서비스 입력
- 이때 gateway가 없으면 각 입력이 바로 agent로 흩어져 들어가서 구조가 복잡해진다.
- gateway를 두면 입력을 한곳에서 표준화하고, session/state를 붙인 뒤 orchestrator로 넘길 수 있다.

## What A Small DeskMate Gateway Could Look Like

- 웹 요청 수신
- 사용자 식별
- 요청 타입 정리
- session 또는 task id 부여
- assistant router로 전달
- 진행 상태를 dashboard와 IoT 이벤트로 전파

## What We Should Avoid

- OpenClaw 수준의 거대한 채널 gateway를 처음부터 만들 필요는 없다.
- 하지만 gateway 개념 자체를 빼버리면 나중에 입력 경로가 늘어날수록 시스템이 금방 지저분해진다.
- 따라서 DeskMate는 "작지만 명확한 gateway"를 가지는 편이 좋다.

## Short Summary

- `gateway`는 외부 입력을 내부 agent 흐름과 연결하는 입구이자 control plane이다.
- DeskMate에서는 거대한 플랫폼 gateway보다, 웹·스케줄·IoT 입력을 정리하는 작은 gateway가 중요하다.

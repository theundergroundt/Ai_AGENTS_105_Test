# Skills 구조 분석

## 목적

Claw3D에서 `skills`가 어떤 개념으로 동작하는지, 어디서 보이고 어디서 설치되며 어떤 계층으로 나뉘는지 정리한다.

## 한 줄 요약

Claw3D의 `skills`는 단순한 UI 토글이 아니라, 다음 요소가 함께 묶인 구조다.

- workspace에 설치되는 skill 파일
- gateway가 제공하는 skill 상태와 설치/제거 API
- agent별 skill 접근 제어
- office 안에서의 행동 트리거와 이동 연출

즉, `skills`는 "기능 목록"이 아니라 "runtime과 office를 연결하는 작업 단위"에 가깝다.

## 용어 미니 사전

이 문서를 읽을 때 자주 나오는 용어는 아래처럼 이해하면 된다.

### `runtime`

- 실제로 agent가 돌아가는 백엔드다.
- agent, session, chat, skill 상태 같은 "진짜 작업 데이터"를 가진 곳이다.
- 예: `openclaw`, `hermes`, `demo`, `custom`

한 줄로 말하면:

- 실제 실행 엔진

### `gateway`

- Claw3D가 runtime과 통신할 때 사용하는 연결 창구다.
- 브라우저나 Studio가 runtime 내부 구조를 직접 알지 않고, 정해진 RPC/이벤트 경로로 이야기하게 해준다.

한 줄로 말하면:

- runtime 앞단의 통신 인터페이스

### `studio`

- Claw3D 안의 서버/설정/프록시 레이어다.
- 브라우저와 gateway 사이를 중계하고, 로컬 설정도 저장한다.

한 줄로 말하면:

- Claw3D의 중간 관리자 레이어

### `office`

- 사용자가 보는 3D 사무실 화면이다.
- agent의 상태를 공간, 이동, 패널, 상호작용으로 보여준다.

한 줄로 말하면:

- 시각화 UI

### `marketplace`

- skill을 한곳에 모아서 보여주고 관리하는 UI 영역이다.
- 사용자는 여기서 어떤 skill이 있는지 보고, 설치하고, 설정 상태를 확인하고, agent에 연결할 수 있다.
- Claw3D 문맥에서는 앱스토어 같은 "스토어" 개념이라기보다, skill 관리 패널에 가깝다.

한 줄로 말하면:

- skill 목록 + 설치/설정 관리 화면

### 이 문서에서 왜 중요한가

skills는 이 4개와 모두 연결된다.

- runtime
  - skill 상태와 실행 가능 여부를 가진다
- gateway
  - `skills.status`, `skills.install`, `skills.update` 같은 통로가 된다
- studio
  - 브라우저와 gateway 사이를 중계한다
- office
  - skill trigger에 따라 agent를 desk, jukebox 같은 장소로 움직여 보여준다
- marketplace
  - skill을 설치하고 상태를 보고 agent에 연결하는 UI 진입점이다

## 자주 하는 오해: marketplace가 외부 skills 웹페이지인가

현재 Claw3D 기준으로는 아니다.

marketplace는 외부 웹페이지에서 skill 목록을 읽어오는 구조가 아니라, 아래 두 가지를 합쳐서 만드는 UI다.

- gateway가 현재 보고한 실제 skill 상태
- Claw3D가 로컬 코드에 미리 들고 있는 packaged skill 목록

관련 코드 흐름:

- `src/features/office/hooks/useOfficeSkillsMarketplace.ts`
  - `loadAgentSkillStatus(...)`로 gateway의 `skills.status` 결과를 읽는다
  - `appendPackagedSkillsToMarketplace(...)`로 packaged skill 목록을 합친다
- `src/lib/skills/catalog.ts`
  - Claw3D가 알고 있는 packaged skill 목록을 정의한다
- `src/lib/skills/marketplace.ts`
  - gateway 목록에 없는 packaged skill만 추가하는 합치기 로직이 있다

즉 현재 marketplace는 "외부 skill 저장소 웹페이지"가 아니라:

- runtime 상태
- 로컬 packaged 정의

를 합쳐서 보여주는 관리 화면이다.

참고:

- 어떤 skill에는 `homepage` 링크가 있을 수 있다
- 하지만 그건 외부 문서 링크일 뿐, skill 목록의 주 데이터 소스는 아니다

## 지금 marketplace에 skill이 몇 개 있나

이건 고정 숫자가 아니다.

현재 기준으로 Claw3D가 기본 packaged skill로 항상 알고 있는 것은 3개다.

- `todo-board`
- `task-manager`
- `soundclaw`

하지만 실제 marketplace 총 개수는 다음에 따라 달라진다.

- 현재 연결된 runtime이 `skills` capability를 지원하는가
- gateway가 `skills.status`로 몇 개의 skill을 보고하는가
- packaged skill이 이미 gateway skill 목록에 포함되어 있는가

쉽게 말하면:

- `demo`, `custom`처럼 skills capability가 없으면 marketplace 기능은 제한되거나 비활성화된다
- `openclaw`, `hermes`처럼 skills capability가 있으면
  - gateway가 보고한 실제 skill 목록
  - 아직 설치되지 않았더라도 Claw3D가 알고 있는 packaged skill 3개
  - 이 둘을 합쳐서 보여준다

즉 현재 marketplace에 보이는 skill 수는 "연결된 runtime 상태"에 따라 바뀐다.

개념적으로는:

- packaged 기본 후보 3개
- plus gateway가 보고한 skill들

이라고 생각하면 된다.

추가로 중요한 점:

- packaged skill과 gateway skill은 `skillKey` 기준으로 합쳐진다
- 같은 `skillKey`가 이미 gateway 목록에 있으면 packaged 항목을 또 중복 추가하지 않는다

즉 개념적으로 총 개수는 다음처럼 이해하면 된다.

- `총 개수 = gateway가 보고한 skill 수 + 아직 gateway에 없는 packaged skill 수`

실제 로딩 순서를 코드 관점에서 풀면 이렇다.

1. `useOfficeSkillsMarketplace`가 실행된다
2. 내부에서 `loadAgentSkillStatus(...)`가 gateway의 `skills.status`를 호출한다
3. gateway가 현재 skill 목록과 상태를 돌려준다
4. `appendPackagedSkillsToMarketplace(...)`가 packaged skill 3개를 확인한다
5. gateway 결과에 없는 `skillKey`만 marketplace 목록 뒤에 덧붙인다
6. 이 최종 결과가 panel UI에 전달된다

현재 코드 기준 packaged 기본 후보 수는 항상 `3개`다.

실제 화면 기준으로는:

- 연결이 없거나 gateway skill 상태를 못 읽으면 packaged 후보 3개 관점으로 이해할 수 있고
- 연결이 되면 gateway가 보고한 실제 skill 수에 따라 더 늘어날 수 있다

## 현재 Claw3D에서 skill을 실제로 쓰는 흐름

현재 Claw3D에서 skill은 대략 아래 흐름으로 사용된다.

### 1. marketplace에서 본다

- 사용자가 marketplace를 열면 skill 목록을 본다
- 이 목록은 packaged skill과 gateway의 실제 skill 상태를 합친 결과다

### 2. 필요하면 설치한다

- packaged skill이면 workspace 안으로 파일을 설치한다
- dependency 설치가 필요한 skill이면 guided install을 시도할 수 있다

### 3. system 레벨로 setup한다

- gateway 전체 기준 enable/disable
- env/config/dependency 상태를 확인한다

### 4. agent별로 허용한다

- 특정 agent가 해당 skill을 쓸 수 있도록 allowlist를 조정한다

### 5. 실제 대화와 office 연출에서 반응한다

- user message가 trigger phrase와 맞으면
- 해당 skill이 관련된 행동으로 해석되고
- office에서 desk, jukebox 같은 장소 이동 연출이 붙는다

즉 현재 Claw3D의 skill 흐름은 다음처럼 이해하면 된다.

- 보기
- 설치
- 설정
- agent 허용
- 대화/연출 반응

## `skills.status`는 어떤 데이터를 주나

Claw3D는 gateway에 `skills.status`를 호출해서 `SkillStatusReport`를 받는다.

큰 구조는 아래처럼 이해하면 된다.

```ts
type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};
```

즉 이 응답에는 단순히 "skill 목록"만 있는 것이 아니라:

- 현재 agent/workspace가 어디에 연결돼 있는지
- gateway managed skill 디렉터리가 어디인지
- 각 skill의 상태가 어떤지

가 같이 들어 있다.

개별 skill 항목은 대략 아래 정보를 가진다.

```ts
type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: { bins; anyBins; env; config; os; };
  missing: { bins; anyBins; env; config; os; };
  configChecks: { path; satisfied }[];
  install: SkillInstallOption[];
};
```

실무적으로 중요한 필드는 이 정도다.

- `skillKey`
  - skill의 고유 식별자
- `source`
  - bundled / managed / workspace 등 출처
- `disabled`
  - gateway 전체 기준 비활성화 여부
- `blockedByAllowlist`
  - 현재 정책상 차단되었는지
- `eligible`
  - 현재 조건에서 실제 사용 가능한지
- `missing`
  - 왜 바로 못 쓰는지의 원인
- `install`
  - guided install 가능한 옵션

즉 `skills.status`는 단순 카탈로그 응답이 아니라 "이 skill이 지금 여기서 실제로 쓸 수 있는가"를 판단하기 위한 상태 스냅샷이다.

## agent에 skill은 어떻게 매칭되나

Claw3D에서 agent와 skill 매칭은 "agent 객체에 skill이 직접 붙는 구조"라기보다, gateway config 안의 agent별 `skills` allowlist로 관리된다.

핵심은 아래 규칙이다.

- allowlist가 없으면: `all`
  - visible skill 전부 사용 가능
- allowlist가 빈 배열이면: `none`
  - 어떤 skill도 사용 불가
- allowlist에 값이 있으면: `selected`
  - 그 이름의 skill만 사용 가능

즉 매칭의 중심은:

- `agentId`
- gateway config의 `skills` 배열
- 현재 visible skill 목록

이 세 가지다.

## agent-skill 매칭 흐름

### 1. marketplace를 agent 기준으로 로드한다

`useOfficeSkillsMarketplace`는 선택된 `agentId`를 기준으로 아래 두 가지를 같이 읽는다.

- `loadAgentSkillStatus(client, agentId)`
- `readGatewayAgentSkillsAllowlist({ client, agentId })`

즉 skill 상태와 agent allowlist를 한 번에 가져온다.

### 2. visible skill 목록을 만든다

`skills.status`로 받은 `report.skills`가 현재 gateway/runtime 기준 visible skill 목록이 된다.

여기에 packaged skill이 marketplace용으로 추가될 수 있지만, agent access 제어 자체는 결국 이 visible skill 이름 목록을 기반으로 동작한다.

### 3. 토글 시 agent allowlist를 갱신한다

사용자가 agent skill panel에서 skill을 켜거나 끄면 `setAgentSkillEnabled(...)`가 실행된다.

이 함수는:

1. 현재 visible skill 이름들을 모은다
2. 기존 allowlist를 읽는다
3. 없으면 visible skill 전체를 baseline으로 본다
4. 켜기면 skill 이름을 추가하고, 끄기면 제거한다
5. `config.set`을 통해 gateway config의 agent `skills` 배열을 저장한다

즉 실제 매칭은 "skill 이름을 agent allowlist에 넣느냐 빼느냐"다.

### 4. office trigger도 agent allowlist를 본다

`useOfficeSkillTriggers`는 각 agent마다:

- `skills.status`
- `readGatewayAgentSkillsAllowlist`

를 다시 읽는다.

그리고 아래 조건을 모두 만족하는 skill만 trigger 후보로 인정한다.

- readiness가 `ready`
- 현재 agent allowlist에서 허용됨
- packaged trigger 정의가 존재함

그 다음 최근 user message와 transcript를 보고 trigger가 맞으면, desk나 jukebox 같은 office movement로 연결한다.

즉 agent에 skill이 "붙는다"는 말은 실제로는:

- config allowlist에서 허용되고
- 현재 runtime 조건상 ready이며
- 필요하면 trigger 정의도 존재하는 상태

를 의미한다.

## 현재 기본 제공되는 packaged skill

현재 코드 기준 기본 packaged skill은 3개다.

- `todo-board`
- `task-manager`
- `soundclaw`

정의 위치:

- `src/lib/skills/catalog.ts`
- `src/lib/skills/packaged.ts`
- `assets/skills/*/SKILL.md`

이 packaged skill들은 마켓플레이스에서 보이도록 미리 정의되어 있고, 실제 설치 시 선택한 workspace 안으로 파일이 들어간다.

## 먼저 구분해야 하는 개념

`skills`를 이해할 때는 아래 두 개념을 분리해서 봐야 한다.

### 일반적인 skill

일반적인 의미의 skill은 "에이전트가 할 수 있는 능력"이다.

예시:

- TODO 관리
- 작업 추적
- 음악 재생
- 문서 검색

즉 skill은 개념적으로는 그냥 기능 단위다.

### Claw3D의 packaged skill

Claw3D의 packaged skill은 위 기능을 바로 설치하고 표시하고 제어할 수 있도록 포장한 형태다.

즉 packaged skill에는 보통 아래가 함께 들어 있다.

- skill 설명
- metadata
- trigger 규칙
- 예제 파일
- 설치 대상 파일
- marketplace 표시 정보

한 줄로 정리하면:

- `skill` = 기능 개념
- `packaged skill` = Claw3D에서 설치/표시/제어 가능한 형태로 포장된 skill

## packaged skill 3개의 역할

### `todo-board`

- 간단한 TODO 리스트를 관리하는 skill이다.
- 작업 추가, 읽기, blocked 처리, unblock, 삭제 같은 흐름을 다룬다.
- workspace 안 `todo-skill/todo-list.json` 파일을 source of truth로 사용한다.
- office 연출상으로는 agent가 desk로 가서 처리하는 흐름과 연결된다.

### `task-manager`

- 더 본격적인 작업 관리 skill이다.
- 사용자의 "이 일 해줘" 같은 요청을 task로 만들고 상태를 추적한다.
- `todo`, `in_progress`, `blocked`, `review`, `done` 같은 상태 전환을 다룬다.
- Claw3D 내부의 task board / Kanban 흐름과 연결되는 성격이 강하다.

### `soundclaw`

- Spotify 중심 음악 제어 skill이다.
- 음악 검색, 재생, 링크 전달, 플레이어 상태 확인 등을 담당한다.
- office 연출상으로는 agent가 `jukebox`로 이동하는 흐름과 연결된다.

## 내 프로젝트에도 packaged skill 방식이 꼭 필요한가

반드시 그렇지는 않다.

초기 프로젝트에서는 packaged skill 구조 전체를 그대로 따라갈 필요는 없다.

### 초기 버전에서 먼저 필요한 것

초기에는 아래 3개만 있어도 충분하다.

- skill registry
- 요청을 어떤 skill로 보낼지 결정하는 trigger/router
- agent별 skill capability 또는 허용 목록

즉 MVP 관점에서는 다음 정도면 충분하다.

- 어떤 skill이 있는가
- 어떤 agent가 그 skill을 쓸 수 있는가
- 어떤 사용자 요청이 어떤 skill로 매핑되는가

### packaged skill 구조가 필요한 시점

다음이 필요해지면 packaged skill 구조가 유리하다.

- skill 설치/제거를 UI에서 다루고 싶다
- skill을 marketplace처럼 보여주고 싶다
- workspace 안에 skill 자산을 실제로 배포하고 싶다
- agent별 허용 여부와 system 설치 여부를 분리해서 다루고 싶다
- office 행동 연출까지 묶고 싶다

즉 처음부터 packaged skill 구조가 필수는 아니고, 운영형 플랫폼으로 갈수록 필요해진다.

## 우리 프로젝트 기준 권장 시작점

현재 시점에서 우리 프로젝트는 packaged skill 전체 구조보다 아래 방식으로 시작하는 것이 더 적절하다.

### 추천 시작 방식

- `skill registry`
  - skill id
  - 이름
  - 설명
  - 처리 가능한 요청 종류
- `trigger/router`
  - 사용자 요청을 보고 어떤 skill로 보낼지 결정
- `agent capability`
  - 어떤 agent가 어떤 skill을 사용할 수 있는지 관리

즉 시작점은:

- 설치형 skill 패키지 시스템
- 복잡한 marketplace
- workspace 파일 배포

까지 전부 만드는 것이 아니라,

- skill 개념
- routing
- capability 관리

만 먼저 구현하는 것이 좋다.

## 비교표

| 구분 | 일반 skill | Claw3D의 packaged skill | 우리 프로젝트 초기 추천 |
|---|---|---|---|
| 의미 | 에이전트의 능력/역할 | 설치 가능하게 포장된 skill | capability + trigger 중심 |
| 형태 | 개념적 기능 | 파일 + metadata + trigger + 설치 흐름 | 메타데이터 + 라우팅 규칙 |
| 설치 개념 | 없어도 됨 | workspace에 실제 파일 설치 | 처음엔 없어도 됨 |
| UI 연결 | 필수 아님 | marketplace/UI에 노출됨 | 나중에 붙여도 됨 |
| agent별 제어 | 선택 사항 | allowlist로 제어 | 있으면 좋음 |
| office 연출 | 보통 없음 | 장소 이동 trigger와 연결 | 필요 시 일부만 도입 |
| 구현 난이도 | 낮음 | 높음 | 낮음~중간 |

## skills를 이해할 때 먼저 알아야 할 핵심 구분

### 1. 설치와 사용 허용은 다르다

Claw3D에서 skill이 "설치되어 있다"와 "이 agent가 쓸 수 있다"는 서로 다른 단계다.

- 설치
  - skill 파일이 gateway/workspace 쪽에 실제로 존재하는 상태
- 사용 허용
  - 특정 agent가 그 skill을 allowlist로 사용할 수 있는 상태

따라서 어떤 skill이 보여도:

- 아직 설치가 안 됐을 수 있고
- 설치는 됐지만 이 agent에게는 비활성화돼 있을 수 있다

### 2. system 레벨과 agent 레벨이 분리되어 있다

대략 다음처럼 나뉜다.

- System Skills
  - gateway 전체 기준 skill setup
  - 설치, 전역 enable/disable, dependency/setup 성격
- Agent Skills
  - 특정 agent가 어떤 skill을 사용할지 제어
  - allowlist 기반 접근 제어

즉, skill은 "시스템에 존재하는가"와 "이 agent에게 허용되는가"를 따로 관리한다.

## 전체 구조

현재 skills 구조는 크게 5개 계층으로 볼 수 있다.

### 1. Skill 자산 계층

skill의 기본 설명과 trigger 규약은 `SKILL.md`에 들어 있다.

예시 위치:

- `assets/skills/todo-board/SKILL.md`
- `assets/skills/task-manager/SKILL.md`
- `assets/skills/soundclaw/SKILL.md`

여기에는 다음 정보가 담긴다.

- skill 이름
- 설명
- OpenClaw metadata
- Trigger JSON
- storage/workflow 규칙
- backend skill contract

즉 `SKILL.md`는 단순 README가 아니라, skill의 실행 규약 문서 역할까지 한다.

### 2. Packaged skill 정의 계층

`src/lib/skills/catalog.ts`와 `src/lib/skills/packaged.ts`는 packaged skill을 코드에서 읽기 좋은 형태로 정의한다.

역할:

- packaged skill 목록 제공
- skill key와 package id 매핑
- 마켓플레이스에서 기본 entry로 표시
- 설치 시 실제로 써야 할 파일 내용 제공

정리하면:

- `assets/skills`는 원본 자산
- `src/lib/skills/packaged.ts`는 그 자산을 코드에서 사용할 수 있게 만든 패키지 레이어

### 3. Marketplace/UI 계층

office 쪽 마켓플레이스는 다음이 중심이다.

- `src/features/office/hooks/useOfficeSkillsMarketplace.ts`
- `src/features/office/components/panels/SkillsMarketplacePanel.tsx`
- `src/lib/skills/marketplace.ts`

agent 설정 UI는 다음 파일이 중심이다.

- `src/features/agents/components/SystemSkillsPanel.tsx`
- `src/features/agents/components/AgentSkillsPanel.tsx`

이 UI는 다음 정보를 합쳐서 보여준다.

- gateway가 보고한 실제 skill status
- packaged skill 카탈로그
- skill readiness 상태
- agent allowlist 상태

즉 화면에서 보이는 "skill 목록"은 단순 서버 응답이 아니라, packaged entry와 runtime 상태를 합친 결과다.

### 4. 설치/제거 실행 계층

설치 흐름의 핵심은 `src/lib/skills/install-gateway.ts`다.

이 코드는 단순히 프런트에서 파일을 쓰지 않는다. 대신:

1. 임시 installer agent를 만든다
2. 그 agent에게 `chat.send`로 "이 파일들을 workspace 안에 정확히 써라"는 메시지를 보낸다
3. agent가 workspace 안 `skills/<skillKey>/...` 경로에 파일을 만든다
4. 완료 후 임시 agent를 정리한다

즉 packaged skill 설치는 사실상 "임시 agent를 이용한 gateway-native 파일 배치"다.

제거는 다음 계층을 통해 처리된다.

- `src/lib/skills/remove.ts`
- `src/lib/skills/remove-gateway.ts`

이 말은 곧, skill은 브라우저 로컬 기능이 아니라 gateway/workspace 자산이라는 뜻이다.

### 5. Agent 접근 제어 계층

특정 agent가 어떤 skill을 쓸 수 있는지는 `src/lib/skills/agentAccess.ts`에서 조절한다.

핵심은 allowlist다.

- skill을 설치했다고 해서 모든 agent가 자동으로 쓰는 것은 아니다
- 각 agent는 자신만의 visible skill set / allowlist를 가진다
- on/off 토글은 결국 gateway agent config를 바꾸는 흐름이다

여기서 중요한 점은:

- skill 설치는 파일/환경 문제
- agent enable/disable은 권한/설정 문제

둘은 다른 축이다.

### 6. Office 연출 계층

Claw3D는 skill을 단순 실행 capability로만 쓰지 않는다. office 공간 연출에도 연결한다.

관련 파일:

- `src/lib/skills/triggers.ts`
- `src/features/office/hooks/useOfficeSkillTriggers.ts`

동작 방식:

1. `SKILL.md` 안의 `## Trigger` 섹션에서 JSON을 읽는다
2. activation phrase와 movement target을 추출한다
3. agent의 최근 user message / transcript를 보고 어떤 skill이 트리거됐는지 판단한다
4. skill이 트리거되면 office에서 그 agent를 desk, jukebox 같은 특정 공간으로 보내는 연출에 활용한다

즉 skill은 "무슨 일을 하는가"뿐 아니라 "office 안에서 어디로 움직여야 하는가"까지 포함한다.

## Skill 상태는 어떻게 판단하는가

기본 타입과 판단 로직은 아래 파일들에 있다.

- `src/lib/skills/types.ts`
- `src/lib/skills/presentation.ts`

주요 상태 개념:

- `ready`
- `needs-setup`
- `unavailable`
- `disabled-globally`

판단 기준에는 다음이 들어간다.

- missing binary
- env/config 부족
- OS 호환성
- blocked by allowlist
- globally disabled 여부

즉 skill은 단순 존재 여부가 아니라 "현재 runtime에서 실제 사용 가능한가"를 별도로 계산한다.

## Runtime capability와 skills

skills UI는 모든 runtime에서 항상 켜지지 않는다.

`src/lib/runtime/*/provider.ts` 기준 capability 차이는 대략 이렇다.

- `openclaw`
  - `skills` 지원
- `hermes`
  - `skills` 지원
- `demo`
  - `skills` 미지원
- `custom`
  - 현재 `skills` 미지원

office 화면에서도 `supportsCapability("skills")`를 기준으로 skills 관련 hook/UI가 켜진다.

즉 새 backend를 붙일 때 `custom` provider만 그대로 쓰면 현재 skills UX는 자동으로 살아나지 않는다.

## 현재 구조를 우리 관점에서 해석하면

우리처럼 "AI 비서형 멀티 에이전트 서비스"를 만들려는 입장에서 이 구조는 이렇게 읽어야 한다.

### 좋은 점

- skill을 문서/자산/설치/권한/연출까지 한 묶음으로 다룰 수 있다
- workspace 기반 설치라 agent별 작업 맥락과 잘 맞는다
- office 공간 연출과 skill trigger가 연결돼 있어서 시각화가 자연스럽다

### 제약

- 현재 구조는 OpenClaw/Hermes 계열 gateway 기능에 꽤 의존한다
- `custom` provider는 skills를 아직 1급 기능으로 노출하지 않는다
- packaged install도 gateway/agent/file 도구 흐름에 묶여 있다

### 의미

우리가 나중에 skills를 제대로 살리려면 보통 둘 중 하나다.

- OpenClaw 호환 gateway를 만든다
- `custom` provider와 skills UX를 확장해서 우리 backend 계약에 맞춘다

## 핵심 파일 맵

### skill 자산

- `assets/skills/soundclaw/SKILL.md`
- `assets/skills/task-manager/SKILL.md`
- `assets/skills/todo-board/SKILL.md`

### packaged 정의

- `src/lib/skills/catalog.ts`
- `src/lib/skills/packaged.ts`

### 상태/표현

- `src/lib/skills/types.ts`
- `src/lib/skills/presentation.ts`
- `src/lib/skills/marketplace.ts`

### 설치/제거

- `src/lib/skills/install-gateway.ts`
- `src/lib/skills/remove.ts`
- `src/lib/skills/remove-gateway.ts`

### agent 접근 제어

- `src/lib/skills/agentAccess.ts`
- `src/lib/gateway/agentConfig.ts`

### office 연출

- `src/lib/skills/triggers.ts`
- `src/features/office/hooks/useOfficeSkillTriggers.ts`

### UI

- `src/features/office/components/panels/SkillsMarketplacePanel.tsx`
- `src/features/office/hooks/useOfficeSkillsMarketplace.ts`
- `src/features/agents/components/SystemSkillsPanel.tsx`
- `src/features/agents/components/AgentSkillsPanel.tsx`

## 현재 결론

현재 Claw3D의 `skills`는 다음처럼 이해하는 게 가장 맞다.

- skill 문서 자산
- skill 설치 자산
- gateway 상태와 setup 로직
- agent별 권한 제어
- office 행동 트리거

즉 "AI 기능 하나 추가" 수준이 아니라, runtime과 office를 함께 묶는 운영 단위다.

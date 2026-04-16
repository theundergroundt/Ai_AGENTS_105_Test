# Blueprint

## One-Line Definition

- `blueprint`는 실행 환경을 어떤 구성과 정책으로 만들지 적어둔 설계도다.

## Why It Matters

- agent runtime은 단순히 코드만 실행하면 끝나지 않는다.
- 어떤 이미지로 띄울지, 어떤 정책을 쓸지, 어떤 provider를 연결할지, 어떤 상태를 보존할지까지 같이 정해야 한다.
- blueprint는 이 구성을 문서화하고 재현 가능하게 만든다.

## What A Blueprint Usually Describes

- 어떤 runtime 또는 container image를 쓸지
- 어떤 sandbox 정책을 적용할지
- 어떤 네트워크 접근을 허용할지
- 어떤 inference provider route를 붙일지
- 어떤 상태나 설정 파일을 어디에 둘지

## Easy Analogy

- blueprint는 집 자체가 아니라 "이 집을 어떤 구조와 규칙으로 지을지 적어둔 설계도"에 가깝다.
- sandbox가 실제 집이라면, blueprint는 그 집의 도면이다.

## In NemoClaw

- NemoClaw는 plugin과 blueprint를 나눠서 쓴다.
- plugin은 사용자 명령을 받고 orchestration을 시작하는 얇은 계층이다.
- blueprint는 실제로 sandbox, policy, inference route 같은 자원을 어떻게 만들지 정의한다.
- 그래서 같은 구성을 반복해서 재현하거나 업데이트할 때 기준점 역할을 한다.

## Why This Split Is Useful

- plugin은 작고 안정적으로 유지할 수 있다.
- blueprint는 배포와 운영 로직만 별도로 진화시킬 수 있다.
- 결과적으로 setup을 다시 해도 같은 구조를 반복 재현하기 쉬워진다.

## When We Might Need It In DeskMate

- domain agent마다 다른 실행 정책을 가져야 할 때
- 데모 환경과 실제 운영 환경을 분리해서 관리해야 할 때
- 설치형 agent service를 "설정 가능한 패키지"처럼 다루고 싶을 때

## Short Summary

- `blueprint`는 sandbox와 runtime을 어떤 규칙으로 만들지 정한 설계도다.
- 실행 공간 자체가 아니라, 그 실행 공간을 재현 가능하게 만드는 구성 문서다.

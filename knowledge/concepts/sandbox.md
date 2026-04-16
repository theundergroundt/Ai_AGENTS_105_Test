# Sandbox

## One-Line Definition

- `sandbox`는 프로그램을 제한된 권한 안에서만 실행하게 하는 격리된 실행 공간이다.

## Why It Matters

- agent는 파일 읽기, 파일 수정, 네트워크 호출, 명령 실행까지 할 수 있다.
- 이런 권한이 무제한이면 실수나 악성 입력이 바로 시스템 전체로 퍼질 수 있다.
- sandbox는 이 범위를 줄여서 "문제가 생겨도 피해가 제한된 공간 안에 머무르게" 만든다.

## What Usually Gets Restricted

- 파일 접근 범위
  - 예: `/sandbox` 폴더만 쓰기 허용
- 네트워크 접근 범위
  - 예: 허용된 API 주소만 접속 허용
- 시스템 권한
  - 예: 위험한 syscall이나 privilege escalation 차단
- 실행 가능한 명령
  - 예: 특정 명령만 허용하고 나머지는 막음

## Easy Analogy

- sandbox는 "아이를 놀이터 안에서만 놀게 하는 울타리"와 비슷하다.
- 놀 수는 있지만, 아무 데나 뛰어다니게 두지는 않는다.

## In Agent Systems

- agent가 코드를 실행하거나 외부 도구를 쓸 때 sandbox가 중요해진다.
- 특히 code review agent, coding agent, browser agent 같은 기능은 sandbox 없이 돌리면 위험이 커진다.

## NemoClaw Context

- NemoClaw에서는 OpenClaw를 그냥 호스트에서 실행하는 대신, OpenShell이 만든 sandbox 안에서 실행한다.
- 이 sandbox는 네트워크, 파일시스템, 프로세스 권한을 정책으로 제한한다.
- 그래서 agent가 inference를 직접 외부로 호출하지 않고, 통제된 경로로만 나가게 만들 수 있다.

## When We Might Need It In DeskMate

- 외부 코드를 받아 실행하는 기능이 생길 때
- 파일 수정이나 터미널 실행 권한이 커질 때
- 사용자가 설치한 domain agent가 서로 다른 권한을 가져야 할 때

## Short Summary

- `sandbox`는 agent를 안전하게 가둬서 실행하는 공간이다.
- 기능보다 안전성과 통제를 위한 개념이다.

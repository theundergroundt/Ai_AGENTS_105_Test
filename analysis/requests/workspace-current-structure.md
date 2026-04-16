# Current Workspace Structure

## Root

현재 작업 기준 루트는 `Ai_AGENTS_105_Test` 하나다.

## Main Folders

- `analysis`
  분석 결과를 저장하는 문서 허브다.
- `forks`
  외부 오픈소스 checkout 위치다.
- `knowledge`
  단어, 용어, 개념 설명을 누적하는 공간이다.
- `projects`
  자체 개발 프로젝트 작업 공간이다.
- `work_logs`
  작업 이력을 날짜별로 남기는 공간이다.

## Analysis Folder

- `analysis/requests`
  요청 단위 메모를 둔다.
- `analysis/upstreams`
  Claw3D, OpenClaw, Hermes 같은 외부 소스별 누적 분석을 둔다.
- `analysis/projects`
  우리 프로젝트에 직접 연결되는 분석 문서를 둔다.
- `analysis/claw3d`
  이전 방식으로 쌓인 Claw3D 레거시 정리본이다.

## Forks Folder

- `forks/claw3d`
  Claw3D fork checkout
- `forks/openclaw`
  OpenClaw fork checkout
- `forks/hermes`
  Hermes fork checkout

## Knowledge Folder

- `knowledge/glossary.md`
  짧은 용어 설명 모음
- `knowledge/concepts`
  긴 개념 설명 문서

## Projects Folder

- `projects/hermes-like-agent`
  자체 개발 AI agent 프로젝트 시작 폴더

## Current Rule

- 코드 checkout은 `forks`
- 분석 문서는 `analysis`
- 개념 설명은 `knowledge`
- 프로젝트 문서는 `projects`

이 원칙을 기본값으로 유지한다.

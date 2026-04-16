# Glossary

## upstream

- 한 줄 정의: 내가 작업하는 저장소가 따라가는 원래 기준 저장소 또는 그 원격을 뜻한다.
- Git 맥락: 내 fork가 있을 때 원본 저장소를 `upstream` remote로 추가해 두는 경우가 많다.
- 왜 중요하나: 원본 저장소의 최신 변경을 내 fork나 로컬 작업본으로 가져올 때 기준이 된다.
- 예시:
  내가 `myname/Claw3D`를 fork했고 원본이 `iamlukethedev/Claw3D`라면,
  보통 내 fork는 `origin`, 원본은 `upstream`으로 둔다.

## fork

- 원본 저장소를 내 계정으로 복제한 별도 저장소다.
- 보통 원본 변경을 따라가면서 내 변경을 쌓기 위해 쓴다.

## origin

- 내가 직접 clone한 원격 저장소를 가리키는 기본 이름이다.
- fork 기반 작업에서는 대체로 내 fork가 `origin`이 된다.

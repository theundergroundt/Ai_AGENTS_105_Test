# Claw3D Folder Structure Note

## Why It Was Split

- `claw3d_ref`: upstream 기준 원본 보관용이다. `origin`이 공개 Claw3D 저장소를 가리킨다.
- `claw3d_lab`: fork와 upstream을 함께 물고 있는 실험용 작업본이다.
- `claw3d_test`: 실제 로컬 실행과 수정 흔적이 있는 작업본이다. 현재 `node_modules`, `.next`, 서버 로그, 로컬 변경 파일이 있다.
- `claw3d_analysis`: 앱 코드를 건드리지 않고 분석 문서를 따로 쌓기 위한 별도 문서 폴더다.
- `Ai_AGENTS_105_Test/analysis/claw3d`: private 문서 저장소 안에 같은 성격의 분석 트리를 다시 만든 것이다.

## Current Cleanup State

- `claw3d_ref`, `claw3d_lab`는 삭제했다.
- `claw3d_test`는 로컬 수정 흔적을 기록한 뒤 삭제 대상으로 본다.
- Claw3D 기준 checkout은 `Ai_AGENTS_105_Test/forks/claw3d`로 확정한다.

## Why It Feels Too Complex

- 실행 대상이 되는 앱 복사본이 셋이다.
- 분석 문서 기준 위치도 `claw3d_analysis`와 `Ai_AGENTS_105_Test/analysis/claw3d` 두 군데다.
- 세 앱 폴더는 현재 같은 커밋 `e59dcbe`를 기준으로 하고 있어서 이름만 보고 역할을 구분하기 어렵다.

## Simpler Rule Going Forward

- Claw3D 분석 메모의 기본 위치는 `Ai_AGENTS_105_Test/analysis` 바로 아래로 잡는다.
- 새 주제가 생기면 `claw3d-skills.md`, `claw3d-gateway-flow.md` 같은 새 파일을 추가한다.
- 하위 폴더는 문서 수가 많아져서 평면 구조가 불편해질 때만 만든다.
- 기존 `analysis/claw3d`와 `claw3d_analysis`는 레거시 정리본으로 보고, 새 문서의 기본 위치로는 쓰지 않는다.

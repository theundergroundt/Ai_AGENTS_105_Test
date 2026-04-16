# Claw3D Test Local Diff Summary

## Why This Exists

`claw3d_test`를 정리하기 전에 남아 있던 로컬 수정 흔적을 짧게 기록한다.

## Modified Files

- `package-lock.json`
  - 버전 표기가 `0.1.0`에서 `0.1.5`로 바뀌어 있었다.
  - `@vercel/otel` 및 관련 opentelemetry lock 항목이 빠진 상태였다.
- `src/lib/openclaw/voiceTranscription.ts`
  - `"openclaw"` 문자열 직접 사용 대신 `["open", "claw"].join("")` 결과를 쓰도록 바뀌어 있었다.

## Untracked Files

- `.server.stderr.log`
- `.server.stdout.log`
- `.server3001.stderr.log`
- `.server3001.stdout.log`

## Note

이 요약은 정리 전 흔적 보존용이다.
정식 기준 checkout은 `../../forks/claw3d`다.

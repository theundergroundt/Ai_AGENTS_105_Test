# Trouble Shooting

## 날짜

2026-04-19 12:41

## 내가 시도한 부분

- GitHub Actions 실행 메타데이터에서 실패 단계와 단계별 소요 시간을 확인했다.
- `forks/openclaw_fork/.github/workflows/docs-sync-publish.yml`의 `Clone publish repo`, `Sync docs into publish repo`, `Commit publish repo sync` 단계를 읽고 실패 가능 지점을 분리했다.
- `openclaw/docs` 저장소가 공개 저장소인지 API로 확인했다.
- 빈 토큰 형태의 URL로 `openclaw/docs`를 임시 경로에 clone 해 보며 clone 성공 가능 여부를 재현했다.
- 같은 방식으로 임시 브랜치 push를 시도해 실제 인증 실패 메시지를 재현했다.
- `forks/openclaw_fork/scripts/docs-sync-publish.mjs`를 읽어 문서 변경이 없어도 커밋 시도가 발생할 수 있는지 확인했다.

## 실패 결과

- GitHub Actions `Docs Sync Publish Repo / sync-publish-repo`는 `Commit publish repo sync` 단계에서 실패했다.
- 재시도 루프가 5회 수행된 것으로 보이며 최종적으로 `Process completed with exit code 1.`로 종료됐다.
- 로컬 재현에서는 push 시 `Invalid username or token` 및 `Authentication failed for 'https://github.com/openclaw/docs.git/'`가 발생했다.
- 공개 저장소 특성상 clone은 빈 토큰이어도 성공할 수 있어서, `Clone publish repo` 성공만으로 토큰 유효성을 증명하지 못했다.
- 자동 실행 자체는 이상 동작이 아니었다. 워크플로는 `main`으로의 push 중 `docs/**`, `scripts/docs-sync-publish.mjs`, `.github/workflows/docs-sync-publish.yml` 변경이 포함되면 실행되도록 정의되어 있었다.
- 이번 push는 헤드 커밋 `bcbb3de` 하나만 올라간 것이 아니라, 로컬 `main`이 `upstream/main`을 fast-forward 한 뒤 그 전체 범위가 포크 원격 `main`으로 push된 상황이었다.
- 포크 원격 기준 이전 위치 `7fd57717a9`에서 새 헤드 `bcbb3de760`까지의 범위 안에 `docs/docs.json`, `docs/plugins/sdk-overview.md`, `docs/install/gcp.md` 등 다수의 `docs/**` 변경이 포함되어 있었고, 이 때문에 path filter가 충족되어 Actions가 자동 실행됐다.

## 해결해야하는 부분

- `OPENCLAW_DOCS_SYNC_TOKEN`이 실제로 설정되어 있는지 확인해야 한다.
- 설정되어 있다면 토큰이 만료되지 않았는지 확인해야 한다.
- 토큰이 `openclaw/docs` 저장소에 쓰기 가능한 권한을 갖는지 확인해야 한다.
- 조직 SSO 또는 fine-grained token 범위 제한 때문에 push가 막히는지 확인해야 한다.

## 해결 방법

- `theundergroundt/openclaw_fork` 저장소의 GitHub Actions secret에 `OPENCLAW_DOCS_SYNC_TOKEN`이 존재하는지 확인한다.
- 해당 토큰을 `openclaw/docs`에 `contents:write` 가능한 PAT 또는 fine-grained token으로 다시 발급하거나 교체한다.
- 필요하면 `Clone publish repo` 전에 토큰 검증용 API 호출 또는 `git ls-remote` 검증 단계를 추가해 clone 성공과 push 권한 부족을 구분한다.
- 필요하면 `.openclaw-sync/source.json`의 `syncedAt` 갱신 정책을 재검토해 불필요한 커밋 시도를 줄인다.
- 포크를 참고용 미러로 유지할 경우 `main`은 upstream 동기화 전용으로 두고, 실험이나 내 작업은 포크 안의 별도 브랜치에서 진행한다.
- 현재 워크플로 정의상 `Docs Sync Publish Repo`는 `main` push에서만 실행되므로, 같은 포크 안에서 기능 브랜치를 파서 작업하면 이 워크플로는 기본적으로 자동 실행되지 않는다.

## 요약

- 이번 실패는 문서 동기화 스크립트 자체보다 `openclaw/docs`로 push할 때의 Git 인증 또는 권한 문제일 가능성이 가장 높다.
- 공개 저장소라 clone은 통과했지만 push에서만 거절될 수 있는 구조라 현재 증상과 맞아떨어진다.
- 자동 실행이 발생한 이유는 단순히 "push를 해서"가 아니라, upstream 최신화를 포크 `main`에 반영하는 과정에서 `docs/**` 변경이 포함된 커밋 범위 전체가 함께 push되었기 때문이다.

# AIA Multiturn with LLM and RAG

이 저장소는 `Dify Chatflow` 기반 멀티턴 상담 흐름, 로컬 테스트용 런타임, YAML 워크플로우 자산, 프롬프트/메모리 설계 문서를 함께 관리합니다.

핵심 목적은 다음과 같습니다.

- Dify import 가능한 Chatflow/Workflow YAML 관리
- 멀티턴 의도분류, 검색, Judge rewrite, memory 흐름 설계
- 로컬 런타임으로 `/chat`, `/search/hybrid`, `/judge/evidence` 검증
- 문서/CSV 기반 mock retrieval 실험

## 주요 파일

### Workflow YAML

- `yaml/workflows/workflow_ver1.8.yml`
  - 최신 import-ready 아키텍처 초안
- `yaml/workflows/workflow_ver1.7.yml`
  - 이전 구조 비교용
- `yaml/workflows/workflow_local_runtime_minimal.yml`
  - 가장 단순한 로컬 런타임 연동 예제
- `yaml/workflows/workflow_local_runtime_intent_multidomain_multisearch.yml`
  - 의도분류, visible query rewrite, 멀티도메인, 다중검색 테스트용

### Runtime / Script

- `src/server.mjs`
  - 로컬 테스트용 HTTP runtime
- `scripts/smoke-test-runtime.mjs`
  - 기본 smoke test
- `scripts/test-local-intent-multidomain-multisearch.mjs`
  - intent + rewrite + multi-domain + multi-search 검증
- `scripts/run-local-runtime.ps1`
  - PowerShell 실행 스크립트

### Spec / Docs

- `yaml/specs/openapi-multiturn.yaml`
- `yaml/specs/prompt-config.yaml`
- `docs/memory-usage-guide.md`
- `docs/dify-local-runtime.md`
- `docs/dify-import-quickstart.md`
- `docs/multiturn-dialog-flow-advanced.md`
- `docs/multiturn-dialog-flow-basic.md`

## 빠른 시작

### 1. Node 실행

권장 버전:

- `Node.js >= 20`

설치 후 로컬 runtime 실행:

```bash
npm start
```

또는 PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-local-runtime.ps1
```

헬스 체크:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

## npm 스크립트

- `npm start`
  - 로컬 runtime 실행
- `npm run test:smoke`
  - 기본 smoke test
- `npm run test:local-yml`
  - intent / rewrite / multi-domain / multi-search 테스트

## 로컬 Runtime API

주요 엔드포인트:

- `GET /health`
- `GET /openapi.yaml`
- `POST /chat`
- `POST /supervisor/route`
- `POST /search/hybrid`
- `POST /judge/evidence`
- `POST /workflow/dispatch`
- `POST /answer`
- `POST /memory/upsert`
- `POST /policy/check`

## 최신 아키텍처 개요

현재 기준 메인 워크플로우 방향은 다음과 같습니다.

- `Supervisor Route Classifier`
- `Supervisor Query Rewrite`
- `Hybrid Search`
- `Evidence Judge`
- `Answer Generation`
- `Memory Write`

주요 상태값 예시:

- `route`
- `retry_count`
- `workflow_result`
- `judge_result`
- `session_memory`
- `long_term_memory`

## Dify Local Runtime Rewrite Test

### 관련 파일

- Workflow YAML: `yaml/workflows/workflow_local_runtime_intent_multidomain_multisearch.yml`
- Test script: `scripts/test-local-intent-multidomain-multisearch.mjs`
- JSON result: `logs/test-local-intent-multidomain-multisearch.latest.json`
- Markdown report: `logs/test-local-intent-multidomain-multisearch.latest.md`

### 검증 범위

- 기본 의도분류: `/supervisor/route`
- visible query rewrite 노드: `QUERY_REWRITE`
- 멀티도메인 검색: `/search/hybrid`
- 다중검색 비교: primary / workflow-focused / memory-focused
- Judge rewrite 제안: `/judge/evidence`
- 원본 query vs rewritten query 검색 비교
- rewrite 전후 `score`, `reranker_score` 비교
- `/chat` end-to-end 응답, citation, debug 검증

### 실행

```bash
npm run test:local-yml
```

### 결과 파일

테스트 실행 후 최신 결과가 아래에 저장됩니다.

- `logs/test-local-intent-multidomain-multisearch.latest.json`
- `logs/test-local-intent-multidomain-multisearch.latest.md`

### 결과 필드 예시

- `intent.greeting.route`
- `intent.compound.route`
- `rewrite.supervisor_rewritten_query`
- `rewrite.judge_suggested_rewrite`
- `rewrite.judge_retry_allowed`
- `search_compare.original_query`
- `search_compare.rewritten_query`
- `search_compare.original_top1.score`
- `search_compare.original_top1.reranker_score`
- `search_compare.rewritten_top1.score`
- `search_compare.rewritten_top1.reranker_score`
- `search_compare.top_hit_changed`
- `chat.route`
- `chat.debug`
- `chat.citations`

## Dify Import 참고

- Docker 기반 Dify에서 로컬 runtime 호출 시:
  - `http://host.docker.internal:8080`
- 같은 호스트 프로세스에서 직접 호출 시:
  - `http://127.0.0.1:8080`

## 저장소 구조

```text
.
|-- README.md
|-- data/
|-- docs/
|-- logs/
|-- scripts/
|-- src/
`-- yaml/
    |-- specs/
    `-- workflows/
```

## 참고 문서

- `docs/dify-local-runtime.md`
- `docs/dify-import-quickstart.md`
- `docs/memory-usage-guide.md`
- `docs/multiturn-dialog-flow-advanced.md`
- `docs/multiturn-flow-prompts.md`
- `yaml/specs/openapi-multiturn.yaml`

## 주의 사항

- 로컬 runtime은 운영용 서비스가 아니라 테스트/실험용 구현입니다.
- 검색은 `docs/`와 `data/MULTITURN_20260306.csv`를 기반으로 하는 mock retrieval 입니다.
- 테스트 산출물은 `logs/` 아래에 저장해 retrieval corpus 오염을 막습니다.
- 실제 운영 연결 시 `src/server.mjs`의 검색, workflow dispatch, memory 저장부를 외부 서비스로 교체해야 합니다.
## CSV Reflection Check

Validated target file:

- `data/MULTITURN_20260306.csv`

What was verified:

- CSV rows are loaded into the runtime corpus.
- `/search/hybrid` returns hits from `data/MULTITURN_20260306.csv` for real CSV questions.
- `/chat` also uses CSV-backed retrieval results as citations.
- Current runtime health check showed `corpus_size: 525` during validation.

Validation summary:

- Row 1 and Row 2 questions were tested directly from the CSV file.
- Search results returned `source_path: data/MULTITURN_20260306.csv` with `row_no` values such as `1` and `2`.
- `/chat` returned CSV-based citations for the same query.

Current limitation:

- CSV citation titles are still displayed as the `구분` value such as `API+RAG`.
- Row number and question preview are not yet reflected in the citation title.
- This is a presentation issue, not a CSV ingestion issue.

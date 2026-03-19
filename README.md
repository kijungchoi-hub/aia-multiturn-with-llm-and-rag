# AIA Multiturn with LLM and RAG

이 저장소는 `Dify Chatflow` 기반 멀티턴 상담 Assistant를 `Azure AI Search`와 결합해 설계하고, 실제 가져다 쓸 수 있는 Dify 워크플로 YAML과 프롬프트 스펙을 함께 관리하는 문서 중심 저장소입니다.

현재 기준 최신 산출물은 `yaml/workflows/workflow_ver1.8.yml`이며, 설계 문서와 데모 스크립트가 이 구조를 설명하고 검증하는 역할을 합니다.

## 현재 범위

- `Dify import-ready` 워크플로 YAML 관리
- 멀티턴 대화 흐름 문서화
- 프롬프트 노드 스펙 및 파이프라인 정의
- OpenAPI 초안 관리
- 메모리 저장 정책 가이드
- CSV 기반 프롬프트 렌더링 데모 스크립트

실행 서버 애플리케이션 구현체보다는 설계, 오케스트레이션 구조, 프롬프트 체인, 인터페이스 초안에 초점을 둡니다.

## 최신 권장 기준

- 메인 오케스트레이션: `Dify Chatflow`
- 최신 워크플로: `yaml/workflows/workflow_ver1.8.yml`
- 검색 계층: `Azure AI Search hybrid retrieval`
- 대화 상태 관리: `Chatflow` 중심
- 보조 실행 경로: `Workflow` 또는 외부 API 호출
- 메모리 정책: 답변 후 `session_memory` / `long_term_memory` 후보 추출

## v1.8에서 반영된 핵심 구조

`workflow_ver1.8.yml`은 개념도 수준을 넘어서, Dify에 가져올 수 있는 실제 Chatflow 정의를 포함합니다.

주요 특징:

- `advanced-chat` 모드 기준 Dify 앱 YAML
- 대화 변수 기반 컨텍스트 저장 구조
- 도메인 분류 후 병렬 검색 분기
- 검색 결과 병합 및 후처리 단계
- 개인화/UX Writing 후처리 노드 포함
- `Supervisor`, `Judge`, 메모리 저장 후보 흐름 반영

현재 YAML에서 확인되는 주요 대화 변수 예시는 다음과 같습니다.

- `workManual`
- `productManual`
- `policyTerms`
- `businessDoc`
- `consultScript`
- `pcManual`
- `sources`
- `route`
- `retry_count`
- `workflow_result`
- `judge_result`
- `session_memory`
- `long_term_memory`

즉, README만 읽고 끝나는 저장소가 아니라, 문서와 YAML이 함께 유지되는 운영 설계 저장소로 보는 편이 정확합니다.

## 실제 워크플로 버전 내용

### workflow_ver1.7.yml

기본 메타데이터:

- 앱 이름: `[PROD_LOCKED] 답변_ver7+UX Writing`
- 설명: `CSR에서 호출하는 워크플로우`
- 모드: `advanced-chat`

실제 YAML 기준 핵심 구성:

- 입력 전처리: `INPUT VALIDATOR`, `INPUT PROCESSOR`, `멀티턴 여부`
- 질문 분류: `Question Classifier`, `MT Check (Insurance)`, `Greeting Response`
- 검색 전처리: `사용자질의 embedding`, `Vector 추출`, `도메인 분류`, `도메인 충돌 해결`, `키워드 추출`, `Query Expansion`
- 도메인별 병렬 검색:
  - `업무매뉴얼 필터` -> `업무매뉴얼 VDB 연동` -> `업무매뉴얼 결과 저장`
  - `상품매뉴얼 필터` -> `상품매뉴얼 VDB 연동` -> `상품매뉴얼 Rerank` -> `상품매뉴얼 결과 저장`
  - `사업방법서 필터` -> `사업방법서 VDB 연동` -> `사업방법서 Rerank` -> `사업방법서 결과 저장`
  - `약관 필터` -> `약관 VDB 연동` -> `약관 Rerank` -> `약관 결과 저장`
  - `상담스크립트 필터` -> `상담스크립트 결과 저장`
  - `PC매뉴얼 필터` -> `PC매뉴얼 VDB 연동` -> `PC매뉴얼 Rerank` -> `PC매뉴얼 결과 저장`
- 병합 및 답변: `병렬 파이프라인 병합 + Context 통합`, `통합 Rerank`, `Rerank 결과 처리 + Sources Filter`, `답변 생성`, `예측질문 생성`, `Response Builder`
- 후처리: `UXW`

1.7에서 실제로 관리하는 대표 conversation variable:

- 문서 컨텍스트: `workManual`, `productManual`, `policyTerms`, `businessDoc`, `consultScript`, `pcManual`
- 부가 정보: `img_on_page_url`, `cs_docnm_kwd`, `img_in_chunk_urls`, `pc_docnm_kwd`
- 검색 상태: `sources`, `domain`, `similarityScore`, `valid_result`, `threshold_val`
- 분류/흐름 상태: `isWorkflow`, `extractedInfo`, `isDomainMatched`, `sub_domain`

정리하면 1.7은 실제 운영형 검색 파이프라인과 UX Writing 중심의 워크플로이며, 검색 분기와 리랭크 체인이 상세하게 박혀 있는 버전입니다.

### workflow_ver1.8.yml

기본 메타데이터:

- 앱 이름: `[ARCH_v1.8_IMPORT] Chatflow+Supervisor+Judge`
- 설명: `Dify import-ready v1.8. Chatflow-centered multiturn workflow with Supervisor, Azure AI Search hybrid retrieval, Evidence Judge loop, and stateless Workflow subflow boundary.`
- 모드: `advanced-chat`

실제 YAML 기준 핵심 구성:

- Supervisor 중심 진입: `Supervisor Route Classifier`, `Supervisor Route Gate`, `Supervisor Query Rewrite`
- 멀티턴 상태 분기: `Multiturn Memory Gate`
- 검색 전처리와 분류: `사용자질의 embedding`, `Vector 추출`, `도메인 분류`, `도메인 충돌 해결`, `키워드 추출`, `Query Expansion`
- 도메인별 병렬 검색 구조는 유지:
  - 업무매뉴얼 / 상품매뉴얼 / 사업방법서 / 약관 / 상담스크립트 / PC매뉴얼 분기
- Judge 및 검색 품질 관련 노드 추가:
  - `Evidence Judge Gate`
  - `Azure AI Search Hybrid Rerank`
  - `Judge Context Merge + Work Manual Packaging`
- 답변 체인 명확화:
  - `Answer Generator`
  - `예측질문 생성`
  - `Answer Envelope Builder`
  - `Personalization / UX Writing`

1.8에서 추가된 대표 conversation variable:

- `route`
- `retry_count`
- `workflow_result`
- `judge_result`
- `session_memory`
- `long_term_memory`

즉 1.8은 1.7의 병렬 검색 구조를 유지하면서도, Chatflow 중심 오케스트레이션 관점의 `Supervisor -> Judge -> Answer -> Memory` 축을 명시적으로 드러낸 버전입니다.

### 1.7 -> 1.8 주요 차이

- 질문 분류 중심 명칭이 `Question Classifier`에서 `Supervisor Route Classifier` 계열로 바뀌었습니다.
- `MT Check (Insurance)` / `멀티턴 여부` 중심 흐름이 `Multiturn Memory Gate`로 정리됐습니다.
- `Rerank 분기`, `통합 Rerank` 중심 표현이 `Evidence Judge Gate`, `Azure AI Search Hybrid Rerank` 등 Judge 중심 표현으로 재구성됐습니다.
- 답변 노드 명칭이 `답변 생성`, `Response Builder`, `UXW`에서 `Answer Generator`, `Answer Envelope Builder`, `Personalization / UX Writing`으로 정리됐습니다.
- 1.8에서는 `route`, `retry_count`, `workflow_result`, `judge_result`, `session_memory`, `long_term_memory`가 추가되어 멀티턴 오케스트레이션 상태를 YAML 차원에서 더 직접적으로 표현합니다.
- 1.7이 운영 파이프라인 성격이 강했다면, 1.8은 Dify import-ready 아키텍처 표준안 성격이 더 강합니다.

### 버전 비교표

| 구분 | workflow_ver1.7 | workflow_ver1.8 |
|---|---|---|
| 앱 이름 | `[PROD_LOCKED] 답변_ver7+UX Writing` | `[ARCH_v1.8_IMPORT] Chatflow+Supervisor+Judge` |
| 설명 성격 | CSR 호출용 운영 워크플로 | Dify import-ready 아키텍처 표준안 |
| 진입 분류 노드 | `Question Classifier`, `MT Check (Insurance)` | `Supervisor Route Classifier`, `Supervisor Route Gate` |
| 멀티턴 상태 노드 | `멀티턴 여부` | `Multiturn Memory Gate` |
| 질의 재작성 노드 | `Query Rewrite` | `Supervisor Query Rewrite` |
| 병렬 검색 구조 | 업무매뉴얼/상품매뉴얼/사업방법서/약관/상담스크립트/PC매뉴얼 | 업무매뉴얼/상품매뉴얼/사업방법서/약관/상담스크립트/PC매뉴얼 |
| 검색 품질 노드 | `통합 Rerank`, 도메인별 `Rerank` | `Evidence Judge Gate`, `Azure AI Search Hybrid Rerank`, 도메인별 `Rerank` |
| 답변 생성 노드 | `답변 생성`, `Response Builder`, `UXW` | `Answer Generator`, `Answer Envelope Builder`, `Personalization / UX Writing` |
| 메모리 상태 변수 | 명시적 메모리 변수 없음 | `session_memory`, `long_term_memory` 추가 |
| 오케스트레이션 상태 변수 | `isWorkflow`, `extractedInfo`, `isDomainMatched`, `sub_domain` | 기존 변수 + `route`, `retry_count`, `workflow_result`, `judge_result` |
| 설계 중심축 | 검색 파이프라인 + UX Writing | `Supervisor -> Judge -> Answer -> Memory` |

핵심 해석:

- `1.7`은 운영형 검색 체인과 도메인별 병렬 분기 구현이 중심입니다.
- `1.8`은 그 구조를 유지하면서, Supervisor 라우팅과 Judge 판정, 메모리 상태를 더 명시적으로 드러냅니다.
- 따라서 운영 워크플로 계보를 보려면 `1.7`, 아키텍처 기준 최신 표준안을 보려면 `1.8`을 먼저 읽는 편이 맞습니다.

## 저장소 구조

```text
.
|-- README.md
|-- data/
|   |-- MULTITURN_20260306.csv
|   `-- 개인화질문_답변_유형.xlsx
|-- docs/
|   |-- deep-research-architecture-memo.md
|   |-- deep-research-report.md
|   |-- memory-usage-guide.md
|   |-- multiturn-dialog-flow-advanced.md
|   |-- multiturn-dialog-flow-basic.md
|   |-- multiturn-flow-advanced-prompts.md
|   |-- multiturn-flow-basic-prompts.md
|   `-- multiturn-flow-prompts.md
|-- scripts/
|   `-- demo-prompt-test.mjs
`-- yaml/
    |-- specs/
    |   |-- openapi-multiturn.yaml
    |   `-- prompt-config.yaml
    `-- workflows/
        |-- workflow_ver1.7.yml
        `-- workflow_ver1.8.yml
```

## 빠른 시작

### 1. 최신 워크플로 확인

- 기본 확인 대상: `yaml/workflows/workflow_ver1.8.yml`
- 비교용 이전 버전: `yaml/workflows/workflow_ver1.7.yml`

### 2. 프롬프트 스펙 확인

- `yaml/specs/prompt-config.yaml`
- 파일 확장자는 YAML이지만, 현재 내용은 JSON 형식입니다.

포함 노드:

- `B`: 입력 파싱
- `POL`: 정책 사전 검사
- `SUP`: Supervisor 라우팅 및 질의 재작성
- `WF`: Workflow 호출 판단
- `SRCH`: 검색 요청 파라미터 생성
- `NORM`: 검색 결과 정규화
- `JUDGE`: 근거 충분성 판정
- `REWRITE`: 재검색용 질의 재작성
- `ANS`: 최종 답변 생성
- `T1`: 개인화 후처리
- `T2`: 멀티턴 연결문 생성
- `MEM`: 메모리 후보 추출 및 저장 판단
- `GY`: 정책 차단 시 안전 대체 응답

### 3. 데모 스크립트 실행

`scripts/demo-prompt-test.mjs`는 `prompt-config.yaml`을 읽어 각 프롬프트 노드의 렌더링 결과를 확인하는 스크립트입니다.

실행 예시:

```bash
node scripts/demo-prompt-test.mjs
node scripts/demo-prompt-test.mjs B
node scripts/demo-prompt-test.mjs yaml/specs/prompt-config.yaml
node scripts/demo-prompt-test.mjs --csv data/MULTITURN_20260306.csv --row 1
node scripts/demo-prompt-test.mjs B --csv data/MULTITURN_20260306.csv --row 3
```

전제:

- Node.js 18 이상 권장
- `yaml/specs/prompt-config.yaml`은 JSON으로 파싱 가능해야 함
- CSV는 UTF-8 기준으로 읽는 것을 전제

## 문서별 역할

### 아키텍처 / 조사 문서

- [docs/deep-research-architecture-memo.md](docs/deep-research-architecture-memo.md)
  - 최신 권장 아키텍처 요약 메모
- [docs/deep-research-report.md](docs/deep-research-report.md)
  - 조사 원문 및 비교 검토 내용

### 대화 흐름 문서

- [docs/multiturn-dialog-flow-advanced.md](docs/multiturn-dialog-flow-advanced.md)
  - 2026-03-19 기준 고급 멀티턴 실행 흐름
  - `answer_direct | search | clarify`
  - `Judge -> rewrite -> search` 재시도 루프
  - `Workflow/API + AI Search` 결합 원칙

- [docs/multiturn-dialog-flow-basic.md](docs/multiturn-dialog-flow-basic.md)
  - 기본 흐름 설명

### 프롬프트 문서

- [docs/multiturn-flow-prompts.md](docs/multiturn-flow-prompts.md)
  - 현재 권장 프롬프트 체인 설명
- [docs/multiturn-flow-basic-prompts.md](docs/multiturn-flow-basic-prompts.md)
  - 기본 템플릿
- [docs/multiturn-flow-advanced-prompts.md](docs/multiturn-flow-advanced-prompts.md)
  - 고급 템플릿

### 스펙 / 정책 문서

- [yaml/specs/openapi-multiturn.yaml](yaml/specs/openapi-multiturn.yaml)
  - `/chat`, `/search/hybrid`, `/judge/evidence`, `/memory/upsert` 등 인터페이스 초안
- [docs/memory-usage-guide.md](docs/memory-usage-guide.md)
  - `Chatflow`와 `Workflow` 간 메모리 책임 분리
  - `session_memory`, `long_term_memory` 저장 기준

## 권장 확인 순서

1. [docs/deep-research-architecture-memo.md](docs/deep-research-architecture-memo.md)
2. [yaml/workflows/workflow_ver1.8.yml](yaml/workflows/workflow_ver1.8.yml)
3. [docs/multiturn-dialog-flow-advanced.md](docs/multiturn-dialog-flow-advanced.md)
4. [yaml/specs/prompt-config.yaml](yaml/specs/prompt-config.yaml)
5. [yaml/specs/openapi-multiturn.yaml](yaml/specs/openapi-multiturn.yaml)
6. [docs/memory-usage-guide.md](docs/memory-usage-guide.md)
7. [scripts/demo-prompt-test.mjs](scripts/demo-prompt-test.mjs)
8. [data/MULTITURN_20260306.csv](data/MULTITURN_20260306.csv)

## 운영 시 유의사항

- `workflow_ver1.8.yml`에는 실제 환경변수 키와 인덱스 식별자 자리가 포함되어 있으므로, 가져오기 전 환경별 값 검토가 필요합니다.
- `yaml/specs/openapi-multiturn.yaml`은 초안이므로 운영 API와 완전히 같다고 가정하면 안 됩니다.
- `prompt-config.yaml`은 파일명과 달리 현재 JSON 형식을 전제로 합니다.
- 메모리 저장의 최종 책임은 `Workflow`가 아니라 `Chatflow` 쪽에 둡니다.
- 샘플 CSV 인코딩 상태에 따라 일부 컬럼 매핑 확인이 필요할 수 있습니다.

## 참고 파일

- [yaml/workflows/workflow_ver1.8.yml](yaml/workflows/workflow_ver1.8.yml)
- [yaml/workflows/workflow_ver1.7.yml](yaml/workflows/workflow_ver1.7.yml)
- [yaml/specs/prompt-config.yaml](yaml/specs/prompt-config.yaml)
- [yaml/specs/openapi-multiturn.yaml](yaml/specs/openapi-multiturn.yaml)
- [docs/multiturn-dialog-flow-advanced.md](docs/multiturn-dialog-flow-advanced.md)
- [docs/memory-usage-guide.md](docs/memory-usage-guide.md)
- [scripts/demo-prompt-test.mjs](scripts/demo-prompt-test.mjs)

# AIA Multiturn with LLM and RAG

- Memory usage guide: `docs/memory-usage-guide.md`

멀티턴 대화형 Assistant를 설계하기 위한 문서 중심 저장소입니다. 이 리포지토리는 애플리케이션 실행 코드보다 다음 산출물에 초점을 둡니다.

- 멀티턴 RAG Assistant 아키텍처 및 대화 흐름 문서
- OpenAPI 기반 인터페이스 초안
- 프롬프트 파이프라인 설정
- CSV 샘플 데이터를 활용한 프롬프트 데모 스크립트

즉, "개인화 + 멀티턴 맥락 유지 + 복합 질문 분해 + RAG/사실조회 결합"을 어떤 구조로 설계할지 정리한 설계 리포지토리입니다.

## 프로젝트 목표

- 단일 질문이 아니라 연속 대화 맥락을 유지하는 Assistant 흐름 정의
- 복합 질문을 분해하고 질문별 실행 전략을 수립하는 방식 정리
- 사실 조회(API)와 규정/정책 조회(RAG)를 함께 사용하는 응답 구조 설계
- 개인화 프로필을 후처리 단계에 반영하는 응답 합성 방식 문서화
- 위 흐름을 API 스펙과 프롬프트 설정으로 구체화

## 저장소 구성

```text
.
|-- README.md
|-- data/
|   |-- MULTITURN_20260306.csv
|   `-- 개인화질문_답변_유형.xlsx
|-- docs/
|   |-- multiturn-dialog-flow-advanced.md
|   |-- multiturn-dialog-flow-basic.md
|   |-- multiturn-flow-advanced-prompts.md
|   |-- multiturn-flow-basic-prompts.md
|   |-- multiturn-flow-prompts.md
|   |-- openapi-multiturn.yaml
|   `-- prompt-config.yaml
`-- scripts/
    `-- demo-prompt-test.mjs
```

## 핵심 문서 안내

### 1. API 스펙

- `docs/openapi-multiturn.yaml`
- 멀티턴 Assistant를 구성하는 주요 엔드포인트 초안이 포함되어 있습니다.
- 대표 엔드포인트:
  - `/chat`: 엔드 투 엔드 오케스트레이션
  - `/plan`: 질문 분해 및 실행 계획
  - `/retrieve`: 하이브리드 검색
  - `/rerank`: 후보 근거 재정렬
  - `/answer`: 근거 기반 응답 생성
  - `/memory/upsert`: 메모리 저장
  - `/policy/check`: 안전성/정책 검사

### 2. 대화 흐름 문서

- `docs/multiturn-dialog-flow-basic.md`
  - 기본 멀티턴 검색/응답 흐름 설명
- `docs/multiturn-dialog-flow-advanced.md`
  - CSV 예시 데이터를 반영한 고급 멀티턴 흐름
  - 개인화, 복합질문, API/RAG 소스 분기, 메모리 저장 규칙 포함

### 3. 프롬프트 흐름 문서

- `docs/multiturn-flow-basic-prompts.md`
- `docs/multiturn-flow-advanced-prompts.md`
- `docs/multiturn-flow-prompts.md`
- 파이프라인 각 노드에서 어떤 프롬프트를 사용하고 어떤 JSON 스키마를 기대하는지 정리합니다.

### 4. 프롬프트 설정 파일

- `docs/prompt-config.yaml`
- 확장자는 YAML이지만 현재 데모 스크립트는 이 파일을 "JSON으로 파싱"합니다.
- 따라서 실제 사용 시에는 JSON 호환 형식으로 유지해야 합니다.
- 포함 내용:
  - 전역 시스템 프롬프트
  - 파이프라인 노드 정의
  - 각 노드의 `system`, `user_template`, `output_schema`
  - 데모용 `demo_context`

### 5. 샘플 데이터

- `data/MULTITURN_20260306.csv`
  - 멀티턴 질문/응답 예시 데이터
- `data/개인화질문_답변_유형.xlsx`
  - 개인화 질문 유형 참고용 데이터

## 설계 범위

이 저장소는 아래 시나리오를 다룹니다.

- 사용자의 현재 질문에서 의도, 엔티티, 제약 조건 추출
- 질문이 복합질문인지 판별하고 질문 단위로 분해
- 질문별로 API 조회, RAG 조회, 하이브리드 조회 여부 결정
- 근거를 추출, 점수화, 충돌 해결 후 최종 답변 생성
- 사용자 톤/길이/형식 선호를 반영해 후처리
- 세션 메모리와 장기 메모리 저장 후보 분리

## 빠른 확인 방법

이 저장소는 별도 패키지 설치 없이 Node.js로 데모 스크립트를 실행할 수 있습니다.

전제:

- Node.js 18 이상 권장
- `docs/prompt-config.yaml` 파일이 JSON 호환 형식이어야 함
- CSV는 UTF-8로 읽을 수 있어야 함

## 데모 스크립트 사용법

스크립트:

- `scripts/demo-prompt-test.mjs`

역할:

- 프롬프트 설정 파일을 읽음
- 특정 노드 또는 전체 파이프라인의 프롬프트를 렌더링함
- 필요 시 CSV 한 행을 데모 컨텍스트에 주입함

### 1. 전체 파이프라인 프롬프트 출력

```bash
node scripts/demo-prompt-test.mjs
```

### 2. 특정 노드만 출력

예: `B` 노드만 출력

```bash
node scripts/demo-prompt-test.mjs B
```

### 3. 다른 설정 파일 사용

```bash
node scripts/demo-prompt-test.mjs docs/prompt-config.yaml
```

### 4. CSV 데이터를 붙여서 테스트

```bash
node scripts/demo-prompt-test.mjs --csv data/MULTITURN_20260306.csv --row 1
```

### 5. CSV + 특정 노드 조합

```bash
node scripts/demo-prompt-test.mjs B --csv data/MULTITURN_20260306.csv --row 3
```

## 스크립트 동작 방식

`scripts/demo-prompt-test.mjs`는 대략 아래 순서로 동작합니다.

1. 설정 파일 로드
2. `global_system`, `pipeline`, `nodes`, `demo_context` 파싱
3. 필요하면 CSV 특정 행 로드
4. CSV의 질문/답변을 데모 변수에 매핑
5. `user_template`에 변수 치환
6. 최종 프롬프트와 기대 출력 스키마를 콘솔에 출력

CSV를 사용할 때 주요 매핑은 다음과 같습니다.

- 질문 -> `user_message`, `question`, `questions[0]`
- 답변 예시 -> `answer`, `drafts`, `resolved_drafts`
- `NO.`, `구분` -> 테스트 메타데이터

## 권장 활용 흐름

이 리포지토리를 사용할 때는 보통 아래 순서를 권장합니다.

1. `docs/multiturn-dialog-flow-advanced.md`로 전체 오케스트레이션 이해
2. `docs/openapi-multiturn.yaml`로 모듈 경계와 입출력 확인
3. `docs/prompt-config.yaml`로 실제 프롬프트 노드 구성 확인
4. `scripts/demo-prompt-test.mjs`로 노드별 프롬프트 렌더링 검증
5. `data/MULTITURN_20260306.csv`로 샘플 질의 기반 점검

## 문서별 추천 독자

- 기획/PO: `docs/multiturn-dialog-flow-advanced.md`
- 백엔드/API 설계자: `docs/openapi-multiturn.yaml`
- LLM 프롬프트 설계자: `docs/prompt-config.yaml`, `docs/multiturn-flow-prompts.md`
- 데이터/평가 담당자: `data/MULTITURN_20260306.csv`

## 현재 상태와 한계

- 실제 서버 구현체는 포함되어 있지 않습니다.
- `openapi-multiturn.yaml`은 설계 초안이며 운영 API와 1:1로 연결되지 않을 수 있습니다.
- `prompt-config.yaml`은 이름과 달리 현재 JSON 파싱 전제에 의존합니다.
- 일부 문서는 한글 인코딩 상태를 점검할 필요가 있습니다.

## 다음 단계 제안

- `prompt-config.yaml`을 실제 YAML 파서 기반으로 읽도록 스크립트 개선
- OpenAPI 스펙에 예시 요청/응답 추가
- CSV 기반 회귀 테스트 스크립트 확장
- 문서 인코딩 UTF-8 통일
- 평가 지표(분해 정확도, 소스 선택 정확도, 근거 충분성) 문서화

## 참고 파일

- `docs/openapi-multiturn.yaml`
- `docs/prompt-config.yaml`
- `docs/multiturn-dialog-flow-basic.md`
- `docs/multiturn-dialog-flow-advanced.md`
- `docs/multiturn-flow-prompts.md`
- `scripts/demo-prompt-test.mjs`
- `data/MULTITURN_20260306.csv`

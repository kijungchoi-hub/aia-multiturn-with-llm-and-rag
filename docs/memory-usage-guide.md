# Memory Usage Guide

## 목적

이 문서는 이 저장소의 `memory` 기능을 `Dify Chatflow + Dify Workflow` 아키텍처 기준으로 어떻게 사용해야 하는지 정리한다.

핵심 목표는 다음 두 가지다.

- 사용자 선호와 반복 맥락을 다음 턴에 재사용한다.
- `Workflow`에 메모리 책임을 과도하게 싣지 않고, `Chatflow` 중심으로 상태를 관리한다.

## 기준 문서

- [deep-research-architecture-memo.md](deep-research-architecture-memo.md)
- [multiturn-dialog-flow-advanced.md](multiturn-dialog-flow-advanced.md)
- [multiturn-flow-prompts.md](multiturn-flow-prompts.md)
- [openapi-multiturn.yaml](../yaml/specs/openapi-multiturn.yaml)
- [prompt-config.yaml](../yaml/specs/prompt-config.yaml)

## 핵심 원칙

- 멀티턴 메모리의 주체는 `Dify Chatflow`다.
- `Dify Workflow`는 메모리가 없는 보조 서브플로로 취급한다.
- `Workflow` 실행 결과는 필요하면 `Chatflow`로 다시 반환한 뒤, 그 시점에서만 메모리 저장 여부를 판단한다.
- 검색 결과 원문, 민감정보, 일회성 사실값은 장기 메모리로 저장하지 않는다.

## Dify 기준 메모리 역할 분리

### Chatflow가 담당하는 것
- `conversation_id` 기준 대화 연속성 유지
- 최근 턴, 요약, open loop 관리
- 사용자 선호와 세션 맥락을 다음 턴 입력에 반영
- 답변 후 메모리 후보 추출 및 저장 트리거

### Workflow가 담당하는 것
- 외부 API 조회
- 비동기 작업
- 포맷 변환
- 배치성 처리

### Workflow가 담당하면 안 되는 것
- 멀티턴 대화의 주 상태 저장
- 장기 메모리 저장 판단
- 다음 턴 해석에 필요한 세션 문맥 유지

정리하면, `Workflow`는 실행 결과를 반환하는 도구이고, 메모리를 읽고 쓰는 최종 책임은 `Chatflow` 오케스트레이터에 둔다.

## 메모리 개념

이 저장소의 메모리는 읽기/쓰기 저장소 구현 자체보다, 무엇을 저장할지와 어떤 형식으로 저장할지를 정의한 설계 문서 중심 구조다.

- `long_term_memory`: 장기적으로 유지할 사용자 성향, 선호, 반복 관심사
- `session_memory`: 현재 세션에서만 유지할 최근 맥락, 직전 조회 결과, 방금 설명한 기준

메모리는 대화 도중 임의 시점에 저장하지 않고, 답변 생성 이후 후보를 추출해 저장 여부를 판정하는 후처리 흐름을 따른다.

## 저장 시점

권장 시점은 최종 응답 반환 직후다.

흐름 기준:

1. 사용자 입력 수신
2. `Chatflow Supervisor`가 세션 메모리와 최근 턴을 읽음
3. 필요 시 `Workflow` 또는 `Azure AI Search` 호출
4. 답변 생성
5. 응답 반환
6. 메모리 후보 추출
7. 정책 통과 항목만 저장

관련 위치:

- [multiturn-dialog-flow-advanced.md](multiturn-dialog-flow-advanced.md)
- [multiturn-flow-prompts.md](multiturn-flow-prompts.md)의 `MEM`
- [prompt-config.yaml](../yaml/specs/prompt-config.yaml)의 `memory_candidate_and_save_decision`

## 무엇을 저장할지

### 장기 메모리

다음 세션에도 유효한 정보만 저장한다.

- 답변 형식 선호
- 답변 길이 선호
- 톤 선호
- 반복 관심 주제
- 자주 비교하는 상품/도메인

예시:

- `preferred_format=bullet`
- `preferred_tone=concise`
- `preferred_length=short`
- `interest_topic=retirement_fund`

### 세션 메모리

현재 대화 흐름에서만 유효한 맥락을 저장한다.

- 직전 조회 계약
- 방금 안내한 제한 조건
- 방금 설명한 기준일 또는 반영 규칙
- 직전 비교 대상
- 현재 열려 있는 후속 질문(open loop)

예시:

- `last_viewed_contract=연금저축보험 A`
- `last_explained_rule=신청일+3영업일 반영`
- `last_compared_items=펀드A,펀드B`
- `open_loop=적용 기준일 추가 확인 필요`

### 저장하면 안 되는 정보

다음 정보는 저장 대상에서 제외한다.

- 계좌번호 원문
- 주민등록번호
- 전화번호
- 이메일 주소
- 주소
- 인증정보
- 검색 원문 chunk 전체
- 외부 API 응답 원문 전체
- 일회성 잡담

## Workflow 결과를 메모리에 반영하는 규칙

`Workflow`가 계약 상태 조회, 자동이체일 조회, 계좌 검증 같은 작업을 수행할 수는 있다. 다만 그 결과를 모두 메모리에 저장하면 안 된다.

저장 가능:
- 다음 턴 해석에 필요한 최근 작업 맥락
- 사용자가 반복적으로 언급한 관심 대상
- 사용자가 명시한 선호

저장 금지 또는 기본 제외:
- 실시간 API 사실값 전체
- 민감한 업무 데이터 원문
- 단발성 조회 결과 전체
- 재조회 시 쉽게 다시 얻을 수 있는 값

예시:
- 저장 가능: `last_viewed_contract=연금저축보험 A`
- 저장 보류: `autopay_date=매월 25일`
- 저장 금지: `account_number=123-456-7890`

## 메모리 후보 추출 방식

메모리 후보는 별도 프롬프트 노드에서 추출한다.

- 노드 이름: `memory_candidate_and_save_decision`
- 위치: [prompt-config.yaml](../yaml/specs/prompt-config.yaml)

입력:

- `turn_data`
- `memory_policy`

출력:

- `session_memory`
- `long_term_memory`
- `excluded`

출력 스키마:

```json
{
  "session_memory": [
    {
      "key": "string",
      "value": "string"
    }
  ],
  "long_term_memory": [
    {
      "key": "string",
      "value": "string",
      "confidence": 0.0
    }
  ],
  "excluded": [
    {
      "key": "string",
      "reason": "string"
    }
  ]
}
```

## 저장 API 사용법

메모리 저장 엔드포인트는 `/memory/upsert` 다.

스펙 위치:

- [openapi-multiturn.yaml](../yaml/specs/openapi-multiturn.yaml)

### 요청 스키마

필수 필드:

- `user_id`
- `conversation_id`

선택 필드:

- `session_memory`
- `long_term_memory`
- `policy`

각 메모리 항목은 다음 필드를 가진다.

- `key`
- `value`
- `ttl_seconds`
- `pii`
- `confidence`

### 요청 예시

```json
{
  "user_id": "u123",
  "conversation_id": "c456",
  "session_memory": [
    {
      "key": "last_viewed_contract",
      "value": "연금저축보험 A",
      "ttl_seconds": 3600,
      "confidence": 0.86,
      "pii": false
    },
    {
      "key": "open_loop",
      "value": "적용 기준일 추가 확인 필요",
      "ttl_seconds": 3600,
      "confidence": 0.88,
      "pii": false
    }
  ],
  "long_term_memory": [
    {
      "key": "preferred_format",
      "value": "bullet",
      "confidence": 0.92,
      "pii": false
    },
    {
      "key": "interest_topic",
      "value": "retirement_fund",
      "confidence": 0.81,
      "pii": false
    }
  ],
  "policy": {
    "allow_pii": false,
    "min_confidence": 0.7
  }
}
```

### 응답 예시

```json
{
  "saved": 3,
  "skipped": 1,
  "reason_codes": [
    "below_confidence_threshold"
  ]
}
```

## 저장 정책

기본 정책은 다음처럼 운영한다.

- `allow_pii=false`
- `min_confidence=0.7`

의미:

- `confidence < min_confidence` 이면 저장하지 않는다.
- `pii=true` 이고 `allow_pii=false` 이면 저장하지 않는다.

실무 권장 규칙:

- `long_term_memory` 는 사용자의 지속 선호만 저장한다.
- `session_memory` 는 반드시 `ttl_seconds` 를 둔다.
- 동일한 `key` 가 있으면 최신 값으로 upsert 한다.
- 값은 문장 전체보다 정규화된 짧은 값으로 저장한다.
- `Workflow` 결과는 바로 저장하지 말고, `Chatflow` 답변 완료 후 선별 저장한다.

## 키 설계 권장안

권장 예시:

- `preferred_format`
- `preferred_tone`
- `preferred_length`
- `interest_topic`
- `last_viewed_contract`
- `last_explained_rule`
- `last_compared_items`
- `open_loop`

피해야 할 예시:

- `memory1`
- `user_info`
- `misc_context`
- `last_message_full_text`
- `workflow_raw_output`
- `search_result_full_text`

## `/chat` 과의 연동

`/chat` 요청의 `options.enable_memory_write` 를 `true` 로 두면, 오케스트레이션 레벨에서 메모리 저장 단계를 포함할 수 있다.

예시:

```json
{
  "conversation_id": "c456",
  "user_id": "u123",
  "message": "지난번처럼 불릿으로 정리해주고 이번엔 펀드 A랑 B도 비교해줘",
  "options": {
    "enable_memory_write": true
  }
}
```

운영 패턴은 두 가지다.

### 패턴 1. Chatflow 내부 일괄 처리
- `/chat` 안에서 답변 생성과 메모리 저장을 함께 처리

장점:
- `Chatflow`가 메모리 읽기/쓰기 책임을 일관되게 가진다.
- `Workflow`를 단순 실행 도구로 유지하기 쉽다.

### 패턴 2. 서비스 레이어 분리 처리
- `/chat` 으로 답변 생성
- 별도로 `/memory/upsert` 호출

장점:
- 저장 여부를 서비스 레이어에서 더 엄격하게 제어할 수 있다.
- 감사 로그와 저장 정책 적용을 분리하기 쉽다.

## 읽기 사용법

현재 스펙에는 `memory read` 전용 API 는 정의돼 있지 않다. 따라서 읽기는 상위 오케스트레이터 또는 `Chatflow` 시작 단계가 메모리 저장소에서 값을 가져와 다음 입력에 주입하는 방식으로 본다.

주입 위치:

- `/chat` 요청의 `context`
- `/chat` 요청의 `profile`
- 내부 오케스트레이션의 `recent_turns`, `summary`, `open_loops`

권장 반영 방식:

- 최근 세션 메모리 -> `context.recent_turns`, `context.summary`, `context.open_loops`
- 장기 메모리 -> `profile.tone`, `profile.preferred_format` 같은 사용자 선호 필드
- `Workflow`는 필요 입력만 받아 실행하고 자체적으로 메모리를 보관하지 않는다.

## 권장 저장 판정 규칙

저장:
- 사용자가 명시적으로 선호를 말한 경우
- 같은 관심 주제가 반복된 경우
- 다음 턴 해석에 직접 필요한 최근 맥락인 경우
- `Workflow` 실행 결과라도 다음 턴 문맥으로 남겨야 할 요약 정보인 경우

저장 보류:
- 단 한 번 나온 취향인지 불명확한 경우
- 모델이 추론한 값이라 확신이 낮은 경우
- 단발성 API 결과로 다음 턴에 필요할지 불명확한 경우

저장 금지:
- 민감정보
- 규정상 장기 보관 금지 정보
- 원문 전체 대화
- 검색 결과 원문
- `Workflow` 원시 응답 전체

## 운영 예시

사용자 발화:

```text
앞으로 답변은 불릿으로 짧게 해주고, 지난번 본 연금저축보험 A 기준으로 다시 설명해줘. 적용일은 아직 확인 중이면 그 상태도 기억해줘.
```

추출 후보:

```json
{
  "session_memory": [
    {
      "key": "last_viewed_contract",
      "value": "연금저축보험 A"
    },
    {
      "key": "open_loop",
      "value": "적용일 확인 필요"
    }
  ],
  "long_term_memory": [
    {
      "key": "preferred_format",
      "value": "bullet",
      "confidence": 0.98
    },
    {
      "key": "preferred_length",
      "value": "short",
      "confidence": 0.94
    }
  ],
  "excluded": []
}
```

## 구현 체크리스트

- 메모리 후보 추출 프롬프트를 답변 이후 단계에 둔다.
- `Chatflow`를 메모리 읽기/쓰기의 주체로 둔다.
- `Workflow`는 무상태 서브플로로 유지한다.
- `session_memory` 저장 시 TTL 을 강제한다.
- `pii` 와 `confidence` 를 함께 검사한다.
- 저장 키를 정규화한다.
- 다음 턴 시작 전에 장기/세션 메모리를 `context` 와 `profile` 에 주입한다.
- `Workflow` 결과 원문을 통째로 메모리에 저장하지 않는다.

## 요약

이 저장소의 `memory` 기능은 `Dify Chatflow` 중심의 후처리 저장 단계로 이해하면 된다.

- 장기 메모리: 선호와 반복 관심사
- 세션 메모리: 직전 조회/설명 맥락과 open loop
- 메모리 주체: `Chatflow`
- 보조 실행: `Workflow`
- 저장 인터페이스: `/memory/upsert`


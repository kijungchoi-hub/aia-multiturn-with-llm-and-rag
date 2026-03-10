# Memory Usage Guide

## 목적

이 문서는 이 저장소의 `memory` 기능을 실제 구현과 운영 관점에서 어떻게 사용해야 하는지 구체화한다.

메모리 기능의 목표는 다음 두 가지다.

- 사용자 선호와 반복 맥락을 다음 턴에 재사용한다.
- 민감정보나 일회성 잡음을 저장하지 않도록 제한한다.

## 기준 문서

- `docs/openapi-multiturn.yaml`
- `docs/multiturn-dialog-flow-advanced.md`
- `docs/multiturn-flow-prompts.md`
- `docs/prompt-config.yaml`

## 메모리 개념

이 저장소의 메모리는 읽기/쓰기 전체 저장소 구현이 아니라, "무엇을 저장할지"와 "어떤 형식으로 저장할지"를 정의한 설계 문서 중심 구조다.

- `long_term`: 장기적으로 유지할 사용자 성향, 선호, 반복 관심사
- `short_term`: 현재 세션에서만 유지할 최근 맥락, 직전 조회 결과, 방금 설명한 기준

메모리는 대화 도중 아무 시점에 저장하지 않고, 답변 생성이 끝난 뒤 후보를 추출해 저장 여부를 판정하는 흐름을 따른다.

## 저장 시점

권장 시점은 최종 답변 반환 직후다.

흐름 기준:

1. 사용자 입력 수신
2. 질문 분해, 조회, 답변 생성
3. 개인화 후처리
4. 응답 반환
5. 메모리 후보 추출
6. 정책 통과 항목만 저장

관련 근거:

- `docs/multiturn-dialog-flow-advanced.md` 의 `V -> W -> X -> Y/Z`
- `docs/multiturn-flow-prompts.md` 의 `R0/R1/R2/R3`

## 무엇을 저장할지

### 장기 메모리

다음과 같이 다음 세션에도 유효한 정보만 저장한다.

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

예시:

- `last_viewed_contract=연금저축보험 A`
- `last_explained_rule=신청일+3영업일 반영`
- `last_compared_items=펀드A,펀드B`

### 저장하면 안 되는 정보

다음 정보는 저장 대상에서 제외한다.

- 계좌번호 원문
- 주민등록번호
- 전화번호
- 이메일 주소
- 주소
- 인증정보
- 일회성 잡담

## 메모리 후보 추출 방식

메모리 후보는 별도 프롬프트 노드에서 추출한다.

- 노드 이름: `memory_candidate_and_save_decision`
- 위치: `docs/prompt-config.yaml`

입력:

- `turn_data`
- `memory_policy`

출력:

- `candidates`
- `to_save`
- `to_skip`

출력 스키마:

```json
{
  "candidates": [
    {
      "type": "long_term|short_term",
      "key": "string",
      "value": "string",
      "confidence": 0.0,
      "contains_pii": false
    }
  ],
  "to_save": ["string"],
  "to_skip": [
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

- `docs/openapi-multiturn.yaml`

### 요청 스키마

필수 필드:

- `user_id`
- `session_id`
- `memories`

선택 필드:

- `policy`

`memories` 의 각 항목은 다음 필드를 가진다.

- `type`: `long_term` 또는 `short_term`
- `key`
- `value`
- `ttl_seconds`
- `pii`
- `confidence`

### 요청 예시

```json
{
  "user_id": "u123",
  "session_id": "s456",
  "memories": [
    {
      "type": "long_term",
      "key": "preferred_format",
      "value": "bullet",
      "confidence": 0.92,
      "pii": false
    },
    {
      "type": "long_term",
      "key": "interest_topic",
      "value": "retirement_fund",
      "confidence": 0.81,
      "pii": false
    },
    {
      "type": "short_term",
      "key": "last_viewed_contract",
      "value": "연금저축보험 A",
      "ttl_seconds": 3600,
      "confidence": 0.86,
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
  "saved": 2,
  "skipped": 1,
  "reason_codes": [
    "below_confidence_threshold"
  ]
}
```

## 저장 정책

기본 정책은 다음처럼 운영하는 것이 맞다.

- `allow_pii=false`
- `min_confidence=0.7`

의미:

- `confidence < min_confidence` 이면 저장하지 않는다.
- `pii=true` 이고 `allow_pii=false` 이면 저장하지 않는다.

실무 권장 규칙:

- `long_term` 은 사용자의 지속 선호만 저장한다.
- `short_term` 은 반드시 `ttl_seconds` 를 둔다.
- 동일한 `key` 가 있으면 최신 값으로 upsert 한다.
- 값은 문장 전체보다 정규화된 짧은 값으로 저장한다.

## 키 설계 권장안

키 이름은 검색과 갱신이 쉬운 형태로 고정하는 것이 좋다.

권장 예시:

- `preferred_format`
- `preferred_tone`
- `preferred_length`
- `interest_topic`
- `last_viewed_contract`
- `last_explained_rule`
- `last_compared_items`

피해야 할 예시:

- `memory1`
- `user_info`
- `misc_context`
- `last_message_full_text`

## `/chat` 과의 연동

`/chat` 요청의 `options.enable_memory_write` 를 `true` 로 두면, 오케스트레이션 레벨에서 메모리 저장 단계를 포함할 수 있다.

예시:

```json
{
  "session_id": "s456",
  "user_id": "u123",
  "message": "지난번처럼 불릿으로 정리해주고 이번엔 펀드 A랑 B도 비교해줘",
  "options": {
    "enable_memory_write": true
  }
}
```

운영 패턴은 두 가지다.

### 패턴 1. 일괄 처리

- `/chat` 안에서 답변 생성과 메모리 저장을 함께 처리

장점:

- 클라이언트 구현이 단순하다.

### 패턴 2. 분리 처리

- `/chat` 으로 답변 생성
- 별도로 `/memory/upsert` 호출

장점:

- 저장 여부를 서비스 레이어에서 더 엄격하게 제어할 수 있다.

## 읽기 사용법

현재 스펙에는 `memory read` 전용 API 는 정의돼 있지 않다. 따라서 읽기는 상위 오케스트레이터가 메모리 저장소에서 값을 가져와 다음 입력에 주입하는 방식으로 보는 것이 맞다.

주입 위치는 다음 두 가지다.

- `PlanRequest.context`
- `PlanRequest.profile`

또는 `/chat` 오케스트레이션 내부에서:

- 최근 세션 메모리 -> `recent_turns`, `summary`
- 장기 메모리 -> `profile.tone`, `profile.preferred_format` 등에 반영

## 권장 저장 판정 규칙

다음 기준으로 저장 여부를 판정하면 안정적이다.

저장:

- 사용자가 명시적으로 선호를 말한 경우
- 같은 관심 주제가 반복된 경우
- 다음 턴 해석에 직접 필요한 최근 맥락인 경우

저장 보류:

- 단 한 번 나온 취향인지 불명확한 경우
- 모델이 추론한 값이라 확신이 낮은 경우

저장 금지:

- 민감정보
- 규정상 장기 보관 금지 정보
- 원문 전체 대화

## 운영 예시

사용자 발화:

```text
앞으로 답변은 불릿으로 짧게 해주고, 지난번 본 연금저축보험 A 기준으로 다시 설명해줘.
```

추출 후보:

```json
{
  "candidates": [
    {
      "type": "long_term",
      "key": "preferred_format",
      "value": "bullet",
      "confidence": 0.98,
      "contains_pii": false
    },
    {
      "type": "long_term",
      "key": "preferred_length",
      "value": "short",
      "confidence": 0.94,
      "contains_pii": false
    },
    {
      "type": "short_term",
      "key": "last_viewed_contract",
      "value": "연금저축보험 A",
      "confidence": 0.87,
      "contains_pii": false
    }
  ],
  "to_save": [
    "preferred_format",
    "preferred_length",
    "last_viewed_contract"
  ],
  "to_skip": []
}
```

## 구현 체크리스트

- 메모리 후보 추출 프롬프트를 답변 이후 단계에 둔다.
- `short_term` 저장 시 TTL 을 강제한다.
- `pii` 와 `confidence` 를 함께 검사한다.
- 저장 키를 정규화한다.
- 다음 턴 시작 전에 장기/세션 메모리를 `context` 와 `profile` 에 주입한다.

## 요약

이 저장소의 `memory` 기능은 "사용자 프로필과 세션 맥락을 선별 저장하는 후처리 단계" 로 이해하면 된다.

- 장기 메모리: 선호와 반복 관심사
- 세션 메모리: 직전 조회/설명 맥락
- 저장 기준: 높은 가치, 낮은 민감도, 충분한 신뢰도
- 저장 인터페이스: `/memory/upsert`

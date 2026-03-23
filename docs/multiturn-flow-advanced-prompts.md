# 멀티턴 고급 흐름 프롬프트 템플릿

기준: [multiturn-dialog-flow-advanced.md](multiturn-dialog-flow-advanced.md)의 고급 멀티턴 흐름과 [multiturn-flow-prompts.md](multiturn-flow-prompts.md)의 기존 상세 프롬프트.

## 0) 공통 규칙 프롬프트 (Global System)

```text
역할: 당신은 멀티턴 RAG 오케스트레이션의 고급 실행 모델이다.
목표: 사실 기반, 근거 중심, 사용자 선호 반영 응답을 생성한다.
규칙:
1) 항상 JSON으로만 출력한다.
2) 추측이 필요한 경우 uncertainty를 명시한다.
3) 안전/정책 위반 가능 시 block 또는 safe_alternative를 제안한다.
4) 질문이 복합이면 질문 단위로 분해한다.
5) 최신성이 중요한 질의는 time_sensitivity=true로 표시한다.
6) API 사실성 데이터 조회와 RAG 정책성 지식 조회가 함께 필요하면 병렬 실행 계획을 제시한다.
```

## 1) 입력 파싱 (B)

```text
[System]
사용자 입력에서 의도, 엔티티, 질문 수, 제약조건, 최신성 요구를 추출하라.

[User]
message: {{user_message}}
recent_turns: {{recent_turns}}

[Output JSON Schema]
{
  "intent": "string",
  "entities": ["string"],
  "questions": [{"id":"q1","text":"string"}],
  "constraints": {"time_range":"string|null","format":"string|null","length":"string|null"},
  "time_sensitivity": true
}
```

## 2) 멀티질문 판정 및 분해 (C, D1, D2)

```text
[System]
질문을 단일/복합으로 판정하고 복합이면 최소 단위 질문으로 분해하라.

[User]
parsed_input: {{parsed_input}}

[Output JSON Schema]
{
  "is_compound": true,
  "questions": [
    {"id":"q1","text":"string","depends_on":[]},
    {"id":"q2","text":"string","depends_on":["q1"]}
  ],
  "strategy": "single|compound_parallel|compound_sequential|mixed"
}
```

## 3) 컨텍스트/개인화 로드 요약 (M0, P0)

```text
[System]
세션 컨텍스트와 사용자 프로필을 답변 생성에 필요한 최소 형태로 정규화하라.

[User]
context_raw: {{context_raw}}
profile_raw: {{profile_raw}}

[Output JSON Schema]
{
  "context": {"summary":"string","open_loops":["string"],"facts":["string"]},
  "profile": {"tone":"concise|balanced|detailed","format":"paragraph|bullet|table","language":"ko"}
}
```

## 4) 정책 사전 검사 (G0, GX)

```text
[System]
입력 내용의 정책 위반 여부를 판정하라.

[User]
message: {{user_message}}
policy_rules: {{policy_rules}}

[Output JSON Schema]
{
  "status":"pass|warn|block",
  "reason_codes":["string"],
  "safe_alternative":"string|null"
}
```

## 5) 데이터 소스 및 검색 전략 결정 (E, E1)

```text
[System]
각 질문에 대해 API 조회, RAG 검색, 또는 혼합 실행이 필요한지 결정하라.

[User]
questions: {{questions}}
context: {{context}}

[Output JSON Schema]
{
  "retrieval_required": true,
  "plan":[
    {
      "question_id":"q1",
      "need_retrieval":true,
      "mode":"api|keyword|vector|hybrid",
      "source_type":"api|rag|api+rag",
      "why":"string"
    }
  ]
}
```

## 6) 용어 정규화 및 표준 용어 매핑 (E2)

```text
[System]
질문, 개인화 템플릿, 문서 표현 간 용어 차이를 줄이기 위해 표준 용어를 정의하라.
검색 recall을 높이기 위한 확장 용어는 허용하되, 최종 답변에 사용할 고객 표현도 함께 정하라.

[User]
question: {{question}}
profile: {{profile}}
domain_terms: {{domain_terms}}
personal_template: {{personal_template}}

[Output JSON Schema]
{
  "canonical_terms": [
    {
      "source":"string",
      "canonical":"string",
      "search_aliases":["string"],
      "answer_expression":"string",
      "why":"string"
    }
  ],
  "must_keep":["string"],
  "must_avoid":["string"]
}
```

## 7) 쿼리 재작성 및 API 질의 정규화 (F1)

```text
[System]
질문별 실행 성능을 높이도록 검색 쿼리 또는 API 질의 파라미터를 정규화하라.

[User]
question: {{question}}
constraints: {{constraints}}
domain_terms: {{domain_terms}}
slots: {{slots}}

[Output JSON Schema]
{
  "query":"string",
  "alt_queries":["string"],
  "api_params":{"contract_id":"string|null","date_range":"string|null","fields":["string"]},
  "filters":{"time_range":"string|null","domain":["string"],"language":"ko|en|null"}
}
```

## 8) 의존 질의 판정 및 실행 단계 구성 (F2, F3, F4)

```text
[System]
질문 DAG를 생성하고 병렬/순차 실행 단계를 산출하라.

[User]
questions: {{questions}}

[Output JSON Schema]
{
  "dag":[{"from":"q1","to":"q2"}],
  "execution_stages":[["q1","q3"],["q2"]],
  "notes":"string"
}
```

## 9) 검색/API 결과 근거 추출 및 점수화 (F5, F6)

```text
[System]
검색 후보 또는 API 결과에서 답변 근거를 추출하고 스코어링하라.

[User]
candidates: {{candidates}}
question: {{question}}

[Output JSON Schema]
{
  "evidence":[
    {
      "doc_id":"string",
      "chunk_id":"string",
      "quote":"string",
      "relevance":0.91,
      "freshness":0.72,
      "trust":0.88,
      "source_type":"api|rag"
    }
  ],
  "deduped": true
}
```

## 10) 근거 충분성 평가 및 재검색 또는 재조회 루프 (V0, V1)

```text
[System]
현재 근거가 답변에 충분한지 판정하고 부족하면 재검색/재조회 액션을 제시하라.

[User]
question: {{question}}
evidence: {{evidence}}

[Output JSON Schema]
{
  "sufficient": false,
  "gaps":["string"],
  "retry_actions":[
    {"type":"expand_query|expand_time|add_source|re-decompose|retry_api","payload":"string"}
  ]
}
```

## 11) 질문별 중간 응답 생성 (S0)

```text
[System]
각 질문에 대해 근거 기반 중간답을 생성하라. 근거 없는 단정은 금지한다.

[User]
questions: {{questions}}
evidence_by_question: {{evidence_by_question}}

[Output JSON Schema]
{
  "drafts":[
    {
      "question_id":"q1",
      "answer":"string",
      "confidence":0.84,
      "citations":[{"doc_id":"d1","chunk_id":"c3"}]
    }
  ]
}
```

## 12) 충돌/모순 감지 및 해결 (S1, S2)

```text
[System]
질문 간 또는 근거 간 충돌을 감지하고 우선순위 규칙으로 해결하라.
우선순위: 정책 최신성 > 신뢰도 > 응답 일관성.

[User]
drafts: {{drafts}}
evidence: {{evidence}}

[Output JSON Schema]
{
  "has_conflict": true,
  "conflicts":[{"type":"fact_conflict","items":["q1","q2"]}],
  "resolution":[{"question_id":"q2","decision":"string","why":"string"}]
}
```

## 13) 개인화 템플릿 초안 생성 (T0)

```text
[System]
계약정보 등 개인 관련 질문이면 답변 템플릿 기반 초안을 먼저 생성하라.
이 단계는 개인 맥락과 응답 뼈대를 만드는 단계이며, 사실 확정은 하지 않는다.

[User]
question: {{question}}
profile: {{profile}}
personal_template: {{personal_template}}
user_facts: {{user_facts}}

[Output JSON Schema]
{
  "template_answer":"string",
  "used_template":true,
  "notes":"string"
}
```

## 14) 검색 기반 최종답변 생성 (T1)

```text
[System]
질문별 검색 근거 답변과 개인화 템플릿 초안을 결합해 검색 기반 최종답변을 생성하라.
템플릿 초안은 개인 맥락과 구조 힌트로만 사용하고, 사실 확정은 검색/API 근거를 우선한다.
이 단계에서 표준 용어를 함께 통일하라.

[User]
question: {{question}}
drafts: {{resolved_drafts}}
template_answer: {{template_answer}}
canonical_terms: {{canonical_terms}}
citations: {{citations}}

[Output JSON Schema]
{
  "final_search_answer":"string",
  "sections":[{"title":"string","body":"string"}],
  "applied_terms":[
    {"source":"string","canonical":"string","answer_expression":"string"}
  ],
  "citations":[{"doc_id":"string","chunk_id":"string"}]
}
```

## 15) UXW 후처리 (T2)

```text
[System]
검색 기반 최종답변이 생성된 뒤 고객경험 표현만 마지막 단계에서 반영하라.
답변 의미를 바꾸지 말고, 날짜, 숫자, 조건, 예외는 유지한다.

[User]
answer: {{final_search_answer}}
profile: {{profile}}

[Output JSON Schema]
{
  "uxw_answer":"string",
  "applied":{"uxw":"string"}
}
```

## 16) 멀티턴 연결문 생성 (T3)

```text
[System]
이전 대화 맥락을 1~2문장으로 연결하고 다음 액션을 제안하라.

[User]
recent_turns: {{recent_turns}}
current_answer: {{uxw_answer}}

[Output JSON Schema]
{
  "bridged_answer":"string",
  "followups":["string","string"]
}
```
## 17) 메모리 업데이트 후보 추출/저장 (R0, R1, R2, R3)

```text
[System]
저장 가치가 높은 정보만 메모리 후보로 추출하고 정책 통과 여부를 판정하라.

[User]
turn_data: {{turn_data}}
memory_policy: {{memory_policy}}

[Output JSON Schema]
{
  "candidates":[
    {"type":"long_term|short_term","key":"string","value":"string","confidence":0.0,"contains_pii":false}
  ],
  "to_save":["string"],
  "to_skip":[{"key":"string","reason":"string"}]
}
```

## 18) 안전 대체 응답 (GY)

```text
[System]
정책상 차단 시, 가능한 범위의 안전한 대체 답변을 제공하라.

[User]
blocked_reason: {{blocked_reason}}
user_intent: {{user_intent}}

[Output JSON Schema]
{
  "safe_response":"string",
  "explanation":"string",
  "allowed_next_steps":["string"]
}
```

## 19) 오케스트레이터 연결 순서 (권장)

1. `Global System`
2. `B -> C/D`
3. `M0/P0 + G0`
4. `E -> E2 -> F1 -> F2/F3/F4 -> F5/F6`
5. `V0` 부족 시 `V1` 루프
6. `S0 -> S1/S2 -> T0 -> T1 -> T2 -> T3`
7. `R0/R1/R2(or R3)`
8. 정책 차단 시 언제든 `GY`로 단락 처리












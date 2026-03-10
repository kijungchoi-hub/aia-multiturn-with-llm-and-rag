# 멀티턴 기본 흐름 프롬프트 템플릿

기준: [multiturn-dialog-flow-basic.md](multiturn-dialog-flow-basic.md)의 `4) 멀티턴 기본 흐름`과 `5) 단계별 상세 흐름`.

## 0) 공통 규칙 프롬프트 (Global System)

```text
역할: 당신은 문서유형 필터 기반 멀티턴 RAG 오케스트레이션의 실행 모델이다.
목표: 현재 질문에 맞는 1차 검색 스코프를 빠르게 결정하고, 해당 스코프 기반 검색 결과를 근거로 답변한다.
규칙:
1) 항상 JSON으로만 출력한다.
2) 질문이 복합이면 질문 단위로 분해하고 질문별로 필터를 따로 정한다.
3) 첫 검색은 가능한 한 1개 문서유형 필터로 시작한다.
4) 근거가 부족할 때만 인접 필터로 확장한다.
5) 최종 응답에는 어떤 문서유형/문서를 근거로 사용했는지 드러낸다.
```

## 1) 사용자 입력 및 최근 턴 정리 (A, B)

```text
[System]
현재 질문과 최근 1~3턴에서 유지해야 할 핵심 맥락을 정리하라.

[User]
message: {{user_message}}
recent_turns: {{recent_turns}}

[Output JSON Schema]
{
  "current_question": "string",
  "context_entities": ["string"],
  "carry_over_context": {
    "product_name": "string|null",
    "task_name": "string|null",
    "menu_name": "string|null",
    "document_type": "string|null"
  },
  "open_followups": ["string"]
}
```

## 2) 질문 의도 분류 및 복합 질의 분해 (C)

```text
[System]
질문 의도를 분류하고, 복합 질문이면 최소 단위 질문으로 분해하라.
의도 범주: 절차 확인, 시스템 조작, 상품 설명, 기준/가능 여부, 고객 응대 문안 요청, 약관/조항 확인.

[User]
current_question: {{current_question}}
carry_over_context: {{carry_over_context}}

[Output JSON Schema]
{
  "is_compound": true,
  "intents": ["string"],
  "questions": [
    {
      "id": "q1",
      "text": "string",
      "intent": "절차 확인|시스템 조작|상품 설명|기준/가능 여부|고객 응대 문안 요청|약관/조항 확인"
    }
  ]
}
```

## 3) 1차 검색 스코프 결정 (D)

```text
[System]
각 질문에 대해 첫 검색에 사용할 1차 검색 스코프를 결정하라.
사용 가능한 필터: 업무매뉴얼, PC매뉴얼, 상품매뉴얼, 사업방법서, 상담스크립트, 약관.
판단 시 질문 신호와 맥락을 함께 반영하라.

[User]
questions: {{questions}}
carry_over_context: {{carry_over_context}}

[Output JSON Schema]
{
  "filter_plan": [
    {
      "question_id": "q1",
      "primary_filter": "업무매뉴얼|PC매뉴얼|상품매뉴얼|사업방법서|상담스크립트|약관",
      "why": "string"
    }
  ]
}
```

## 4) 필터 확장 순서 계획 (H)

```text
[System]
질문별 1차 필터가 부족할 경우를 대비해 인접 필터 확장 순서를 정하라.
한 번에 전체 필터로 넓히지 말고 최대 3단계까지만 제시하라.

[User]
filter_plan: {{filter_plan}}
questions: {{questions}}

[Output JSON Schema]
{
  "expansion_plan": [
    {
      "question_id": "q1",
      "sequence": ["상품매뉴얼", "약관", "사업방법서"],
      "reason": "string"
    }
  ]
}
```

## 5) 초기 검색 쿼리 생성 (E)

```text
[System]
문서유형 필터를 포함한 검색 쿼리를 생성하라.
핵심 엔티티, 행위 키워드, 문서유형 필터를 함께 반영하라.

[User]
question: {{question}}
primary_filter: {{primary_filter}}
context_entities: {{context_entities}}

[Output JSON Schema]
{
  "query": "string",
  "keywords": ["string"],
  "filter": "string",
  "alternatives": ["string"]
}
```

## 6) 검색 결과 평가 (F)

```text
[System]
검색 결과가 현재 질문에 답변하기에 충분한지 평가하라.
평가 기준: 질문 핵심어 직접 일치, 문서유형 적합성, 구체성, 질문별 근거 확보 여부.

[User]
question: {{question}}
selected_filter: {{selected_filter}}
results: {{results}}

[Output JSON Schema]
{
  "sufficient": false,
  "matched_points": ["string"],
  "gaps": ["string"],
  "top_evidence": [
    {
      "doc_id": "string",
      "doc_type": "string",
      "reason": "string"
    }
  ]
}
```

## 7) 재검색 또는 필터 확장 결정 (H, I, J)

```text
[System]
검색 결과가 부족하면 재검색 방식을 결정하라.
가능한 액션: 동의어 치환, 상품명/업무명 보정, 인접 필터 확장, 질문 재분해.

[User]
question: {{question}}
evaluation: {{evaluation}}
expansion_plan: {{expansion_plan}}

[Output JSON Schema]
{
  "retry_required": true,
  "actions": [
    {
      "type": "rewrite_query|normalize_entity|expand_filter|re_decompose",
      "payload": "string"
    }
  ],
  "next_filter": "string|null"
}
```

## 8) 근거 정리 (G)

```text
[System]
최종 응답에 사용할 근거를 질문별로 정리하라.
상위 1~3개 근거만 남기고, 어떤 문서유형인지 명확히 표시하라.

[User]
question: {{question}}
results: {{results}}

[Output JSON Schema]
{
  "evidence": [
    {
      "doc_id": "string",
      "doc_type": "업무매뉴얼|PC매뉴얼|상품매뉴얼|사업방법서|상담스크립트|약관",
      "title": "string",
      "snippet": "string",
      "usage": "direct_answer|supporting_note|exception"
    }
  ]
}
```

## 9) 멀티턴 맥락 반영 (L)

```text
[System]
현재 답변에 반영해야 할 멀티턴 맥락을 정리하라.
직전 상품명, 업무 주제, 문서유형, 미해결 후속질문을 유지하라.

[User]
recent_turns: {{recent_turns}}
carry_over_context: {{carry_over_context}}
evidence: {{evidence}}

[Output JSON Schema]
{
  "context_summary": "string",
  "carry_forward": {
    "product_name": "string|null",
    "task_name": "string|null",
    "document_type": "string|null"
  },
  "pending_followups": ["string"]
}
```

## 10) 최종 응답 합성 (M)

```text
[System]
질문에 직접 답하고, 핵심 근거와 필요한 예외/유의사항을 포함한 최종 응답을 합성하라.
답변 순서: 직접 답변 -> 핵심 근거 -> 예외/유의사항 -> 다음 행동 제안.

[User]
question: {{question}}
evidence: {{evidence}}
context_summary: {{context_summary}}

[Output JSON Schema]
{
  "answer": "string",
  "basis": [
    {
      "doc_type": "string",
      "title": "string"
    }
  ],
  "cautions": ["string"],
  "next_actions": ["string"]
}
```

## 11) 다음 턴용 컨텍스트 저장 (N)

```text
[System]
다음 턴에 유지할 최소 컨텍스트만 저장 후보로 추출하라.
저장 대상: 상품명, 업무 주제, 선택 문서유형, 미해결 후속 질문.

[User]
question: {{question}}
answer: {{answer}}
context_summary: {{context_summary}}

[Output JSON Schema]
{
  "session_context": {
    "product_name": "string|null",
    "task_name": "string|null",
    "document_type": "string|null"
  },
  "open_followups": ["string"]
}
```

## 12) 오케스트레이터 연결 순서 (권장)

1. `Global System`
2. `A/B -> C -> D`
3. `H(확장 계획 사전 구성) -> E -> F`
4. 부족 시 `H/I/J` 재시도
5. 충분 시 `G -> L -> M -> N`

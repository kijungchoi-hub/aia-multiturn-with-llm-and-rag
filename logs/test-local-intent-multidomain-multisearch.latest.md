# Local Intent MultiDomain MultiSearch Test

- Executed at: 2026-03-23T08:06:31.108Z
- Base URL: http://127.0.0.1:8080
- Status: passed
- JSON log: logs/test-local-intent-multidomain-multisearch.latest.json

## Intent Classification

- Greeting route: answer_direct
- Compound route: search
- Compound use_workflow: false
- Compound sub_questions: ["Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요."]

## Query Rewrite

- Supervisor rewritten_query: Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요.
- Judge suggested_rewrite: Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요. 기준일 절차 조건 예외
- Judge retry_allowed: true

## Rewrite Search Compare

- Original query: Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요.
- Rewritten query: Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요. 기준일 절차 조건 예외
- Top hit changed: false
- Original top1 score: 10 / reranker: 11
- Rewritten top1 score: 14 / reranker: 15.4

### Original Query Top Hits
- Local Runtime Rewrite Test [general] (docs/verification-summary-20260319-190945.md)
- Dify DSL “스켈레톤” 예시(YAML) [research] (docs/deep-research-report.md)
- 5.5 Workflow 사용 경계 [dialog] (docs/multiturn-dialog-flow-advanced.md)

### Rewritten Query Top Hits
- Local Runtime Rewrite Test [general] (docs/verification-summary-20260319-190945.md)
- 2) 문서유형 필터 정의 [dialog] (docs/multiturn-dialog-flow-basic.md)
- Dify DSL “스켈레톤” 예시(YAML) [research] (docs/deep-research-report.md)

## Search Summary

- Primary domains: research, general, memory, dialog
- Workflow domains: general, research
- Memory domains: memory, general, research

### Primary Top Hits
- Dify DSL “스켈레톤” 예시(YAML) [research] (docs/deep-research-report.md)
- 아키텍처 다이어그램 [general] (docs/deep-research-architecture-memo.md)
- 목적 [memory] (docs/memory-usage-guide.md)

### Workflow Top Hits
- 1. Dify 선택 기준 [general] (docs/deep-research-architecture-memo.md)
- Dify DSL “스켈레톤” 예시(YAML) [research] (docs/deep-research-report.md)
- Dify DSL “스켈레톤” 예시(YAML) [research] (docs/deep-research-report.md)

### Memory Top Hits
- memory-usage-guide.md [memory] (docs/memory-usage-guide.md)
- 방식 1. HTTP Request 노드로 바로 호출 [general] (docs/dify-local-runtime.md)
- Executive summary [research] (docs/deep-research-report.md)

## Chat Result

- Route: search
- Retrieval used: true
- Search retry count: 0
- Citation count: 3

### Citations
- Local Runtime Rewrite Test (doc-457)
- Dify DSL “스켈레톤” 예시(YAML) (doc-75)
- 5.5 Workflow 사용 경계 (doc-245)

### Answer Preview

```text
질문: Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요.
로컬 실험 런타임 기준 정리:
1. Local Runtime Rewrite Test: - original query: `Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요.`
2. Dify DSL “스켈레톤” 예시(YAML): ```yaml
3. 5.5 Workflow 사용 경계: - 메인 멀티턴 상태 제어는 Workflow로 옮기지 않는다.
대화 요약 반영: local integration test
```

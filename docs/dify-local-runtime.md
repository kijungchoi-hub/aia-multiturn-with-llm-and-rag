# Dify Local Runtime

이 저장소는 원래 Dify 워크플로우 자산과 문서 중심 구조였고, 실제 HTTP 실행 백엔드는 없었다. 이 문서는 로컬에서 Dify가 호출할 수 있는 실험용 런타임을 붙이는 방법을 정리한다.

## 포함된 것

- `src/server.mjs`
  - `openapi-multiturn.yaml` 초안에 맞춘 로컬 API 서버
- `scripts/run-local-runtime.ps1`
  - Windows PowerShell에서 `.env`를 읽고 서버를 실행하는 스크립트
- `scripts/smoke-test-runtime.mjs`
  - 서버 기동 후 핵심 엔드포인트를 점검하는 스모크 테스트
- `.runtime/memory-store.json`
  - 실행 중 생성되는 세션/장기 메모리 저장 파일

## 빠른 실행

```powershell
Copy-Item .env.example .env
npm start
```

PowerShell을 선호하면 아래도 가능하다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-local-runtime.ps1
```

정상 기동 확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

## 제공 엔드포인트

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

## Dify에서 붙이는 방법

### 방식 1. HTTP Request 노드로 바로 호출

1. Dify에서 새 `Chatflow` 또는 `Workflow`를 만든다.
2. HTTP Request 노드 URL을 `http://host.docker.internal:8080/chat` 또는 Dify가 같은 호스트에서 돌면 `http://127.0.0.1:8080/chat` 으로 지정한다.
3. `POST`와 `application/json`을 사용한다.
4. 요청 본문 예시는 아래를 사용한다.

```json
{
  "conversation_id": "{{sys.conversation_id}}",
  "user_id": "{{sys.user_id}}",
  "message": "{{#sys.query#}}",
  "context": {
    "summary": "{{#conversation.summary#}}"
  },
  "profile": {
    "tone": "balanced",
    "language": "ko"
  },
  "options": {
    "top_k": 5,
    "include_citations": true,
    "enable_memory_write": true
  }
}
```

5. 응답에서 `answer`, `citations`, `debug.route` 등을 후속 노드에 매핑한다.

### 방식 2. OpenAPI 기반 Tool/Plugin 실험

`yaml/specs/openapi-multiturn.yaml`의 서버 URL을 로컬 런타임 기준으로 해석하면 된다.

- 로컬 직접 실행: `http://127.0.0.1:8080`
- Dify가 Docker 내부에서 실행 중이면: `http://host.docker.internal:8080`

## 현재 런타임의 성격

이 서버는 운영용 구현이 아니라 실험용이다.

- 검색: `docs/*.md`와 `data/MULTITURN_20260306.csv`를 로컬 코퍼스로 읽어 토큰 매칭 기반으로 검색한다.
- Judge: 검색 근거가 질문 핵심어를 어느 정도 덮는지 단순 판정한다.
- Workflow dispatch: 외부 업무 API 대신 mock 응답을 반환한다.
- Memory: `.runtime/memory-store.json`에 JSON으로 저장한다.

즉, Dify 오케스트레이션 구조를 실제로 붙여 보면서 노드 매핑, 입력/출력 스키마, 멀티턴 연결, 메모리 write 타이밍을 검증하는 용도다.

## 스모크 테스트

서버를 띄운 뒤 아래를 실행한다.

```powershell
npm run test:smoke
```

## 운영 API로 바꿀 때 교체 포인트

- `src/server.mjs`의 `hybridSearch`
  - Azure AI Search 호출로 교체
- `src/server.mjs`의 `workflowDispatch`
  - 실제 업무 API 또는 Dify Workflow 실행 API로 교체
- `src/server.mjs`의 `upsertMemory`
  - 파일 저장 대신 DB 또는 벡터/키값 저장소로 교체
- `src/server.mjs`의 `buildAnswer`
  - 실제 LLM 호출 또는 Dify 내부 생성 노드로 교체

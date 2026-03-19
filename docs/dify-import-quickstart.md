# Dify Import Quickstart

## 대상 파일

- `yaml/workflows/workflow_local_runtime_minimal.yml`

## 목적

- Dify import 성공 여부 확인
- 로컬 `http://host.docker.internal:8080/chat` 연동 확인
- `/chat` 응답 스키마와 Answer 노드 연결 확인

## 사용 순서

1. 이 저장소에서 `npm start` 로 로컬 런타임을 실행한다.
2. Dify에서 `yaml/workflows/workflow_local_runtime_minimal.yml` 을 import 한다.
3. HTTP Request 노드 URL이 현재 환경과 맞는지 확인한다.
4. Docker 내부 Dify면 `http://host.docker.internal:8080/chat` 를 사용한다.
5. Docker 밖에서 직접 실행 중인 Dify면 `http://127.0.0.1:8080/chat` 로 바꾼다.
6. Chatflow를 실행해서 질문을 보내고 응답이 반환되는지 확인한다.

## 포함된 최소 흐름

- `START`
- `LOCAL_RUNTIME_CHAT`
- `PARSE_RUNTIME_RESPONSE`
- `ANSWER`

## 주의

- 이 파일은 기존 `workflow_ver1.8.yml` 전체를 대체하지 않는다.
- 목적은 로컬 runtime 연결 검증이다.
- 연결 확인 후 기존 대형 워크플로우의 HTTP 요청 지점을 점진적으로 치환하는 것이 맞다.

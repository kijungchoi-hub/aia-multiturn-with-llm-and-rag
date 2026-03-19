const BASE_URL = process.env.RUNTIME_BASE_URL || "http://127.0.0.1:8080";

async function call(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const health = await fetch(`${BASE_URL}/health`).then((res) => res.json());
  console.log("health", health);

  const route = await call("/supervisor/route", {
    message: "지난번 설명한 상품 변경 기준일 다시 알려주고 지금 신청 가능한지도 알려줘",
    context: {
      recent_turns: [
        {
          role: "assistant",
          text: "직전 답변에서 적용 기준일은 추가 확인이 필요하다고 안내했다."
        }
      ]
    },
    profile: {
      tone: "concise",
      language: "ko"
    }
  });
  console.log("route", route.route, "workflow", route.use_workflow);

  const chat = await call("/chat", {
    conversation_id: "conv-smoke",
    user_id: "user-smoke",
    message: "Dify workflow 실험 환경에서 memory 저장도 되는지 알려줘",
    context: {
      summary: "사용자는 Dify 워크플로우 실험 환경을 만들고 있다."
    },
    profile: {
      tone: "balanced",
      language: "ko"
    },
    options: {
      top_k: 3,
      include_citations: true,
      enable_memory_write: true
    }
  });

  console.log("chat.route", chat.route);
  console.log("chat.citations", chat.citations.length);
  console.log("chat.answer.preview", String(chat.answer).slice(0, 160));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const SEARCH_TOP_K = Number(process.env.SEARCH_TOP_K || 5);
const MEMORY_STORE_PATH = path.resolve(
  ROOT_DIR,
  process.env.MEMORY_STORE_PATH || ".runtime/memory-store.json"
);

const STOP_WORDS = new Set([
  "은", "는", "이", "가", "을", "를", "에", "의", "와", "과", "도", "으로", "에서",
  "그리고", "또", "좀", "바로", "지금", "그", "저", "것", "수", "더", "한", "the", "and", "for", "with"
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !STOP_WORDS.has(token));
}

function ensureDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function readJsonSafe(targetPath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(targetPath, value) {
  ensureDir(targetPath);
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2), "utf8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r" && next === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 2;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => String(header).replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((current) => {
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = String(current[index] || "").trim();
    }
    return record;
  });
}

function guessDomain(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("memory")) return "memory";
  if (lower.includes("prompt")) return "prompt";
  if (lower.includes("dialog")) return "dialog";
  if (lower.includes("workflow")) return "workflow";
  if (lower.includes("report")) return "research";
  return "general";
}

function chunkMarkdown(filePath, content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let heading = path.basename(filePath);
  let buffer = [];

  function flush() {
    const text = buffer.join("\n").trim();
    if (!text) return;
    chunks.push({
      title: heading,
      content: text,
      metadata: {
        source_path: path.relative(ROOT_DIR, filePath).replace(/\\/g, "/"),
        domain: guessDomain(filePath),
        source_type: "markdown"
      }
    });
    buffer = [];
  }

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      heading = line.replace(/^#{1,6}\s+/, "").trim();
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    buffer.push(line);
  }

  flush();
  return chunks;
}

function loadCorpus() {
  const corpus = [];
  const docsDir = path.join(ROOT_DIR, "docs");
  const dataDir = path.join(ROOT_DIR, "data");

  for (const entry of fs.readdirSync(docsDir)) {
    if (!entry.endsWith(".md")) continue;
    const fullPath = path.join(docsDir, entry);
    corpus.push(...chunkMarkdown(fullPath, fs.readFileSync(fullPath, "utf8")));
  }

  const csvPath = path.join(dataDir, "MULTITURN_20260306.csv");
  if (fs.existsSync(csvPath)) {
    const rows = toObjects(parseCsv(fs.readFileSync(csvPath, "utf8")));
    for (const row of rows.slice(0, 150)) {
      const question = row["원질문"] || "";
      const answer = row["답변예시 (현업작성필요)"] || "";
      if (!question && !answer) continue;
      corpus.push({
        title: row["구분"] || "CSV Sample",
        content: `${question}\n${answer}`.trim(),
        metadata: {
          source_path: "data/MULTITURN_20260306.csv",
          domain: "faq",
          source_type: "csv",
          row_no: row["NO."] || ""
        }
      });
    }
  }

  return corpus.map((item, index) => ({
    doc_id: `doc-${index + 1}`,
    title: item.title,
    content: item.content,
    metadata: item.metadata,
    tokens: tokenize(`${item.title} ${item.content}`)
  }));
}

const corpus = loadCorpus();
const memoryStore = readJsonSafe(MEMORY_STORE_PATH, { sessions: {}, users: {} });

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function textResponse(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function createError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function recentTurnsToText(recentTurns = []) {
  return recentTurns.map((turn) => turn.text || turn).join(" ");
}

function detectPolicy(content = "") {
  const text = String(content);
  const reasons = [];
  if (/(주민등록번호|카드번호|비밀번호|password)/i.test(text)) reasons.push("sensitive_credentials");
  if (/(불법|해킹|우회|폭탄)/i.test(text)) reasons.push("unsafe_request");
  if (!reasons.length) return { status: "pass", reason_codes: [] };
  return {
    status: reasons.includes("unsafe_request") ? "block" : "warn",
    reason_codes: reasons
  };
}

function supervisorRoute({ message = "", context = {}, profile = {} }) {
  const text = String(message).trim();
  const recent = recentTurnsToText(context.recent_turns);
  const ambiguous = /(그거|그때|그 기준|다시 알려|그 신청)/.test(text) && !recent;
  const greeting = /^(안녕|hello|hi|반가워|고마워)/i.test(text);
  const searchish = /(기준|가능|절차|정책|약관|매뉴얼|신청|변경|조회|보험|상품|workflow|dify)/i.test(text);

  let route = "answer_direct";
  if (ambiguous) route = "clarify";
  else if (greeting) route = "answer_direct";
  else if (searchish || text.length > 20) route = "search";

  return {
    route,
    rewritten_query: route === "search" ? [text, recent].filter(Boolean).join(" ").trim() : null,
    sub_questions: route === "search" ? text.split(/[?？]|그리고/).map((part) => part.trim()).filter(Boolean) : [],
    filters: {
      product: /보험/.test(text) ? "insurance" : null,
      channel: /dify|workflow/i.test(text) ? "dify" : null,
      user_tier: profile?.tone === "detailed" ? "detailed" : null
    },
    clarifying_question: route === "clarify"
      ? "어떤 상품이나 직전 안내 내용을 기준으로 다시 확인할지 구체적으로 알려주세요."
      : null,
    use_workflow: /(신청|접수|dispatch|formatter|api)/i.test(text)
  };
}

function scoreDocument(queryTokens, doc, filters = {}) {
  let score = 0;
  const tokenSet = new Set(doc.tokens);

  for (const token of queryTokens) {
    if (tokenSet.has(token)) score += 1;
    if (doc.title.toLowerCase().includes(token)) score += 0.75;
  }

  const domain = String(doc.metadata.domain || "");
  if (filters.channel && domain.includes(filters.channel)) score += 0.5;
  if (filters.product && /insurance|faq/.test(domain)) score += 0.25;
  return score;
}

function hybridSearch({ query = "", top_k = SEARCH_TOP_K, filters = {} }) {
  const queryTokens = tokenize(query);
  const results = corpus
    .map((doc) => {
      const score = scoreDocument(queryTokens, doc, filters);
      return {
        doc_id: doc.doc_id,
        title: doc.title,
        content: doc.content.slice(0, 800),
        score,
        reranker_score: Number((score * 1.1).toFixed(3)),
        metadata: doc.metadata
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.reranker_score - a.reranker_score)
    .slice(0, Math.max(1, Number(top_k) || SEARCH_TOP_K));

  return { results };
}

function judgeEvidence({ question = "", evidence = [], retry_count = 0 }) {
  const questionTokens = tokenize(question);
  const evidenceTokens = new Set(tokenize(evidence.map((item) => item.content).join(" ")));
  const covered = questionTokens.filter((token) => evidenceTokens.has(token)).length;
  const coverage = questionTokens.length ? covered / questionTokens.length : 1;
  const sufficient = evidence.length >= 2 && coverage >= 0.3;

  return {
    verdict: sufficient ? "SUFFICIENT" : "INSUFFICIENT",
    missing: sufficient ? null : "질문 핵심어와 직접 일치하는 근거가 부족합니다.",
    suggested_rewrite: sufficient ? null : `${question} 기준일 절차 조건 예외`,
    retry_allowed: !sufficient && retry_count < 2
  };
}

function workflowDispatch({ workflow_type = "formatter", payload = {} }) {
  if (workflow_type === "async_job") {
    return {
      status: "pending",
      output: {
        ticket_id: `job-${Date.now()}`,
        accepted_payload_keys: Object.keys(payload)
      }
    };
  }
  if (workflow_type === "fact_api") {
    return {
      status: "success",
      output: {
        fact_status: "mocked",
        summary: "실험 환경에서는 외부 업무 API 대신 mock 응답을 반환합니다.",
        payload
      }
    };
  }
  return {
    status: "success",
    output: {
      formatted: true,
      payload
    }
  };
}

function buildAnswer({ route, question, evidence = [], workflow_result = {}, context = {} }) {
  if (route === "clarify") {
    return {
      answer: "직전 맥락만으로는 기준 대상이 불명확합니다. 상품명이나 직전 안내 문장을 함께 주시면 바로 이어서 정리하겠습니다.",
      citations: [],
      confidence: 0.35,
      uncertainty: "질문 대상이 모호합니다."
    };
  }

  if (route === "answer_direct" && !evidence.length) {
    return {
      answer: `질문을 확인했습니다. 현재 대화 맥락 기준으로는 추가 검색 없이 응답할 수 있는 범위입니다: ${question}`,
      citations: [],
      confidence: 0.55,
      uncertainty: "문서 근거를 직접 확인하지는 않았습니다."
    };
  }

  const summaryLines = evidence.slice(0, 3).map((item, index) => {
    const sentence = item.content.split(/\r?\n/).find((line) => line.trim()) || item.content;
    return `${index + 1}. ${item.title}: ${sentence.slice(0, 140)}`;
  });

  return {
    answer: [
      `질문: ${question}`,
      "",
      "로컬 실험 런타임 기준 정리:",
      ...summaryLines,
      workflow_result?.status ? `보조 workflow 상태: ${workflow_result.status}.` : null,
      context.summary ? `대화 요약 반영: ${context.summary}` : null
    ].filter(Boolean).join("\n"),
    citations: evidence.slice(0, 3).map((item) => ({ doc_id: item.doc_id, title: item.title })),
    confidence: evidence.length ? 0.78 : 0.42,
    uncertainty: evidence.length ? null : "검색 근거가 충분하지 않습니다."
  };
}

function upsertMemory({ user_id, conversation_id, session_memory = [], long_term_memory = [] }) {
  if (!user_id || !conversation_id) {
    throw createError("bad_request", "user_id and conversation_id are required");
  }

  memoryStore.sessions[conversation_id] = [
    ...(memoryStore.sessions[conversation_id] || []),
    ...session_memory
  ];
  memoryStore.users[user_id] = [
    ...(memoryStore.users[user_id] || []),
    ...long_term_memory
  ];
  writeJson(MEMORY_STORE_PATH, memoryStore);

  return {
    saved: session_memory.length + long_term_memory.length,
    skipped: 0,
    reason_codes: []
  };
}

function deriveMemoryPayload({ message, answer, profile }) {
  return {
    session_memory: [
      { key: "last_user_message", value: String(message).slice(0, 300) },
      { key: "last_answer_summary", value: String(answer).slice(0, 300) }
    ],
    long_term_memory: profile?.language
      ? [{ key: "preferred_language", value: profile.language, confidence: 0.95 }]
      : []
  };
}

async function handleChat(body) {
  const { conversation_id, user_id, message, context = {}, profile = {}, options = {} } = body;
  if (!conversation_id || !user_id || !message) {
    throw createError("bad_request", "conversation_id, user_id, message are required");
  }

  const policy = detectPolicy(message);
  if (policy.status === "block") {
    return {
      route: "answer_direct",
      answer: "요청 내용은 현재 실험 환경 정책상 처리할 수 없습니다.",
      citations: [],
      followups: ["안전한 범위의 질문으로 바꿔 주세요."],
      policy,
      debug: {
        trace_id: `trace-${Date.now()}`,
        route: "answer_direct",
        retrieval_used: false,
        search_retry_count: 0,
        workflow_used: false
      }
    };
  }

  const supervisor = supervisorRoute({ message, context, profile });
  let workflowResult = null;
  let evidence = [];
  let retryCount = 0;

  if (supervisor.use_workflow) {
    workflowResult = workflowDispatch({
      workflow_type: "fact_api",
      payload: { message, conversation_id }
    });
  }

  if (supervisor.route === "search") {
    let searchResult = hybridSearch({
      query: supervisor.rewritten_query,
      top_k: options.top_k || SEARCH_TOP_K,
      filters: supervisor.filters
    });
    evidence = searchResult.results;

    while (retryCount < (options.max_search_retries ?? 2)) {
      const judge = judgeEvidence({ question: message, evidence, retry_count: retryCount });
      if (judge.verdict === "SUFFICIENT" || !judge.retry_allowed) break;
      retryCount += 1;
      searchResult = hybridSearch({
        query: judge.suggested_rewrite,
        top_k: options.top_k || SEARCH_TOP_K,
        filters: supervisor.filters
      });
      evidence = searchResult.results;
    }
  }

  const answerResult = buildAnswer({
    route: supervisor.route,
    question: message,
    evidence,
    workflow_result: workflowResult,
    context
  });

  if (options.enable_memory_write !== false) {
    const memoryPayload = deriveMemoryPayload({ message, answer: answerResult.answer, profile });
    upsertMemory({ user_id, conversation_id, ...memoryPayload });
  }

  return {
    route: supervisor.route,
    answer: answerResult.answer,
    clarifying_question: supervisor.clarifying_question,
    citations: options.include_citations === false ? [] : answerResult.citations,
    followups: supervisor.route === "clarify"
      ? ["상품명 또는 직전 답변을 함께 보내주세요."]
      : ["같은 주제로 후속 질문을 이어서 테스트할 수 있습니다."],
    policy,
    debug: {
      trace_id: `trace-${Date.now()}`,
      route: supervisor.route,
      retrieval_used: supervisor.route === "search",
      search_retry_count: retryCount,
      workflow_used: Boolean(workflowResult)
    }
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/health") {
      jsonResponse(res, 200, {
        status: "ok",
        corpus_size: corpus.length,
        memory_store_path: path.relative(ROOT_DIR, MEMORY_STORE_PATH).replace(/\\/g, "/")
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/openapi.yaml") {
      const spec = fs.readFileSync(path.join(ROOT_DIR, "yaml/specs/openapi-multiturn.yaml"), "utf8");
      textResponse(res, 200, spec, "application/yaml; charset=utf-8");
      return;
    }

    if (req.method !== "POST") throw createError("not_found", "Not found", 404);
    const body = await readBody(req);

    if (url.pathname === "/policy/check") return jsonResponse(res, 200, { decision: detectPolicy(body.content), fixes: [] });
    if (url.pathname === "/supervisor/route") return jsonResponse(res, 200, supervisorRoute(body));
    if (url.pathname === "/search/hybrid") return jsonResponse(res, 200, hybridSearch(body));
    if (url.pathname === "/judge/evidence") return jsonResponse(res, 200, judgeEvidence(body));
    if (url.pathname === "/workflow/dispatch") return jsonResponse(res, 200, workflowDispatch(body));
    if (url.pathname === "/answer") return jsonResponse(res, 200, buildAnswer(body));
    if (url.pathname === "/memory/upsert") return jsonResponse(res, 200, upsertMemory(body));
    if (url.pathname === "/chat") return jsonResponse(res, 200, await handleChat(body));

    throw createError("not_found", "Not found", 404);
  } catch (error) {
    jsonResponse(res, error.status || 500, {
      error: {
        code: error.code || "internal_error",
        message: error.message || "Unexpected error"
      }
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local Dify runtime listening on http://${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
});

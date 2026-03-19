
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_URL = process.env.RUNTIME_BASE_URL || "http://127.0.0.1:8080";
const LOG_JSON_PATH = path.join(ROOT_DIR, "logs", "test-local-intent-multidomain-multisearch.latest.json");
const REPORT_MD_PATH = path.join(ROOT_DIR, "logs", "test-local-intent-multidomain-multisearch.latest.md");

async function getJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function postJson(pathname, body) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname} failed: ${JSON.stringify(payload)}`);
  return payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueDomains(results = []) {
  return [...new Set(results.map((item) => item?.metadata?.domain).filter(Boolean))];
}

function summarizeResults(results = [], limit = 3) {
  return results.slice(0, limit).map((item) => ({
    title: item.title,
    domain: item?.metadata?.domain ?? null,
    source_path: item?.metadata?.source_path ?? null,
    score: item.score,
    reranker_score: item.reranker_score
  }));
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `\uFEFF${JSON.stringify(value, null, 2)}`, "utf8");
}

function writeMarkdown(filePath, content) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `\uFEFF${content}`, "utf8");
}
function toMarkdown(report) {
  return [
    "# Local Intent MultiDomain MultiSearch Test",
    "",
    `- Executed at: ${report.executed_at}`,
    `- Base URL: ${report.base_url}`,
    `- Status: ${report.status}`,
    `- JSON log: logs/test-local-intent-multidomain-multisearch.latest.json`,
    "",
    "## Intent Classification",
    "",
    `- Greeting route: ${report.intent.greeting.route}`,
    `- Compound route: ${report.intent.compound.route}`,
    `- Compound use_workflow: ${report.intent.compound.use_workflow}`,
    `- Compound sub_questions: ${JSON.stringify(report.intent.compound.sub_questions)}`,
    "",
    "## Search Summary",
    "",
    `- Primary domains: ${report.search.primary.domains.join(", ")}`,
    `- Workflow domains: ${report.search.workflow.domains.join(", ")}`,
    `- Memory domains: ${report.search.memory.domains.join(", ")}`,
    "",
    "### Primary Top Hits",
    ...report.search.primary.top_hits.map((item) => `- ${item.title} [${item.domain}] (${item.source_path})`),
    "",
    "### Workflow Top Hits",
    ...report.search.workflow.top_hits.map((item) => `- ${item.title} [${item.domain}] (${item.source_path})`),
    "",
    "### Memory Top Hits",
    ...report.search.memory.top_hits.map((item) => `- ${item.title} [${item.domain}] (${item.source_path})`),
    "",
    "## Chat Result",
    "",
    `- Route: ${report.chat.route}`,
    `- Retrieval used: ${report.chat.debug.retrieval_used}`,
    `- Search retry count: ${report.chat.debug.search_retry_count}`,
    `- Citation count: ${report.chat.citations.length}`,
    "",
    "### Citations",
    ...report.chat.citations.map((item) => `- ${item.title} (${item.doc_id})`),
    "",
    "### Answer Preview",
    "",
    "```text",
    report.chat.answer_preview,
    "```",
    ""
  ].join("\n");
}
async function main() {
  const executedAt = new Date().toISOString();
  const compoundMessage = "Dify workflow 臾몄꽌? memory ?ъ슜 媛?대뱶瑜?媛숈씠 李얠븘???붿빟??二쇱꽭??";

  const health = await getJson("/health");
  console.log("[health]", JSON.stringify(health));

  const greetingRoute = await postJson("/supervisor/route", {
    message: "?덈뀞?섏꽭??,
    context: { recent_turns: [] },
    profile: { tone: "concise", language: "ko" }
  });
  assert(greetingRoute.route === "answer_direct", `expected answer_direct, got ${greetingRoute.route}`);
  console.log("[intent:greeting]", JSON.stringify(greetingRoute));

  const searchRoute = await postJson("/supervisor/route", {
    message: compoundMessage,
    context: { recent_turns: [] },
    profile: { tone: "detailed", language: "ko" }
  });
  assert(searchRoute.route === "search", `expected search, got ${searchRoute.route}`);
  assert(Array.isArray(searchRoute.sub_questions), "sub_questions should be an array");
  console.log("[intent:search]", JSON.stringify(searchRoute));

  const primarySearch = await postJson("/search/hybrid", {
    query: "Dify workflow memory",
    top_k: 6
  });
  assert(primarySearch.results.length >= 3, "expected at least 3 primary search results");
  const primaryDomains = uniqueDomains(primarySearch.results);
  assert(primaryDomains.length >= 2, `expected at least 2 domains, got ${primaryDomains.join(",")}`);
  console.log("[search:primary]", JSON.stringify({
    count: primarySearch.results.length,
    domains: primaryDomains,
    titles: primarySearch.results.slice(0, 3).map((item) => item.title)
  }));

  const workflowSearch = await postJson("/search/hybrid", {
    query: "Dify workflow architecture",
    top_k: 4,
    filters: { channel: "dify" }
  });
  assert(workflowSearch.results.length >= 1, "expected workflow-focused results");
  console.log("[search:workflow]", JSON.stringify({
    count: workflowSearch.results.length,
    domains: uniqueDomains(workflowSearch.results),
    titles: workflowSearch.results.slice(0, 3).map((item) => item.title)
  }));

  const memorySearch = await postJson("/search/hybrid", {
    query: "memory usage guide summary",
    top_k: 4
  });
  assert(memorySearch.results.length >= 1, "expected memory-focused results");
  console.log("[search:memory]", JSON.stringify({
    count: memorySearch.results.length,
    domains: uniqueDomains(memorySearch.results),
    titles: memorySearch.results.slice(0, 3).map((item) => item.title)
  }));

  const chat = await postJson("/chat", {
    conversation_id: "conv-intent-multidomain-multisearch",
    user_id: "user-local-test",
    message: compoundMessage,
    context: {
      summary: "local integration test"
    },
    profile: {
      tone: "detailed",
      language: "ko"
    },
    options: {
      top_k: 6,
      include_citations: true,
      enable_memory_write: true,
      max_search_retries: 2
    }
  });
  assert(chat.route === "search", `expected chat route search, got ${chat.route}`);
  assert(Array.isArray(chat.citations) && chat.citations.length >= 2, "expected at least 2 citations");
  assert(chat.debug?.retrieval_used === true, "expected retrieval_used to be true");
  console.log("[chat]", JSON.stringify({
    route: chat.route,
    citations: chat.citations,
    debug: chat.debug,
    answer_preview: String(chat.answer).slice(0, 240)
  }));

  const report = {
    executed_at: executedAt,
    base_url: BASE_URL,
    status: "passed",
    health,
    intent: {
      greeting: greetingRoute,
      compound: searchRoute
    },
    search: {
      primary: {
        count: primarySearch.results.length,
        domains: primaryDomains,
        top_hits: summarizeResults(primarySearch.results)
      },
      workflow: {
        count: workflowSearch.results.length,
        domains: uniqueDomains(workflowSearch.results),
        top_hits: summarizeResults(workflowSearch.results)
      },
      memory: {
        count: memorySearch.results.length,
        domains: uniqueDomains(memorySearch.results),
        top_hits: summarizeResults(memorySearch.results)
      }
    },
    chat: {
      route: chat.route,
      citations: chat.citations,
      debug: chat.debug,
      answer_preview: String(chat.answer).slice(0, 600)
    },
    artifacts: {
      json_log: "logs/test-local-intent-multidomain-multisearch.latest.json",
      markdown_report: "logs/test-local-intent-multidomain-multisearch.latest.md"
    }
  };

  writeJson(LOG_JSON_PATH, report);
  writeMarkdown(REPORT_MD_PATH, toMarkdown(report));

  console.log(`[artifact:json] ${report.artifacts.json_log}`);
  console.log(`[artifact:md] ${report.artifacts.markdown_report}`);
  console.log("[result] local intent/multi-domain/multi-search test passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

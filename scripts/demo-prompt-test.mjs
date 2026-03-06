import fs from "node:fs";
import path from "node:path";

function readConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse ${configPath}. This demo expects YAML-compatible JSON content. ${err.message}`
    );
  }
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined) return `{{${key}}}`;
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  });
}

function buildPrompt(globalSystem, node, vars) {
  const userText = renderTemplate(node.user_template, vars);
  return [
    "=== SYSTEM ===",
    globalSystem,
    "",
    `=== NODE (${node.id}:${node.name}) SYSTEM ===`,
    node.system,
    "",
    "=== USER ===",
    userText,
    "",
    "=== EXPECTED OUTPUT SCHEMA ===",
    JSON.stringify(node.output_schema, null, 2),
  ].join("\n");
}

function parseArgs(argv) {
  const opts = {
    config: "docs/prompt-config.yaml",
    nodeId: null,
    csv: null,
    row: 1,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--csv" && argv[i + 1]) {
      opts.csv = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--row" && argv[i + 1]) {
      opts.row = Number(argv[i + 1]) || 1;
      i += 1;
      continue;
    }
    if (!opts.config || opts.config === "docs/prompt-config.yaml") {
      if (a.endsWith(".yaml") || a.endsWith(".yml") || a.endsWith(".json")) {
        opts.config = a;
        continue;
      }
    }
    if (!opts.nodeId) {
      opts.nodeId = a;
    }
  }
  return opts;
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

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => String(h).replace(/^\uFEFF/, "").trim());
  const objects = [];
  for (let r = 1; r < rows.length; r += 1) {
    const rec = {};
    const current = rows[r];
    for (let c = 0; c < headers.length; c += 1) {
      rec[headers[c]] = (current[c] ?? "").trim();
    }
    if (Object.values(rec).every((v) => String(v).trim() === "")) continue;
    objects.push(rec);
  }
  return objects;
}

function readCsvRow(csvPath, rowNumber) {
  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(raw);
  const idx = Math.max(1, Number(rowNumber) || 1) - 1;
  if (idx >= rows.length) {
    throw new Error(`row out of range: ${idx + 1} > ${rows.length}`);
  }
  const row = rows[idx];
  return {
    no: row["NO."] ?? "",
    question: row["원질문"] ?? "",
    answer: row["답변예시 (현업작성필요)"] ?? "",
    note: row["비고"] ?? "",
    category: row["구분"] ?? "",
  };
}

function applyCsvToDemoContext(baseVars, csvRow) {
  const vars = { ...baseVars };
  const question = (csvRow.question || "").trim();
  const answer = (csvRow.answer || "").trim();

  if (question) {
    vars.user_message = question;
    vars.question = question;
    vars.questions = [
      { id: "q1", text: question },
      { id: "q2", text: "위 질문의 후속/정책/제약 관련 확인" },
    ];
    vars.parsed_input = {
      intent: "qa_from_csv",
      questions: [{ id: "q1", text: question }],
    };
  }

  if (answer) {
    vars.answer = answer;
    vars.personalized_answer = answer;
    vars.drafts = [{ question_id: "q1", answer }];
    vars.resolved_drafts = [{ question_id: "q1", answer }];
  }

  vars.turn_data = {
    ...(vars.turn_data || {}),
    csv_no: csvRow.no || "",
    csv_category: csvRow.category || "",
  };

  return vars;
}

function main() {
  const cwd = process.cwd();
  const opts = parseArgs(process.argv);
  const configPath = path.resolve(cwd, opts.config);
  const config = readConfig(configPath);
  let vars = config.demo_context || {};

  if (opts.csv) {
    const csvPath = path.resolve(cwd, opts.csv);
    const csvRow = readCsvRow(csvPath, opts.row);
    vars = applyCsvToDemoContext(vars, csvRow);
    vars.__csv_meta = {
      path: csvPath,
      row: opts.row,
      no: csvRow.no,
      category: csvRow.category,
    };
  }

  const targetNodes = opts.nodeId
    ? config.nodes.filter((n) => n.id === opts.nodeId)
    : config.nodes.filter((n) => config.pipeline.includes(n.id));

  if (targetNodes.length === 0) {
    console.error(`No nodes found for id=${opts.nodeId || "(pipeline)"}`);
    process.exit(1);
  }

  console.log(`# Prompt Demo`);
  console.log(`config: ${configPath}`);
  if (vars.__csv_meta) {
    console.log(
      `csv: ${vars.__csv_meta.path} (row=${vars.__csv_meta.row}, NO=${vars.__csv_meta.no}, category=${vars.__csv_meta.category})`
    );
  }
  console.log(`nodes: ${targetNodes.map((n) => n.id).join(", ")}`);
  console.log("");

  for (const node of targetNodes) {
    const prompt = buildPrompt(config.global_system, node, vars);
    console.log(prompt);
    console.log("\n" + "-".repeat(80) + "\n");
  }
}

main();

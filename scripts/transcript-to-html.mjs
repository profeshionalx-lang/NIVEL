#!/usr/bin/env node
// Конвертирует verbose_json транскрипт Groq/Whisper в одностраничный HTML
// с таймкодами, цветовой подсветкой неуверенных сегментов и пояснениями.
//
// Запуск:
//   node scripts/transcript-to-html.mjs <path>.transcript.json [output.html]

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Использование: node scripts/transcript-to-html.mjs <file>.transcript.json [out.html]");
  process.exit(1);
}

const raw = await readFile(inputPath, "utf8");
const data = JSON.parse(raw);
const segments = Array.isArray(data.segments) ? data.segments : [];

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const totalDuration = typeof data.duration === "number" ? data.duration : 0;

const lowConfidence = segments.filter((s) => s.avg_logprob < -0.6).length;
const veryLow = segments.filter((s) => s.avg_logprob < -1.0).length;

const segmentsHtml = segments
  .map((s) => {
    const text = escapeHtml((s.text ?? "").trim());
    const cls = s.avg_logprob < -1.0 ? "seg low" : s.avg_logprob < -0.6 ? "seg mid" : "seg";
    const conf = (s.avg_logprob ?? 0).toFixed(2);
    return `<div class="${cls}" data-conf="${conf}"><span class="ts">${fmtTime(s.start)}</span><span class="txt">${text}</span></div>`;
  })
  .join("\n");

const fullText = segments.map((s) => (s.text ?? "").trim()).join(" ");

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Транскрипт — ${escapeHtml(basename(inputPath, ".json"))}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
         max-width: 860px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; background: #fafafa; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f0f10; color: #e6e6e6; }
    header { border-color: #2a2a2a !important; }
    .meta { color: #888 !important; }
    .seg .ts { color: #888 !important; }
    .seg.mid { background: rgba(255, 200, 0, 0.10) !important; }
    .seg.low { background: rgba(255, 80, 80, 0.15) !important; }
    .tab { background: #1a1a1a; color: #e6e6e6; border-color: #333; }
    .tab.active { background: #2a2a2a; }
    .toolbar { border-color: #2a2a2a; }
    pre { background: #1a1a1a; color: #e6e6e6; }
  }
  header { border-bottom: 1px solid #e0e0e0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { margin: 0 0 0.5rem; font-size: 1.4rem; }
  .meta { color: #666; font-size: 0.9rem; }
  .meta b { color: inherit; }
  .toolbar { display: flex; gap: 0.5rem; padding: 0.75rem 0; border-bottom: 1px solid #e0e0e0; margin-bottom: 1rem; position: sticky; top: 0; background: inherit; z-index: 10; }
  .tab { padding: 0.4rem 0.9rem; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.9rem; }
  .tab.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
  .tab:hover { opacity: 0.85; }
  .view { display: none; }
  .view.active { display: block; }
  .seg { display: flex; gap: 0.75rem; padding: 0.3rem 0.5rem; border-radius: 4px; margin-bottom: 0.15rem; }
  .seg .ts { color: #999; font-variant-numeric: tabular-nums; flex-shrink: 0; width: 3.5rem; font-size: 0.85rem; padding-top: 0.15rem; }
  .seg .txt { flex: 1; }
  .seg.mid { background: rgba(255, 180, 0, 0.10); }
  .seg.low { background: rgba(255, 80, 80, 0.10); }
  .seg.mid::after, .seg.low::after { content: attr(data-conf); color: #aaa; font-size: 0.75rem; align-self: flex-start; padding-top: 0.2rem; }
  pre { white-space: pre-wrap; word-wrap: break-word; background: #fff; padding: 1rem; border-radius: 6px; border: 1px solid #e0e0e0; }
  .legend { font-size: 0.85rem; color: #777; margin-bottom: 1rem; }
  .legend span { padding: 1px 6px; border-radius: 3px; margin: 0 4px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(basename(inputPath, ".transcript.json"))}</h1>
  <div class="meta">
    Длительность: <b>${fmtTime(totalDuration)}</b> ·
    Сегментов: <b>${segments.length}</b> ·
    Модель: <b>${escapeHtml(data.model ?? "—")}</b> ·
    Язык: <b>${escapeHtml(data.language ?? "ru")}</b> ·
    Низкая уверенность: <b>${lowConfidence}</b> · Очень низкая: <b>${veryLow}</b>
  </div>
</header>

<div class="toolbar">
  <button class="tab active" data-view="segments">По сегментам</button>
  <button class="tab" data-view="plain">Сплошной текст</button>
  <button class="tab" data-view="raw">JSON</button>
</div>

<div class="legend">
  <span style="background: rgba(255,180,0,0.10)">желтое</span> — средняя уверенность (avg_logprob &lt; -0.6) ·
  <span style="background: rgba(255,80,80,0.10)">красное</span> — низкая уверенность (&lt; -1.0)
</div>

<div class="view active" id="view-segments">
  ${segmentsHtml}
</div>

<div class="view" id="view-plain">
  <pre>${escapeHtml(fullText)}</pre>
</div>

<div class="view" id="view-raw">
  <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
</div>

<script>
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("view-" + tab.dataset.view).classList.add("active");
    });
  });
</script>
</body>
</html>
`;

const outArg = process.argv[3];
const dir = dirname(inputPath);
const stem = basename(inputPath, extname(inputPath)).replace(/\.transcript$/, "");
const outPath = outArg || join(dir, `${stem}.transcript.html`);

await writeFile(outPath, html, "utf8");
console.log(`✅ HTML: ${outPath}`);
console.log(`   ${segments.length} сегментов, ${lowConfidence} среднеуверенных, ${veryLow} низкоуверенных`);

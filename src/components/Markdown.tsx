/**
 * Small, safe Markdown renderer for assistant answers.
 * Builds React elements directly — never injects HTML — so text from the AI can't run code.
 * Supports: paragraphs, line breaks, # headings, - / * / • and 1. lists, tables, ``` code
 * blocks, > quotes, --- rules, **bold**, *italic* / _italic_, `code`, ~~strike~~ and
 * [links](https://…) (http/https only, opened in a new tab).
 */
import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: string[]; start: number }
  | { kind: "table"; head: string[]; rows: string[][]; align: ("left" | "right" | "center")[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "hr" };

const BULLET = /^\s*(?:[-*+•])\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s*(#{1,4})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^\s*```/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of text while streaming)
      out.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    const h = line.match(HEADING);
    if (h) { out.push({ kind: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (RULE.test(line)) { out.push({ kind: "hr" }); i++; continue; }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left") as "left" | "right" | "center");
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push({ kind: "table", head, rows, align });
      continue;
    }
    if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = !BULLET.test(line);
      const start = ordered ? Number(line.match(NUMBER)![1]) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? lines[i].match(NUMBER) : lines[i].match(BULLET);
        if (m) { items.push(ordered ? m[2] : m[1]); i++; continue; }
        // indented continuation of the previous item
        if (items.length && /^\s{2,}\S/.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i])) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; continue; }
        break;
      }
      out.push({ kind: ordered ? "ol" : "ul", items, start });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push({ kind: "quote", lines: q });
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !/^\s*```/.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i]) && !RULE.test(lines[i])
      && !(lines[i].includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) && !/^\s*>/.test(lines[i])) p.push(lines[i++]);
    if (p.length) out.push({ kind: "p", lines: p });
    else { out.push({ kind: "p", lines: [lines[i]] }); i++; } // safety: always advance
  }
  return out;
}

/** Inline formatting. Unclosed markers are left as plain text (e.g. while streaming). */
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n][\s\S]*?\*\*|(?<![\w])__[^_\s][^_\n]*?__(?![\w]))|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*?\*|(?<![\w])_[^_\s][^_\n]*?_(?![\w]))/g;

function inline(text: string, keyBase = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0], key = `${keyBase}${n++}`;
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), `${key}.`)}</strong>);
    else if (m[3]) out.push(<del key={key}>{inline(tok.slice(2, -2), `${key}.`)}</del>);
    else if (m[4]) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const href = safeUrl(lm[2]);
      out.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{inline(lm[1], `${key}.`)}</a>
        : <Fragment key={key}>{lm[1]}</Fragment>);
    } else if (m[5]) out.push(<em key={key}>{inline(tok.slice(1, -1), `${key}.`)}</em>);
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function safeUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

const withBreaks = (lines: string[], key: string) =>
  lines.map((l, i) => <Fragment key={`${key}-${i}`}>{i > 0 && <br />}{inline(l, `${key}-${i}-`)}</Fragment>);

export default function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="md">
      {blocks.map((b, i) => {
        const k = String(i);
        switch (b.kind) {
          case "p": return <p key={k}>{withBreaks(b.lines, k)}</p>;
          case "h": return b.level <= 2 ? <h3 key={k} className="md-h">{inline(b.text, k)}</h3> : <h4 key={k} className="md-h4">{inline(b.text, k)}</h4>;
          case "ul": return <ul key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}-`)}</li>)}</ul>;
          case "ol": return <ol key={k} start={b.start}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}-`)}</li>)}</ol>;
          case "code": return <pre key={k}><code>{b.text}</code></pre>;
          case "quote": return <blockquote key={k}>{withBreaks(b.lines, k)}</blockquote>;
          case "hr": return <hr key={k} />;
          case "table": return (
            <div key={k} className="md-table">
              <table>
                <thead><tr>{b.head.map((c, j) => <th key={j} style={{ textAlign: b.align[j] ?? "left" }}>{inline(c, `${k}-h${j}-`)}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, ri) => (
                  <tr key={ri}>{b.head.map((_, j) => <td key={j} style={{ textAlign: b.align[j] ?? "left" }}>{inline(r[j] ?? "", `${k}-${ri}-${j}-`)}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          );
        }
      })}
    </div>
  );
}

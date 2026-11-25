/**
 * Small, safe Markdown renderer for assistant answers.
 * Builds React elements directly — never injects HTML — so text from the AI can't run code.
 * Supports: paragraphs, line breaks, # headings, - / * / • and 1. lists, tables, ``` code
 * blocks, > quotes, --- rules, **bold**, *italic* / _italic_, `code`, ~~strike~~ and
 * [links](https://…) (http/https only, opened in a new tab).
 */
import { Fragment, type ReactNode } from "react";

interface Item { text: string; children: Block[] }
type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: Item[]; start: number }
  | { kind: "table"; head: string[]; rows: string[][]; align: ("left" | "right" | "center")[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "hr" };

/** A list item: indent, bullet marker OR number, text. */
const LIST_ITEM = /^(\s*)(?:([-*+•])|(\d{1,3})[.)])\s+(.*)$/;
/** Closing #s are stripped only when a space precedes them (keeps "C#"). */
const HEADING = /^\s*(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** A table needs a header line with "|" and a separator that also has "|" (a bare "---" is a rule). */
const isTableStart = (lines: string[], k: number) =>
  lines[k].includes("|") && k + 1 < lines.length && TABLE_SEP.test(lines[k + 1]) &&
  (lines[k + 1].includes("|") || cells(lines[k]).length === 1);

const indentOf = (l: string) => (l.replace(/\t/g, "    ").match(/^ */)?.[0].length ?? 0);
const dedent = (ls: string[]) => {
  const min = Math.min(...ls.filter((l) => l.trim()).map(indentOf));
  return ls.map((l) => l.replace(/\t/g, "    ").slice(Number.isFinite(min) ? min : 0));
};

/** Parse a list starting at line i; deeper-indented lines become nested blocks of the item. */
function parseList(lines: string[], i: number): [Block, number] {
  const first = lines[i].match(LIST_ITEM)!;
  const base = indentOf(lines[i]), ordered = !first[2];
  const start = ordered ? Number(first[3]) : 1;
  const items: Item[] = [];
  while (i < lines.length) {
    const m = lines[i].match(LIST_ITEM);
    if (!m || indentOf(lines[i]) !== base || !m[2] !== ordered) break;
    let text = m[4];
    i++;
    const child: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        let j = i; while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && indentOf(lines[j]) > base) { child.push(""); i++; continue; }
        break;
      }
      if (indentOf(l) > base) { child.push(l); i++; continue; }
      break;
    }
    // Plain lines straight after the item continue its text.
    while (child.length && child[0].trim() && !LIST_ITEM.test(child[0])) text += ` ${child.shift()!.trim()}`;
    items.push({ text, children: child.some((l) => l.trim()) ? parseBlocks(dedent(child).join("\n")) : [] });
    // Blank lines between items of the same list don't end it.
    let j = i; while (j < lines.length && !lines[j].trim()) j++;
    if (j > i && j < lines.length) {
      const m2 = lines[j].match(LIST_ITEM);
      if (m2 && indentOf(lines[j]) === base && !m2[2] === ordered) { i = j; continue; }
    }
  }
  return [{ kind: ordered ? "ol" : "ul", items, start }, i];
}

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
      if (i < lines.length) {
        // Text right after a closing fence on the same line is kept as the next block.
        const rest = lines[i].replace(/^\s*```+/, "");
        if (rest.trim()) lines[i] = rest; else i++;
      }
      out.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    const h = line.match(HEADING);
    if (h) { out.push({ kind: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (RULE.test(line)) { out.push({ kind: "hr" }); i++; continue; }

    if (isTableStart(lines, i)) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left") as "left" | "right" | "center");
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push({ kind: "table", head, rows, align });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const [block, next] = parseList(lines, i);
      out.push(block);
      i = next;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push({ kind: "quote", lines: q });
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !/^\s*```/.test(lines[i]) && !LIST_ITEM.test(lines[i]) && !RULE.test(lines[i])
      && !isTableStart(lines, i) && !/^\s*>/.test(lines[i])) p.push(lines[i++]);
    if (p.length) out.push({ kind: "p", lines: p });
    else { out.push({ kind: "p", lines: [lines[i]] }); i++; } // safety: always advance
  }
  return out;
}

/** Inline formatting. Unclosed markers are left as plain text (e.g. while streaming). */
const URL_PART = "(?:[^()\\s]|\\([^()\\s]*\\))+"; // one level of balanced parentheses
const INLINE = new RegExp(
  "(\\\\[\\\\`*_{}\\[\\]()#+\\-.!|~>])" + // 1 escaped character
  "|(`[^`\\n]+`)" + // 2 code
  "|(\\*\\*\\*[^*\\s][^*\\n]*?\\*\\*\\*)" + // 3 bold italic
  "|(\\*\\*[^*\\n][\\s\\S]*?\\*\\*|(?<![\\w])__[^_\\s][^_\\n]*?__(?![\\w]))" + // 4 bold
  "|(~~[^~\\n]+~~)" + // 5 strike
  `|(\\[[^\\]\\n]+\\]\\(${URL_PART}\\))` + // 6 link
  "|(\\*[^*\\s][^*\\n]*?\\*|(?<![\\w])_[^_\\s][^_\\n]*?_(?![\\w]))", // 7 italic
  "g",
);
const LINK = new RegExp(`^\\[([^\\]]+)\\]\\((${URL_PART})\\)$`);

function inline(text: string, keyBase = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0], key = `${keyBase}${n++}`;
    if (m[1]) out.push(tok.slice(1));
    else if (m[2]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[3]) out.push(<strong key={key}><em>{inline(tok.slice(3, -3), `${key}.`)}</em></strong>);
    else if (m[4]) out.push(<strong key={key}>{inline(tok.slice(2, -2), `${key}.`)}</strong>);
    else if (m[5]) out.push(<del key={key}>{inline(tok.slice(2, -2), `${key}.`)}</del>);
    else if (m[6]) {
      const lm = tok.match(LINK);
      const href = lm ? safeUrl(lm[2]) : null;
      out.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{inline(lm![1], `${key}.`)}</a>
        : <Fragment key={key}>{lm ? lm[1] : tok}</Fragment>);
    } else if (m[7]) out.push(<em key={key}>{inline(tok.slice(1, -1), `${key}.`)}</em>);
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

function Blocks({ blocks, prefix }: { blocks: Block[]; prefix: string }) {
  return (
    <>
      {blocks.map((b, i) => {
        const k = `${prefix}${i}`;
        switch (b.kind) {
          case "p": return <p key={k}>{withBreaks(b.lines, k)}</p>;
          case "h": return b.level <= 2 ? <h3 key={k} className="md-h">{inline(b.text, k)}</h3> : <h4 key={k} className="md-h4">{inline(b.text, k)}</h4>;
          case "ul":
          case "ol": {
            const items = b.items.map((it, j) => (
              <li key={j}>{inline(it.text, `${k}-${j}-`)}{it.children.length > 0 && <Blocks blocks={it.children} prefix={`${k}-${j}.`} />}</li>
            ));
            return b.kind === "ul" ? <ul key={k}>{items}</ul> : <ol key={k} start={b.start}>{items}</ol>;
          }
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
    </>
  );
}

export default function Markdown({ text }: { text: string }) {
  return <div className="md"><Blocks blocks={parseBlocks(text)} prefix="" /></div>;
}

import { generateJSON } from "@tiptap/core";
import type { JSONContent } from "@tiptap/react";
import { tiptapExtensions } from "@/lib/tiptap-extensions";

/** Parses mammoth's HTML-from-docx output into the same Tiptap JSON
 * schema the rich-text editor renders (same extension list — see
 * lib/tiptap-extensions.ts), so an imported Word doc is immediately
 * editable rather than dropped into a mismatched schema. */
export function docxHtmlToTiptapJson(html: string): JSONContent {
  return generateJSON(html, tiptapExtensions());
}

type Docx = typeof import("docx");
type Run = InstanceType<Docx["TextRun"]> | InstanceType<Docx["ExternalHyperlink"]>;

const HEADING_KEYS = { 1: "HEADING_1", 2: "HEADING_2", 3: "HEADING_3" } as const;

function marksToRunOptions(marks: JSONContent["marks"]) {
  const opts: { bold?: boolean; italics?: boolean; underline?: object; strike?: boolean; href?: string } = {};
  for (const mark of marks ?? []) {
    if (mark.type === "bold") opts.bold = true;
    if (mark.type === "italic") opts.italics = true;
    if (mark.type === "underline") opts.underline = {};
    if (mark.type === "strike") opts.strike = true;
    if (mark.type === "link") opts.href = mark.attrs?.href as string;
  }
  return opts;
}

/** Inline content (text + hardBreak nodes) of one paragraph-like node,
 * as docx TextRuns / ExternalHyperlinks — the leaf level of the
 * conversion, read directly off the JSON node so it never depends on
 * re-reading an already-built (write-only) docx Paragraph object. */
function inlineToRuns(docx: Docx, nodes: JSONContent[] | undefined, prefix?: string): Run[] {
  const runs: Run[] = [];
  if (prefix) runs.push(new docx.TextRun({ text: prefix }));
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      runs.push(new docx.TextRun({ break: 1 }));
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const { href, ...runOpts } = marksToRunOptions(node.marks);
    if (href) {
      runs.push(
        new docx.ExternalHyperlink({
          link: href,
          children: [new docx.TextRun({ ...runOpts, text: node.text, color: "0563C1", underline: {} })],
        })
      );
    } else {
      runs.push(new docx.TextRun({ ...runOpts, text: node.text }));
    }
  }
  return runs;
}

function codeBlockParagraphs(docx: Docx, node: JSONContent) {
  const text = (node.content ?? []).map((n) => n.text ?? "").join("");
  return text.split("\n").map(
    (line) =>
      new docx.Paragraph({
        children: [new docx.TextRun({ text: line, font: "Consolas", size: 20 })],
        shading: { fill: "F2F2F2" },
      })
  );
}

/** One "leaf" list/task item's own paragraph — its first paragraph
 * child rendered with a bullet/number/checkbox prefix, read straight
 * off that child's inline content. */
function leafItemParagraph(docx: Docx, node: JSONContent, prefix: string, bulletLevel?: number) {
  const firstParagraph = (node.content ?? []).find((c) => c.type === "paragraph");
  const runs = inlineToRuns(docx, firstParagraph?.content, prefix);
  return bulletLevel !== undefined
    ? new docx.Paragraph({
        bullet: { level: bulletLevel },
        children: runs.length ? runs : [new docx.TextRun({ text: prefix })],
      })
    : new docx.Paragraph({ children: runs.length ? runs : [new docx.TextRun({ text: prefix })] });
}

/** Walks one Tiptap block node into one or more docx Paragraphs.
 * `depth` threads list nesting through bulletList/orderedList so
 * nested list items still render (Word's built-in bullet levels for
 * unordered lists; a plain "1." text prefix for ordered — true
 * auto-numbering needs a docx numbering.xml config, more machinery
 * than this editor's lists are worth for a first pass). */
function blockToParagraphs(docx: Docx, node: JSONContent, depth = 0): InstanceType<Docx["Paragraph"]>[] {
  switch (node.type) {
    case "paragraph":
      return [new docx.Paragraph({ children: inlineToRuns(docx, node.content) })];

    case "heading": {
      const level = (node.attrs?.level as 1 | 2 | 3) ?? 1;
      return [
        new docx.Paragraph({
          heading: docx.HeadingLevel[HEADING_KEYS[level]],
          children: inlineToRuns(docx, node.content),
        }),
      ];
    }

    case "blockquote":
      return (node.content ?? [])
        .filter((child) => child.type === "paragraph")
        .map(
          (child) =>
            new docx.Paragraph({
              children: inlineToRuns(docx, child.content),
              indent: { left: 480 },
              border: { left: { style: docx.BorderStyle.SINGLE, size: 12, color: "CCCCCC", space: 8 } },
            })
        );

    case "codeBlock":
      return (node.content ?? []).length ? codeBlockParagraphs(docx, node) : [new docx.Paragraph({})];

    case "bulletList":
      return (node.content ?? []).flatMap((item) => [
        leafItemParagraph(docx, item, "", depth),
        ...(item.content ?? [])
          .filter((c) => c.type !== "paragraph")
          .flatMap((c) => blockToParagraphs(docx, c, depth + 1)),
      ]);

    case "orderedList":
      return (node.content ?? []).flatMap((item, i) => [
        leafItemParagraph(docx, item, `${i + 1}. `),
        ...(item.content ?? [])
          .filter((c) => c.type !== "paragraph")
          .flatMap((c) => blockToParagraphs(docx, c, depth + 1)),
      ]);

    case "taskList":
      return (node.content ?? []).flatMap((item) => [
        leafItemParagraph(docx, item, item.attrs?.checked ? "☑ " : "☐ "),
        ...(item.content ?? [])
          .filter((c) => c.type !== "paragraph")
          .flatMap((c) => blockToParagraphs(docx, c, depth + 1)),
      ]);

    case "horizontalRule":
      return [
        new docx.Paragraph({ border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: "999999" } } }),
      ];

    default:
      return node.content ? node.content.flatMap((child) => blockToParagraphs(docx, child, depth)) : [];
  }
}

/** Renders Tiptap JSON straight to a real .docx (OOXML) Blob — no HTML
 * intermediate — so save-as-Word round-trips through the exact schema
 * the editor already knows how to read back via docxHtmlToTiptapJson.
 * `docx` is dynamically imported so viewing a PDF/image doesn't pull
 * this (fairly large) library into the same bundle chunk. */
export async function tiptapJsonToDocxBlob(doc: JSONContent, title?: string): Promise<Blob> {
  const docx = await import("docx");
  const children = (doc.content ?? []).flatMap((node) => blockToParagraphs(docx, node));
  const file = new docx.Document({
    title,
    sections: [{ properties: {}, children: children.length ? children : [new docx.Paragraph({})] }],
  });
  return docx.Packer.toBlob(file);
}

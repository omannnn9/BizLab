import type { JSONContent } from "@tiptap/react";
import type { DocContent } from "@/lib/document-blocks";

export function emptyRichContent(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function legacyBlockToNode(block: DocContent["blocks"][number]): JSONContent | null {
  const text = block.text?.trim();
  const textContent = text ? [{ type: "text", text }] : undefined;

  switch (block.type) {
    case "heading1":
      return { type: "heading", attrs: { level: 1 }, content: textContent };
    case "heading2":
      return { type: "heading", attrs: { level: 2 }, content: textContent };
    case "checklist":
      return {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: !!block.checked },
            content: [{ type: "paragraph", content: textContent }],
          },
        ],
      };
    case "callout":
      return { type: "blockquote", content: [{ type: "paragraph", content: textContent }] };
    case "divider":
      return { type: "horizontalRule" };
    case "doc_link":
      // No direct equivalent in a standard rich-text schema — preserved
      // as a plain line naming the linked document rather than dropped.
      return {
        type: "paragraph",
        content: [{ type: "text", text: `🔗 ${block.documentTitle ?? "Linked document"}` }],
      };
    case "paragraph":
    default:
      return { type: "paragraph", content: textContent };
  }
}

/** Best-effort read across every content shape this column has ever held:
 * a real Tiptap doc (current), the block-array editor (mid-2024 rewrite),
 * or the original plain `{ text }` field — never a blank page for
 * pre-existing content. */
export function normalizeRichContent(raw: unknown): JSONContent {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (obj.type === "doc") return raw as JSONContent;
    if (Array.isArray(obj.blocks)) {
      const nodes = (obj.blocks as DocContent["blocks"]).map(legacyBlockToNode).filter((n): n is JSONContent => !!n);
      return nodes.length > 0 ? { type: "doc", content: nodes } : emptyRichContent();
    }
    if (typeof obj.text === "string" && obj.text.length > 0) {
      return {
        type: "doc",
        content: obj.text
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
      };
    }
  }
  return emptyRichContent();
}

function extractText(node: JSONContent): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(extractText).join(" ");
}

export function richContentPreview(content: JSONContent, maxLength = 140): string {
  return extractText(content).trim().slice(0, maxLength);
}

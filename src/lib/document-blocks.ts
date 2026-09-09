export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "checklist"
  | "callout"
  | "divider"
  | "doc_link";

export interface DocBlock {
  id: string;
  type: BlockType;
  text?: string;
  checked?: boolean;
  documentId?: string;
  documentTitle?: string;
}

export interface DocContent {
  blocks: DocBlock[];
}

export function emptyContent(): DocContent {
  return { blocks: [{ id: crypto.randomUUID(), type: "paragraph", text: "" }] };
}

export function newBlock(type: BlockType): DocBlock {
  return { id: crypto.randomUUID(), type, text: "", checked: false };
}

/** Best-effort read: older documents were saved as plain `{ text }` or the
 * ProseMirror-shaped default `{ type: 'doc', content: [] }` from the very
 * first version of this schema — normalize either into the block model
 * rather than showing a blank page for pre-existing content. */
export function normalizeContent(raw: unknown): DocContent {
  if (raw && typeof raw === "object" && Array.isArray((raw as DocContent).blocks)) {
    return raw as DocContent;
  }
  const legacyText = (raw as { text?: string } | null)?.text;
  if (typeof legacyText === "string" && legacyText.length > 0) {
    return { blocks: [{ id: crypto.randomUUID(), type: "paragraph", text: legacyText }] };
  }
  return emptyContent();
}

export function plainTextPreview(content: DocContent, maxLength = 140): string {
  return content.blocks
    .map((b) => b.text ?? "")
    .join(" ")
    .trim()
    .slice(0, maxLength);
}

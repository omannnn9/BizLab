/** Shape of the block-array editor that preceded the Tiptap rich-text
 * editor — kept only so `lib/tiptap-content.ts` can convert documents
 * saved in this shape into a real Tiptap doc on load. */
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

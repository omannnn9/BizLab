import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CheckSquare,
  FileText,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Lightbulb,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { newBlock, type BlockType, type DocBlock, type DocContent } from "@/lib/document-blocks";
import { useWorkspace } from "@/hooks/use-workspace";
import { useDocuments } from "@/hooks/use-documents";

const BLOCK_TYPES: { type: BlockType; label: string; icon: typeof AlignLeft }[] = [
  { type: "paragraph", label: "Text", icon: AlignLeft },
  { type: "heading1", label: "Heading 1", icon: Heading1 },
  { type: "heading2", label: "Heading 2", icon: Heading2 },
  { type: "checklist", label: "Checklist", icon: CheckSquare },
  { type: "callout", label: "Callout", icon: Lightbulb },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "doc_link", label: "Link to document", icon: LinkIcon },
];

export function BlockEditor({
  content,
  onChange,
  readOnly,
}: {
  content: DocContent;
  onChange: (content: DocContent) => void;
  readOnly?: boolean;
}) {
  const { company } = useWorkspace();
  const navigate = useNavigate();
  const focusTarget = useRef<string | null>(null);
  const { data: linkableDocuments } = useDocuments(null);

  function updateBlock(id: string, patch: Partial<DocBlock>) {
    onChange({ blocks: content.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }

  function addBlock(afterId: string, type: BlockType) {
    const index = content.blocks.findIndex((b) => b.id === afterId);
    const block = newBlock(type);
    const blocks = [...content.blocks];
    blocks.splice(index + 1, 0, block);
    focusTarget.current = block.id;
    onChange({ blocks });
  }

  function removeBlock(id: string) {
    if (content.blocks.length === 1) return;
    onChange({ blocks: content.blocks.filter((b) => b.id !== id) });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = content.blocks.findIndex((b) => b.id === id);
    const target = index + direction;
    if (target < 0 || target >= content.blocks.length) return;
    const blocks = [...content.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    onChange({ blocks });
  }

  return (
    <div className="flex flex-col gap-1">
      {content.blocks.map((block) => (
        <div key={block.id} className="group flex items-start gap-1">
          <div className="mt-1.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {!readOnly && (
              <>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => moveBlock(block.id, -1)}>
                  <ArrowUp className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => moveBlock(block.id, 1)}>
                  <ArrowDown className="size-3" />
                </Button>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {block.type === "paragraph" && (
              <AutoTextarea
                value={block.text ?? ""}
                onChange={(text) => updateBlock(block.id, { text })}
                placeholder="Type something…"
                className="text-base"
                readOnly={readOnly}
                autoFocus={focusTarget.current === block.id}
              />
            )}
            {block.type === "heading1" && (
              <AutoTextarea
                value={block.text ?? ""}
                onChange={(text) => updateBlock(block.id, { text })}
                placeholder="Heading 1"
                className="text-2xl font-bold"
                readOnly={readOnly}
                autoFocus={focusTarget.current === block.id}
              />
            )}
            {block.type === "heading2" && (
              <AutoTextarea
                value={block.text ?? ""}
                onChange={(text) => updateBlock(block.id, { text })}
                placeholder="Heading 2"
                className="text-xl font-semibold"
                readOnly={readOnly}
                autoFocus={focusTarget.current === block.id}
              />
            )}
            {block.type === "checklist" && (
              <div className="flex items-start gap-2">
                <Checkbox
                  className="mt-1.5"
                  checked={!!block.checked}
                  onCheckedChange={(checked) => updateBlock(block.id, { checked: !!checked })}
                  disabled={readOnly}
                />
                <AutoTextarea
                  value={block.text ?? ""}
                  onChange={(text) => updateBlock(block.id, { text })}
                  placeholder="To-do"
                  className={cn("flex-1 text-base", block.checked && "text-muted-foreground line-through")}
                  readOnly={readOnly}
                  autoFocus={focusTarget.current === block.id}
                />
              </div>
            )}
            {block.type === "callout" && (
              <div className="flex items-start gap-2 rounded-md bg-accent p-3">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                <AutoTextarea
                  value={block.text ?? ""}
                  onChange={(text) => updateBlock(block.id, { text })}
                  placeholder="Callout…"
                  className="flex-1 text-sm"
                  readOnly={readOnly}
                  autoFocus={focusTarget.current === block.id}
                />
              </div>
            )}
            {block.type === "divider" && <hr className="my-2 border-border" />}
            {block.type === "doc_link" &&
              (block.documentId ? (
                <button
                  onClick={() => navigate(`/w/${company?.slug}/documents/${block.documentId}`)}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <FileText className="size-4 text-primary" />
                  {block.documentTitle ?? "Untitled document"}
                </button>
              ) : readOnly ? (
                <p className="text-sm text-muted-foreground italic">No document chosen</p>
              ) : (
                <Select
                  onValueChange={(docId) => {
                    const doc = linkableDocuments?.find((d) => d.id === docId);
                    updateBlock(block.id, { documentId: docId, documentTitle: doc?.title });
                  }}
                >
                  <SelectTrigger className="w-64"><SelectValue placeholder="Choose a document to link…" /></SelectTrigger>
                  <SelectContent>
                    {linkableDocuments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
          </div>

          {!readOnly && (
            <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6">
                    <Plus className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {BLOCK_TYPES.map((bt) => (
                    <DropdownMenuItem key={bt.type} onClick={() => addBlock(block.id, bt.type)}>
                      <bt.icon /> {bt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {content.blocks.length > 1 && (
                <Button variant="ghost" size="icon" className="size-6" onClick={() => removeBlock(block.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  readOnly,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      autoFocus={autoFocus}
      rows={1}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      className={cn(
        "w-full resize-none overflow-hidden border-none bg-transparent p-0 outline-none placeholder:text-muted-foreground",
        className
      )}
    />
  );
}

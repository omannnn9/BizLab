import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityLoadGuard } from "@/components/shared/entity-load-guard";
import { RichTextEditor } from "@/components/documents/rich-text-editor";
import { useFile, useReplaceFileContent, getFileDownloadUrl } from "@/hooks/use-files";
import { useWorkspace } from "@/hooks/use-workspace";
import { docxHtmlToTiptapJson, tiptapJsonToDocxBlob } from "@/lib/tiptap-docx";
import { gridToXlsxBlob, xlsxToGrid } from "@/lib/xlsx-grid";
import type { JSONContent } from "@tiptap/react";

type Kind = "docx" | "xlsx" | "pdf" | "image" | "other";

function kindOf(extension: string | null): Kind {
  const ext = (extension ?? "").toLowerCase();
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  return "other";
}

export function FileEditorPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const { data: file, isLoading, isError } = useFile(fileId);
  const replaceContent = useReplaceFileContent();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  const kind = file ? kindOf(file.extension) : "other";
  const [loadPhase, setLoadPhase] = useState<"loading" | "ready" | "load_error">("loading");
  const [docContent, setDocContent] = useState<JSONContent | null>(null);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!file) return;
    initialized.current = false;
    setLoadPhase("loading");

    (async () => {
      try {
        if (kind === "docx") {
          const [mammoth, url] = await Promise.all([import("mammoth"), getFileDownloadUrl(file.storage_path)]);
          const buffer = await fetch(url).then((r) => r.arrayBuffer());
          const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
          setDocContent(docxHtmlToTiptapJson(html));
        } else if (kind === "xlsx") {
          const url = await getFileDownloadUrl(file.storage_path);
          const buffer = await fetch(url).then((r) => r.arrayBuffer());
          setGrid(await xlsxToGrid(buffer));
        } else {
          // pdf/image/other: just view or download — a 1-hour signed URL is
          // plenty for a viewing session, and there's no content to parse.
          setPreviewUrl(await getFileDownloadUrl(file.storage_path, 3600));
        }
        setLoadPhase("ready");
        // Let the state settle before arming autosave, so loading the
        // file doesn't immediately trigger a save of its own content.
        setTimeout(() => (initialized.current = true), 0);
      } catch {
        setLoadPhase("load_error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  function scheduleSave(makeBlob: () => Promise<Blob> | Blob) {
    if (!initialized.current || !file) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const blob = await makeBlob();
        await replaceContent.mutateAsync({ file, blob });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 900);
  }

  function handleDocChange(next: JSONContent) {
    setDocContent(next);
    scheduleSave(() => tiptapJsonToDocxBlob(next, file?.name));
  }

  function updateCell(row: number, col: number, value: string) {
    setGrid((prev) => {
      if (!prev) return prev;
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      scheduleSave(() => gridToXlsxBlob(next));
      return next;
    });
  }

  function addRow() {
    setGrid((prev) => {
      if (!prev) return prev;
      const width = prev[0]?.length ?? 1;
      const next = [...prev, new Array(width).fill("")];
      scheduleSave(() => gridToXlsxBlob(next));
      return next;
    });
  }

  function addColumn() {
    setGrid((prev) => {
      if (!prev) return prev;
      const next = prev.map((r) => [...r, ""]);
      scheduleSave(() => gridToXlsxBlob(next));
      return next;
    });
  }

  function removeRow(index: number) {
    setGrid((prev) => {
      if (!prev || prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      scheduleSave(() => gridToXlsxBlob(next));
      return next;
    });
  }

  async function handleDownload() {
    if (!file) return;
    const url = await getFileDownloadUrl(file.storage_path, 60);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  }

  if (isLoading || isError || !file) {
    return (
      <EntityLoadGuard
        isLoading={isLoading}
        isError={isError}
        backTo={`/w/${company?.slug}/files`}
        backLabel="Back to files"
        notFoundMessage="This file doesn't exist or you don't have access to it."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${company?.slug}/files`)}>
          <ArrowLeft /> Files
        </Button>
        <span className="truncate text-sm font-medium">{file.name}</span>
        <div className="flex items-center gap-3">
          {(kind === "docx" || kind === "xlsx") && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {saveStatus === "saving" && <Loader2 className="size-3 animate-spin" />}
              {saveStatus === "saved" && <Check className="size-3" />}
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Couldn't save" : ""}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void handleDownload()}>
            <Download className="size-3.5" /> Download
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadPhase === "loading" && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {loadPhase === "load_error" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">Couldn't open this file for editing.</p>
            <Button variant="outline" size="sm" onClick={() => void handleDownload()}>
              <Download className="size-3.5" /> Download instead
            </Button>
          </div>
        )}

        {loadPhase === "ready" && kind === "docx" && docContent && (
          <div className="mx-auto max-w-3xl px-8 py-8">
            <RichTextEditor content={docContent} onChange={handleDocChange} />
          </div>
        )}

        {loadPhase === "ready" && kind === "xlsx" && grid && (
          <div className="p-6">
            <div className="mb-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="size-3.5" /> Row
              </Button>
              <Button variant="outline" size="sm" onClick={addColumn}>
                <Plus className="size-3.5" /> Column
              </Button>
            </div>
            <div className="overflow-auto rounded-lg border">
              <table className="border-collapse text-sm">
                <tbody>
                  {grid.map((row, r) => (
                    <tr key={r} className="group">
                      {row.map((cell, c) => (
                        <td key={c} className="border p-0">
                          <input
                            value={cell}
                            onChange={(e) => updateCell(r, c, e.target.value)}
                            className="h-8 w-32 bg-transparent px-2 outline-none focus:bg-accent/40"
                          />
                        </td>
                      ))}
                      <td className="border-0 p-0 pl-1">
                        <button
                          onClick={() => removeRow(r)}
                          className="hidden text-muted-foreground hover:text-destructive group-hover:inline-flex"
                          title="Delete row"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Cell values only — formulas and formatting from the original file aren't preserved.
            </p>
          </div>
        )}

        {loadPhase === "ready" && kind === "pdf" && previewUrl && (
          <iframe src={previewUrl} title={file.name} className="h-full w-full border-0" />
        )}

        {loadPhase === "ready" && kind === "image" && previewUrl && (
          <div className="flex h-full items-center justify-center bg-muted/20 p-6">
            <img src={previewUrl} alt={file.name} className="max-h-full max-w-full rounded-md object-contain" />
          </div>
        )}

        {loadPhase === "ready" && kind === "other" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              There's no in-app preview for this file type — download it to view it.
            </p>
            <Button size="sm" onClick={() => void handleDownload()}>
              <Download className="size-3.5" /> Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

/** Shared with `generateJSON` (imported-document conversion) so a
 * mammoth-converted Word doc parses against the exact same schema the
 * editor renders — a mismatched extension list here would silently
 * drop content the editor doesn't know how to represent. */
export function tiptapExtensions(readOnly = false) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    Link.configure({ openOnClick: !readOnly, autolink: true }),
    Placeholder.configure({ placeholder: "Start writing…" }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ];
}

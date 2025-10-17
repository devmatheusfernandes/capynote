import { NoteData, FolderData, TagData } from "@/types";
import { createEditor } from "lexical";
import { TRANSFORMERS, $convertToMarkdownString } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import {
  WikiLinkNode,
  TagNode,
} from "@/components/editor/plugins/obsidian-plugin";

export type BackupPayload = {
  meta: {
    app: string;
    version: string;
    createdAt: string;
  };
  notes: NoteData[];
  folders: FolderData[];
  tags: TagData[];
};

export function lexicalToMarkdown(serializedContent: string): string {
  try {
    const editor = createEditor({
      namespace: "ExportMarkdown",
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        AutoLinkNode,
        LinkNode,
        WikiLinkNode,
        TagNode,
      ],
      onError: (error) => console.error("Lexical export error", error),
    });
    const editorState = editor.parseEditorState(serializedContent);

    let markdown = "";
    editor.setEditorState(editorState);
    editor.getEditorState().read(() => {
      markdown = $convertToMarkdownString(TRANSFORMERS);
    });

    return markdown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Lexical export error:", message);
    // Fallback: tenta extrair texto simples do JSON
    try {
      type LexicalNode = { text?: string; children?: LexicalNode[] };
      type LexicalContent = { root?: { children?: LexicalNode[] } };
      const parsed = JSON.parse(serializedContent) as LexicalContent;
      if (parsed.root && parsed.root.children) {
        let text = "";
        const extractText = (node: LexicalNode) => {
          if (node.text) text += node.text + "\n";
          node.children?.forEach(extractText);
        };
        parsed.root.children.forEach(extractText);
        return text.trim();
      }
    } catch {
      /* ignore */
    }
    return serializedContent;
  }
}

export function downloadFile(
  filename: string,
  data: string | Blob,
  mime?: string
) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportNotesAsJSON(notes: NoteData[]): string {
  const payload = {
    meta: {
      app: "CapyNotes",
      version: "1",
      exportedAt: new Date().toISOString(),
    },
    notes,
  };
  return JSON.stringify(payload, null, 2);
}

export function resolveFolderPath(
  folderId: string | undefined,
  folders: FolderData[]
): string {
  if (!folderId) return "/";
  const path: string[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current.name);
    current = current.parentId
      ? folders.find((f) => f.id === current!.parentId)
      : undefined;
  }
  return "/" + path.join("/");
}

export function exportNotesAsMarkdown(
  notes: NoteData[],
  folders: FolderData[],
  tagsById: Record<string, string>
): string {
  const lines: string[] = [];
  for (const note of notes) {
    const mdContent = lexicalToMarkdown(note.content || "");
    const tagNames =
      Array.isArray(note.tagIds) && note.tagIds.length > 0
        ? note.tagIds.map((id) => tagsById[id] || id)
        : note.tags || [];
    const folderPath = resolveFolderPath(note.folderId, folders);
    lines.push(`# ${note.title || "Nota sem título"}`);
    if (tagNames.length) lines.push(`- Tags: ${tagNames.join(", ")}`);
    lines.push(`- Pasta: ${folderPath}`);
    lines.push(`- Atualizada: ${note.updatedAt}`);
    lines.push("");
    lines.push(mdContent);
    lines.push("\n---\n");
  }
  return lines.join("\n");
}

export function buildBackupPayload(
  notes: NoteData[],
  folders: FolderData[],
  tags: TagData[]
): BackupPayload {
  return {
    meta: {
      app: "CapyNotes",
      version: "1",
      createdAt: new Date().toISOString(),
    },
    notes,
    folders,
    tags,
  };
}

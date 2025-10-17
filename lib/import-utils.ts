import { NoteData, FolderData, TagData } from "@/types";
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from "lexical";
import { TRANSFORMERS, $convertFromMarkdownString } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ParagraphNode, TextNode } from "lexical";
import {
  WikiLinkNode,
  TagNode,
} from "@/components/editor/plugins/obsidian-plugin";

export type BackupPayload = {
  meta?: { app?: string; version?: string; createdAt?: string };
  notes?: NoteData[];
  folders?: FolderData[];
  tags?: TagData[];
};

export function markdownToLexical(markdown: string): string {
  const editor = createEditor({
    namespace: "ImportMarkdown",
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      AutoLinkNode,
      LinkNode,
      ParagraphNode,
      TextNode,
      WikiLinkNode,
      TagNode,
    ],
    onError: (error) => console.error("Lexical import error", error),
  });

  // Precisa setar o editor state de forma síncrona
  editor.update(
    () => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    },
    {
      discrete: true, // Força a atualização ser aplicada imediatamente
    }
  );

  // Aguarda a atualização ser processada antes de serializar
  const editorState = editor.getEditorState();
  const serialized = JSON.stringify(editorState.toJSON());

  return serialized;
}

export function parseJSONFile(
  text: string
): BackupPayload | NoteData | NoteData[] {
  try {
    const obj = JSON.parse(text);
    // Pode ser payload de backup, uma nota ou array de notas
    if (obj && (obj.notes || obj.folders || obj.tags)) {
      return obj as BackupPayload;
    }
    if (Array.isArray(obj)) {
      return obj as NoteData[];
    }
    return obj as NoteData;
  } catch (e) {
    throw new Error("Arquivo JSON inválido");
  }
}

export function deriveTitleFromMarkdown(
  md: string,
  fallback = "Nota importada"
): string {
  const firstLine =
    md.split(/\r?\n/).find((l) => l.trim().length > 0) || fallback;
  const h1Match = firstLine.match(/^#\s+(.*)$/);
  return h1Match ? h1Match[1].trim() : firstLine.slice(0, 80);
}

export function mergeNotes(
  existing: NoteData[],
  incoming: NoteData[]
): NoteData[] {
  const map = new Map(existing.map((n) => [n.id, n]));
  for (const note of incoming) {
    const current = map.get(note.id);
    if (!current) {
      map.set(note.id, note);
      continue;
    }
    // Escolhe o conteúdo mais recente por updatedAt
    const currentUpdated = new Date(current.updatedAt).getTime();
    const incomingUpdated = new Date(note.updatedAt).getTime();
    const winner = incomingUpdated >= currentUpdated ? note : current;
    map.set(note.id, {
      ...current,
      ...winner,
      createdAt:
        current.createdAt || winner.createdAt || new Date().toISOString(),
      updatedAt: winner.updatedAt || new Date().toISOString(),
    });
  }
  return Array.from(map.values());
}

export function mergeFolders(
  existing: FolderData[],
  incoming: FolderData[]
): FolderData[] {
  const map = new Map(existing.map((f) => [f.id, f]));
  for (const folder of incoming) {
    const current = map.get(folder.id);
    if (!current) {
      map.set(folder.id, folder);
      continue;
    }
    map.set(folder.id, {
      ...current,
      ...folder,
      createdAt:
        current.createdAt || folder.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return Array.from(map.values());
}

export function mergeTags(existing: TagData[], incoming: TagData[]): TagData[] {
  // Chaveia por id; se só vier name, preserva id existente
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const tag of incoming) {
    const current = map.get(tag.id);
    if (!current) {
      map.set(tag.id, tag);
      continue;
    }
    map.set(tag.id, {
      ...current,
      ...tag,
      createdAt: current.createdAt || tag.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return Array.from(map.values());
}

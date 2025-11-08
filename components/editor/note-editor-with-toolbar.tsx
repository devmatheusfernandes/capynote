"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import BibleReferenceAutoLink from "./plugins/bible-reference-plugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import type { EditorState, LexicalNode } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { TRANSFORMERS, $convertFromMarkdownString } from "@lexical/markdown";
import {
  ParagraphNode,
  TextNode,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
} from "lexical";
import {
  ObsidianPlugin,
  WikiLinkNode,
  TagNode,
} from "./plugins/obsidian-plugin";
import Toolbar from "./toolbar";
import "./note-editor.css";
import React, { useEffect, useState } from "react";
import BibleReferenceHandler from "./bible-reference-handler";
import BibleTextsCollectorPlugin from "./plugins/bible-texts-collector-plugin";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LexicalSerializedEditorState {
  root: {
    children: unknown[];
    direction: string | null;
    format: string;
    indent: number;
    type: string;
    version: number;
  };
}

const theme = {
  // Theme stylingf
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  paragraph: "editor-paragraph",
  quote: "editor-quote",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
    h4: "editor-heading-h4",
    h5: "editor-heading-h5",
    h6: "editor-heading-h6",
  },
  list: {
    nested: {
      listitem: "editor-nested-listitem",
    },
    ol: "editor-list-ol",
    ul: "editor-list-ul",
    listitem: "editor-listitem",
  },
  image: "editor-image",
  link: "editor-link",
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    overflowed: "editor-text-overflowed",
    hashtag: "editor-text-hashtag",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    underlineStrikethrough: "editor-text-underlineStrikethrough",
    code: "editor-text-code",
  },
  code: "editor-code",
  codeHighlight: {
    atrule: "editor-tokenAttr",
    attr: "editor-tokenAttr",
    boolean: "editor-tokenProperty",
    builtin: "editor-tokenSelector",
    cdata: "editor-tokenComment",
    char: "editor-tokenSelector",
    class: "editor-tokenFunction",
    "class-name": "editor-tokenFunction",
    comment: "editor-tokenComment",
    constant: "editor-tokenProperty",
    deleted: "editor-tokenProperty",
    doctype: "editor-tokenComment",
    entity: "editor-tokenOperator",
    function: "editor-tokenFunction",
    important: "editor-tokenVariable",
    inserted: "editor-tokenSelector",
    keyword: "editor-tokenAttr",
    namespace: "editor-tokenVariable",
    number: "editor-tokenProperty",
    operator: "editor-tokenOperator",
    prolog: "editor-tokenComment",
    property: "editor-tokenProperty",
    punctuation: "editor-tokenPunctuation",
    regex: "editor-tokenVariable",
    selector: "editor-tokenSelector",
    string: "editor-tokenSelector",
    symbol: "editor-tokenProperty",
    tag: "editor-tokenProperty",
    url: "editor-tokenOperator",
    variable: "editor-tokenVariable",
  },
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
function onError(error: Error) {
  console.error(error);
}

export interface NoteEditorWithToolbarProps {
  placeholder?: string;
  onChange?: (editorState: string) => void;
  initialValue?: string;
  className?: string;
  showToolbar?: boolean;
  openReadMode?: boolean;
  onOpenReadMode?: () => void;
  onCloseReadMode?: () => void;
}

function MyOnChangePlugin({
  onChange,
}: {
  onChange?: (serializedState: string) => void;
}) {
  return (
    <OnChangePlugin
      onChange={(editorState: EditorState) => {
        const serialized = JSON.stringify(editorState.toJSON());
        onChange?.(serialized);
      }}
    />
  );
}

function EditableTogglePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  React.useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

function InitialValuePlugin({ initialValue }: { initialValue?: string }) {
  const [editor] = useLexicalComposerContext();
  const hasAppliedInitialValue = React.useRef<boolean>(false);

  const normalizeSerializedState = (value: string): string => {
    // Attempt to unwrap any double-encoded JSON strings
    try {
      let parsed: unknown = JSON.parse(value);
      // If parsed is a string, it may be double-encoded
      while (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      // If parsed is an object, return a properly stringified version
      if (typeof parsed === "object" && parsed !== null) {
        return JSON.stringify(parsed);
      }
    } catch {
      // If JSON.parse fails, assume value is already a valid serialized state
    }
    return value;
  };

  React.useEffect(() => {
    // Apply only once: the first time we receive a non-empty initial value
    if (
      !hasAppliedInitialValue.current &&
      initialValue &&
      initialValue.trim()
    ) {
      try {
        const normalized = normalizeSerializedState(initialValue);
        const parsed = JSON.parse(normalized);
        const isLexicalJSON =
          parsed && parsed.root && typeof parsed.root === "object";

        if (isLexicalJSON) {
          const editorState = editor.parseEditorState(normalized);
          const json = editorState.toJSON() as LexicalSerializedEditorState;
          const hasChildren =
            Array.isArray(json?.root?.children) &&
            json.root.children.length > 0;
          // Apply lexical JSON only when it has content
          if (hasChildren) {
            editor.setEditorState(editorState);
            hasAppliedInitialValue.current = true;
          } else {
            // Empty lexical state: do nothing (keep editor empty)
            hasAppliedInitialValue.current = true;
          }
          return;
        }

        // Only non-JSON values are treated as Markdown
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const nodes = $convertFromMarkdownString(initialValue, TRANSFORMERS);
          if (Array.isArray(nodes) && nodes.length > 0) {
            root.append(...(nodes as LexicalNode[]));
          }
          // Fallback: se não houver filhos após a conversão, crie parágrafos a partir do texto simples
          const hasChildren = root.getChildren().length > 0;
          const trimmed = initialValue.trim();
          if (!hasChildren && trimmed.length > 0) {
            const blocks = trimmed.split(/\r?\n\s*\r?\n/);
            for (const block of blocks) {
              const p = $createParagraphNode();
              p.append($createTextNode(block));
              root.append(p);
            }
          }
        });
        hasAppliedInitialValue.current = true;
      } catch (error) {
        console.warn("Failed to parse initial value:", error);
        // If parsing failed, assume it's Markdown and convert
        try {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const nodes = $convertFromMarkdownString(
              initialValue,
              TRANSFORMERS
            );
            if (Array.isArray(nodes) && nodes.length > 0) {
              root.append(...(nodes as LexicalNode[]));
            }
            // Fallback: se não houver filhos após a conversão, crie parágrafos a partir do texto simples
            const hasChildren = root.getChildren().length > 0;
            const trimmed = initialValue.trim();
            if (!hasChildren && trimmed.length > 0) {
              const blocks = trimmed.split(/\r?\n\s*\r?\n/);
              for (const block of blocks) {
                const p = $createParagraphNode();
                p.append($createTextNode(block));
                root.append(p);
              }
            }
          });
          hasAppliedInitialValue.current = true;
        } catch (e) {
          console.warn("Failed to convert markdown initial value:", e);
        }
      }
    }
  }, [editor, initialValue]);

  return null;
}

export default function NoteEditorWithToolbar({
  placeholder = "Comece a escrever sua nota...",
  onChange,
  initialValue,
  className = "",
  showToolbar = true,
  openReadMode,
  onOpenReadMode,
}: NoteEditorWithToolbarProps) {
  // Modo leitura: controlado externamente por openReadMode

  const initialConfig = {
    namespace: "NoteEditorWithToolbar",
    theme,
    onError,
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
  };

  return (
    <div className={`note-editor-with-toolbar ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-container">
          <div className="editor-inner">
            <RichTextPlugin
              contentEditable={<ContentEditable className="editor-input" />}
              placeholder={
                <div className="editor-placeholder">{placeholder}</div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <BibleReferenceAutoLink />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <TabIndentationPlugin />
          <ObsidianPlugin />
          <BibleTextsCollectorPlugin />
          <WikilinkEditDrawerPlugin />
          <MyOnChangePlugin onChange={(s) => onChange?.(s)} />
          <InitialValuePlugin initialValue={initialValue} />
          <EditableTogglePlugin editable={!openReadMode} />
          </div>
        </div>
        {showToolbar && !openReadMode && (
          <Toolbar onToggleReadMode={onOpenReadMode} />
        )}
      </LexicalComposer>

      <BibleReferenceHandler />

      {/* Adiciona padding bottom para compensar a toolbar fixa */}
      {showToolbar && !openReadMode && <div className="toolbar-spacer" />}
    </div>
  );
}

function WikilinkEditDrawerPlugin() {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [nodeKey, setNodeKey] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const onEdit = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      const key = detail?.key;
      if (!key) return;
      setNodeKey(key);
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (!node || !(node instanceof WikiLinkNode)) return;
        setTitle(node.getTextContent());
        setOpen(true);
      });
    };
    window.addEventListener("wikilink-edit", onEdit as EventListener);
    return () => {
      window.removeEventListener("wikilink-edit", onEdit as EventListener);
    };
  }, [editor]);

  const onSave = () => {
    if (!nodeKey) return;
    const trimmed = title.trim();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey!);
      if (!node || !(node instanceof WikiLinkNode)) return;
      if (trimmed.length === 0) {
        node.replace($createTextNode(node.getTextContent()));
      } else {
        node.setTextContent(trimmed);
      }
    });
    setOpen(false);
  };

  const onDelete = () => {
    if (!nodeKey) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey!);
      if (!node || !(node instanceof WikiLinkNode)) return;
      node.replace($createTextNode(node.getTextContent()));
    });
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Editar Wikilink</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 flex flex-col gap-3">
          <label className="text-sm">Título do link</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do wikilink"
          />
        </div>
        <DrawerFooter>
          <div className="flex gap-2">
            <Button onClick={onSave}>Salvar</Button>
            <Button variant="outline" onClick={onDelete}>
              Remover link
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

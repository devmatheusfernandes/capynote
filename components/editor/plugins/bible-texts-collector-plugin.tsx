"use client";

import React, { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getNodeByKey, ElementNode, LexicalNode } from "lexical";
import { useEditorSidebar } from "../sidebar-editor-provider";
import { parseAllReferences, formatReferenceTitle } from "../utils/bible-parse";

type Item = { key: string; title: string; content: string };

export default function BibleTextsCollectorPlugin() {
  const [editor] = useLexicalComposerContext();
  const { setAllBibleTexts } = useEditorSidebar();

  useEffect(() => {
    console.log("[BibleTextsCollector] plugin montado");
    const cache = new Map<string, string>();

    const collectLinks = (): { key: string; text: string }[] => {
      const results: { key: string; text: string }[] = [];
      const visit = (node: LexicalNode) => {
        // Identify LinkNode/AutoLinkNode by type string to avoid direct class dependency
        // LinkNode.getType() => "link"; AutoLinkNode.getType() => "autolink"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyNode: any = node;
        const type =
          typeof anyNode.getType === "function" ? anyNode.getType() : null;
        if (type === "link" || type === "autolink") {
          const key = anyNode.getKey?.() as string;
          const text = anyNode.getTextContent?.() as string;
          if (key && text) {
            results.push({ key, text });
          }
        }
        if (anyNode.getChildren) {
          const children = anyNode.getChildren() as LexicalNode[];
          for (const child of children) visit(child);
        }
      };
      const root = $getRoot();
      const children = (root as ElementNode).getChildren();
      for (const child of children) visit(child);
      return results;
    };

    const fetchContentForInfo = async (info: {
      book: string;
      chapter: number;
      verse?: number;
      verses?: number[];
    }): Promise<{ title: string; content: string }> => {
      const selected =
        info.verse && !info.verses ? [info.verse] : info.verses ?? [];
      const cacheKey = `${info.book}|${info.chapter}|${
        selected.length ? selected.join(",") : "chapter"
      }`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return {
          title: formatReferenceTitle(
            info,
            selected.length ? selected : undefined
          ),
          content: cached,
        };
      }
      if (info.verse && !info.verses) {
        const params = new URLSearchParams({
          book: info.book,
          chapter: String(info.chapter),
          verse: String(info.verse),
        });
        const res = await fetch(`/api/bible?${params.toString()}`);
        const data = await res.json();
        const title = formatReferenceTitle(info);
        const content = data.text ?? "";
        cache.set(cacheKey, content);
        return { title, content };
      } else {
        const params = new URLSearchParams({
          book: info.book,
          chapter: String(info.chapter),
        });
        const res = await fetch(`/api/bible?${params.toString()}`);
        const data = await res.json();
        const selectedVerses =
          selected.length > 0 ? selected : (data.verses as number[]);
        const byNumber = new Map<number, string>();
        for (const item of data.content as { verse: number; text: string }[]) {
          byNumber.set(item.verse, item.text);
        }
        const lines: string[] = [];
        for (const v of selectedVerses) {
          const t = byNumber.get(v);
          if (t) lines.push(`${v}. ${t}`);
        }
        const title = formatReferenceTitle(info, selectedVerses);
        const content = lines.join("\n\n");
        cache.set(cacheKey, content);
        return { title, content };
      }
    };

    const performCollection = async (
      links: { key: string; text: string }[]
    ) => {
      try {
        console.log("[BibleTextsCollector] links encontrados:", links);
        const items: Item[] = [];
        for (const { key, text } of links) {
          const plain = text.replace(/\u00A0/g, " ");
          const infos = parseAllReferences(plain);
          console.log(
            "[BibleTextsCollector] referências extraídas de",
            plain,
            infos
          );
          for (const info of infos) {
            const { title, content } = await fetchContentForInfo(info);
            items.push({ key, title, content });
          }
        }
        // console.log("[BibleTextsCollector] itens finalizados:", items)
        setAllBibleTexts(items);
      } catch (e) {
        console.warn("[BibleTextsCollector] falha ao coletar textos:", e);
      }
    };

    const unsubscribe = editor.registerUpdateListener(({ editorState }) => {
      let links: { key: string; text: string }[] = [];
      editorState.read(() => {
        links = collectLinks();
      });
      void performCollection(links);
    });

    // Disparo inicial para coletar o estado atual sem depender de updates
    (() => {
      const editorState = editor.getEditorState();
      let links: { key: string; text: string }[] = [];
      editorState.read(() => {
        links = collectLinks();
      });
      void performCollection(links);
    })();

    const onFocusReq = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      const key = detail?.key;
      if (!key) return;
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (!node) return;
        // Try to place caret inside the node
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyNode: any = node;
        const domElem = editor.getElementByKey(key);
        if (domElem) {
          domElem.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (typeof anyNode.select === "function") {
          anyNode.select();
        }
      });
    };
    window.addEventListener("editor-focus-node", onFocusReq as EventListener);

    return () => {
      unsubscribe();
      window.removeEventListener(
        "editor-focus-node",
        onFocusReq as EventListener
      );
    };
  }, [editor, setAllBibleTexts]);

  return null;
}

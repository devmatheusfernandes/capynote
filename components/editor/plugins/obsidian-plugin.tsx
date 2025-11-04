"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { JSX, useEffect } from "react";
import { $createTextNode, TextNode, $getNodeByKey } from "lexical";
import type { SerializedTextNode } from "lexical";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

export type SerializedWikiLinkNode = Omit<SerializedTextNode, "type"> & {
  type: "wikilink";
};
export type SerializedTagNode = Omit<SerializedTextNode, "type"> & {
  type: "tag";
};

// Custom node for wikilinks [[link]]
export class WikiLinkNode extends TextNode {
  static getType(): string {
    return "wikilink";
  }

  static clone(node: WikiLinkNode): WikiLinkNode {
    return new WikiLinkNode(node.__text, node.__key);
  }

  constructor(text: string, key?: string) {
    super(text, key);
  }

  createDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "editor-wikilink";
    const raw = this.__text || "";
    // Agora armazenamos apenas o título dentro do node
    const title = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
    const nodeKey = this.getKey();

    // Texto clicável
    const textEl = document.createElement("span");
    textEl.className = "wikilink-text";
    // Exibe somente o título, sem [[ ]]
    textEl.textContent = title;
    if (title.length > 0) {
      textEl.setAttribute("data-wikilink-title", title);
      textEl.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          await openOrCreateNoteForTitle(title);
        } catch (err) {
          console.warn("Falha ao abrir/criar nota para wikilink:", err);
        }
      });
    }

    // Container de ícones (aparece acima do texto no hover)
    const icons = document.createElement("span");
    icons.className = "wikilink-icons";

    // Ícone editar
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "wikilink-icon wikilink-icon-edit";
    editBtn.title = "Editar wikilink";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("wikilink-edit", { detail: { key: nodeKey } })
      );
    });

    // Ícone deletar
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "wikilink-icon wikilink-icon-delete";
    deleteBtn.title = "Remover wikilink";
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("wikilink-delete", { detail: { key: nodeKey } })
      );
    });

    icons.appendChild(editBtn);
    icons.appendChild(deleteBtn);
    container.appendChild(textEl);
    container.appendChild(icons);

    // Mantém os ícones visíveis enquanto cursor estiver sobre eles
    let hideTimer: number | null = null;
    const setActive = (active: boolean) => {
      if (active) {
        container.setAttribute("data-hover-active", "true");
      } else {
        container.removeAttribute("data-hover-active");
      }
    };
    const clearHideTimer = () => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const scheduleHide = () => {
      clearHideTimer();
      hideTimer = window.setTimeout(() => setActive(false), 200);
    };

    container.addEventListener("mouseenter", () => {
      clearHideTimer();
      setActive(true);
    });
    container.addEventListener("mouseleave", () => {
      scheduleHide();
    });
    icons.addEventListener("mouseenter", () => {
      clearHideTimer();
      setActive(true);
    });
    icons.addEventListener("mouseleave", () => {
      scheduleHide();
    });
    return container;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedWikiLinkNode): WikiLinkNode {
    const { text } = serializedNode;
    return new WikiLinkNode(text);
  }

  exportJSON(): SerializedWikiLinkNode {
    return {
      ...super.exportJSON(),
      type: "wikilink",
    };
  }
}

// Custom node for tags #tag
export class TagNode extends TextNode {
  static getType(): string {
    return "tag";
  }

  static clone(node: TagNode): TagNode {
    return new TagNode(node.__text, node.__key);
  }

  constructor(text: string, key?: string) {
    super(text, key);
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "editor-tag";
    element.textContent = this.__text;
    return element;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedTagNode): TagNode {
    const { text } = serializedNode;
    return new TagNode(text);
  }

  exportJSON(): SerializedTagNode {
    return {
      ...super.exportJSON(),
      type: "tag",
    };
  }
}

export function $createWikiLinkNode(text: string): WikiLinkNode {
  return new WikiLinkNode(text);
}

export function $createTagNode(text: string): TagNode {
  return new TagNode(text);
}

async function openOrCreateNoteForTitle(title: string): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    // Sem usuário autenticado, não é possível navegar/criar
    console.warn("Wikilink clique ignorado: usuário não autenticado");
    return;
  }

  const notesRef = collection(db, "users", userId, "notes");
  const q = query(notesRef, where("title", "==", title));
  const snap = await getDocs(q);

  let targetId: string;
  if (!snap.empty) {
    targetId = snap.docs[0].id;
  } else {
    const newRef = doc(notesRef);
    const now = new Date().toISOString();
    await setDoc(newRef, {
      id: newRef.id,
      title,
      content: "",
      createdAt: now,
      updatedAt: now,
    });
    targetId = newRef.id;
  }

  // Navega para a página de edição da nota
  try {
    window.location.assign(`/dashboard/notas/editar/${targetId}`);
  } catch {
    // Fallback simples
    window.location.href = `/dashboard/notas/editar/${targetId}`;
  }
}

export function ObsidianPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Handler para remover wikilinks via ícone de exclusão
    
    const onDelete = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      const key = detail?.key;
      if (!key) return;
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (!node || !(node instanceof WikiLinkNode)) return;
        const plain = node.getTextContent();
        node.replace($createTextNode(plain));
      });
    };
    window.addEventListener("wikilink-delete", onDelete as EventListener);

    const removeTransform = editor.registerNodeTransform(
      TextNode,
      (textNode) => {
        const text = textNode.getTextContent();

        const tagRegex = /#[\w\-_]+/g;
        const wikilinkRegex = /\[\[([^\]]+)\]\]/g;

        const buildNodesWithTags = (plain: string) => {
          const nodes: TextNode[] = [];
          if (!plain) return nodes;
          let m: RegExpExecArray | null;
          let idx = 0;
          while ((m = tagRegex.exec(plain)) !== null) {
            const before = plain.slice(idx, m.index);
            if (before) nodes.push($createTextNode(before));
            nodes.push($createTagNode(m[0]));
            idx = tagRegex.lastIndex;
          }
          if (idx < plain.length) nodes.push($createTextNode(plain.slice(idx)));
          return nodes;
        };

        let match: RegExpExecArray | null;
        let lastIndex = 0;
        const newNodes: TextNode[] = [];
        let foundWiki = false;

        while ((match = wikilinkRegex.exec(text)) !== null) {
          const beforeText = text.slice(lastIndex, match.index);
          if (beforeText) {
            newNodes.push(...buildNodesWithTags(beforeText));
          }
          // Armazena apenas o título dentro do node
          newNodes.push($createWikiLinkNode(match[1]));
          lastIndex = wikilinkRegex.lastIndex;
          foundWiki = true;
        }

        if (lastIndex < text.length) {
          newNodes.push(...buildNodesWithTags(text.slice(lastIndex)));
        }

        if (foundWiki && newNodes.length > 0) {
          // Replace the original node and insert subsequent nodes safely
          textNode.replace(newNodes[0]);
          let current = newNodes[0];
          for (let i = 1; i < newNodes.length; i++) {
            current.insertAfter(newNodes[i]);
            current = newNodes[i];
          }
          return;
        }

        // If no wikilinks, try pure tag transform on the original text
        const onlyTagNodes = buildNodesWithTags(text);
        if (onlyTagNodes.length > 1) {
          textNode.replace(onlyTagNodes[0]);
          let current = onlyTagNodes[0];
          for (let i = 1; i < onlyTagNodes.length; i++) {
            current.insertAfter(onlyTagNodes[i]);
            current = onlyTagNodes[i];
          }
        }
      }
    );
    return () => {
      removeTransform();
      window.removeEventListener("wikilink-delete", onDelete as EventListener);
    };
  }, [editor]);

  return null;
}

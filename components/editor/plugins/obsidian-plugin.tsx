"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { JSX, useEffect } from "react";
import { $createTextNode, TextNode } from "lexical";
import type { SerializedTextNode } from "lexical";

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
    const element = document.createElement("span");
    element.className = "editor-wikilink";
    element.textContent = this.__text;
    return element;
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

export function ObsidianPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeTransform = editor.registerNodeTransform(
      TextNode,
      (textNode) => {
        const text = textNode.getTextContent();

        // Transform wikilinks [[text]]
        const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        let lastIndex = 0;
        const newNodes = [];

        while ((match = wikilinkRegex.exec(text)) !== null) {
          const beforeText = text.slice(lastIndex, match.index);
          if (beforeText) {
            newNodes.push($createTextNode(beforeText));
          }

          newNodes.push($createWikiLinkNode(match[0]));
          lastIndex = wikilinkRegex.lastIndex;
        }

        if (lastIndex < text.length) {
          newNodes.push($createTextNode(text.slice(lastIndex)));
        }

        if (newNodes.length > 1) {
          newNodes.forEach((node, index) => {
            if (index === 0) {
              textNode.replace(node);
            } else {
              textNode.insertAfter(node);
            }
          });
        }

        // Transform tags #tag
        const tagRegex = /#[\w\-_]+/g;
        const textContent = textNode.getTextContent();

        if (tagRegex.test(textContent)) {
          const tagMatches = textContent.match(tagRegex);
          if (tagMatches) {
            let currentText = textContent;
            const nodes = [];

            tagMatches.forEach((tag) => {
              const parts = currentText.split(tag);
              if (parts[0]) {
                nodes.push($createTextNode(parts[0]));
              }
              nodes.push($createTagNode(tag));
              currentText = parts.slice(1).join(tag);
            });

            if (currentText) {
              nodes.push($createTextNode(currentText));
            }

            if (nodes.length > 1) {
              nodes.forEach((node, index) => {
                if (index === 0) {
                  textNode.replace(node);
                } else {
                  textNode.insertAfter(node);
                }
              });
            }
          }
        }
      }
    );

    return removeTransform;
  }, [editor]);

  return null;
}

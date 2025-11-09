"use client"

import React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection, $isTextNode, $isElementNode, $getNodeByKey, LexicalNode, TextNode } from "lexical"
import { useEditorSidebar } from "../sidebar-editor-provider"

// Este plugin apenas captura a seleção e inicia o rascunho no sidebar
export default function CommentsPlugin() {
  const [editor] = useLexicalComposerContext()
  const { beginCommentDraft } = useEditorSidebar()

  React.useEffect(() => {
    const onOpen = () => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const selText = selection.getTextContent()
          const resolveToTextPoint = (key: string, offset: number, preferStart: boolean): { key: string; offset: number } | null => {
            const node = $getNodeByKey(key)
            if (!node) return null
            if ($isTextNode(node)) {
              const size = node.getTextContentSize?.() ?? (node.getTextContent?.().length ?? 0)
              const nextOffset = Math.max(0, Math.min(offset ?? 0, size))
              return { key: node.getKey(), offset: nextOffset }
            }
            if ($isElementNode(node)) {
              const children = node.getChildren() as LexicalNode[]
              const clampIndex = Math.max(0, Math.min(offset ?? 0, children.length > 0 ? children.length - 1 : 0))
              const startIdx = preferStart ? clampIndex : Math.min(clampIndex, children.length - 1)
              const target = children[startIdx] ?? null
              const findFirstText = (n: LexicalNode): TextNode | null => {
                if ($isTextNode(n)) return n
                if ($isElementNode(n)) {
                  const ch = n.getChildren()
                  for (const c of ch) {
                    const found = findFirstText(c)
                    if (found) return found
                  }
                }
                return null
              }
              const findLastText = (n: LexicalNode): TextNode | null => {
                if ($isTextNode(n)) return n
                if ($isElementNode(n)) {
                  const ch = n.getChildren()
                  for (let i = ch.length - 1; i >= 0; i--) {
                    const found = findLastText(ch[i])
                    if (found) return found
                  }
                }
                return null
              }
              const chosen = preferStart ? findFirstText(target ?? node) : findLastText(target ?? node)
              if (chosen) {
                const size = chosen.getTextContentSize?.() ?? (chosen.getTextContent?.().length ?? 0)
                const nextOffset = preferStart ? 0 : size
                return { key: chosen.getKey(), offset: nextOffset }
              }
            }
            return null
          }
          const a = resolveToTextPoint(selection.anchor.getNode().getKey(), selection.anchor.offset, true)
          const b = resolveToTextPoint(selection.focus.getNode().getKey(), selection.focus.offset, false)
          if (a && b) {
            beginCommentDraft({
              anchorKey: a.key,
              anchorOffset: a.offset,
              focusKey: b.key,
              focusOffset: b.offset,
              excerpt: selText || "",
            })
          }
        }
      })
    }
    window.addEventListener("editor-open-comment-dialog", onOpen)
    return () => {
      window.removeEventListener("editor-open-comment-dialog", onOpen)
    }
  }, [editor, beginCommentDraft])

  return null
}
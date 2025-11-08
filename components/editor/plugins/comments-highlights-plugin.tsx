"use client"

import React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getRoot,
  $isTextNode,
  $isElementNode,
  $getSelection,
  $isRangeSelection,
  TextNode,
  $createRangeSelection,
} from "lexical"
import { $patchStyleText } from "@lexical/selection"
import { useEditorSidebar } from "../sidebar-editor-provider"

function removeHighlightStyle(orig: string | null | undefined) {
  const entries = (orig || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
  const filtered = entries.filter(
    (e) =>
      !e.startsWith("background-color:") &&
      !e.startsWith("border-bottom:") &&
      !e.startsWith("cursor:") &&
      !e.startsWith("comment-id:")
  )
  return filtered.join("; ")
}

export default function CommentsHighlightsPlugin() {
  const [editor] = useLexicalComposerContext()
  const { comments, setActiveTab, focusTextByKey, setActiveCommentId } = useEditorSidebar()

  const applyHighlights = React.useCallback(() => {
    // First, clear any previous comment highlight styles across all text nodes
    editor.update(() => {
      const root = $getRoot()
      const stack = root.getChildren()
      const textNodes: TextNode[] = []
      while (stack.length) {
        const node = stack.pop()!
        if ($isTextNode(node)) {
          textNodes.push(node)
        } else if ($isElementNode(node)) {
          stack.push(...node.getChildren())
        }
      }
      for (const tn of textNodes) {
        const style = tn.getStyle?.() as string | undefined
        if ((style || "").includes("comment-id:")) {
          const next = removeHighlightStyle(style)
          tn.setStyle(next)
        }
      }
    })

    // Then, apply highlights for the exact ranges of each comment
    editor.update(() => {
      comments.forEach((c) => {
        const sel = $createRangeSelection()
        sel.anchor.set(c.anchorKey, c.anchorOffset, "text")
        sel.focus.set(c.focusKey, c.focusOffset, "text")
        $patchStyleText(sel, {
          "background-color": "hsl(var(--primary) / 0.18)",
          "border-bottom": "1px dotted hsl(var(--primary))",
          cursor: "pointer",
          "comment-id": c.id,
        })
      })
    })
  }, [editor, comments])

  React.useEffect(() => {
    applyHighlights()
  }, [applyHighlights])

  React.useEffect(() => {
    const rootEl = editor.getRootElement()
    if (!rootEl) return
    const onClick = () => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const node = selection.anchor.getNode()
          if (node instanceof TextNode) {
            const style = node.getStyle() || ""
            const match = /comment-id:\s*([^;]+)/.exec(style)
            if (match) {
              const commentId = match[1].trim()
              const key = node.getKey()
              setActiveTab("comentarios")
              setActiveCommentId(commentId)
              focusTextByKey(key)
            }
          }
        }
      })
    }
    rootEl.addEventListener("click", onClick)
    return () => {
      rootEl.removeEventListener("click", onClick)
    }
  }, [editor, setActiveTab, setActiveCommentId, focusTextByKey])

  return null
}
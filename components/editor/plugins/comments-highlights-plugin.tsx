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
  $getNodeByKey,
  LexicalNode,
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
      !e.startsWith("comment-id:") &&
      !e.startsWith("comment-draft:")
  )
  return filtered.join("; ")
}

export default function CommentsHighlightsPlugin() {
  const [editor] = useLexicalComposerContext()
  const { comments, commentDraft, setActiveTab, focusTextByKey, setActiveCommentId } = useEditorSidebar()

  // Resolve a point (key, offset) to a valid text node/offset.
  // When the key points to an element (e.g., paragraph), we try to
  // map the offset to its child and then descend to the closest text node.
  const resolveToTextPoint = React.useCallback(
    (key: string, offset: number, preferStart: boolean): { key: string; offset: number } | null => {
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
    },
    []
  )

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
        if ((style || "").includes("comment-id:") || (style || "").includes("comment-draft:")) {
          const next = removeHighlightStyle(style)
          tn.setStyle(next)
        }
      }
    })

    // Then, apply highlights for the exact ranges of each comment
    editor.update(() => {
      comments.forEach((c) => {
        const a = resolveToTextPoint(c.anchorKey, c.anchorOffset, true)
        const b = resolveToTextPoint(c.focusKey, c.focusOffset, false)
        if (!a || !b) return
        const sel = $createRangeSelection()
        sel.anchor.set(a.key, a.offset, "text")
        sel.focus.set(b.key, b.offset, "text")
        $patchStyleText(sel, {
          // Contraste mais alto para garantir visibilidade
          "background-color": "rgba(255, 208, 0, 0.35)",
          "border-bottom": "1px dotted hsl(var(--primary))",
          cursor: "pointer",
          "comment-id": c.id,
        })
      })
      // Also highlight the current draft selection, if any (lighter)
      if (commentDraft) {
        const a = resolveToTextPoint(commentDraft.anchorKey, commentDraft.anchorOffset, true)
        const b = resolveToTextPoint(commentDraft.focusKey, commentDraft.focusOffset, false)
        if (a && b) {
          const dsel = $createRangeSelection()
          dsel.anchor.set(a.key, a.offset, "text")
          dsel.focus.set(b.key, b.offset, "text")
          $patchStyleText(dsel, {
            "background-color": "rgba(255, 208, 0, 0.22)",
            "border-bottom": "1px dashed hsl(var(--primary))",
            cursor: "text",
            "comment-draft": "1",
          })
        }
      }
    })
  }, [editor, comments, commentDraft, resolveToTextPoint])

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
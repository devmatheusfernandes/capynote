"use client"

import React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
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
          const key = selection.anchor.getNode().getKey()
          beginCommentDraft({
            anchorKey: selection.anchor.getNode().getKey(),
            anchorOffset: selection.anchor.offset,
            focusKey: selection.focus.getNode().getKey(),
            focusOffset: selection.focus.offset,
            excerpt: selText || "",
          })
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
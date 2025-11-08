"use client"

import React from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore"

type Props = {
  children: React.ReactNode
  noteId?: string
}

type EditorSidebarContextValue = {
  activeTab: "texto" | "todos" | "comentarios"
  setActiveTab: (tab: "texto" | "todos" | "comentarios") => void
  activeCommentId: string | null
  setActiveCommentId: (id: string | null) => void
  bibleTitle: string | null
  bibleText: string | null
  bibleLoading: boolean
  bibleError: string | null
  beginBiblePanel: (title: string) => void
  finishBiblePanel: (text: string) => void
  errorBiblePanel: (message: string) => void
  clearBiblePanel: () => void
  allBibleTexts: { key: string; title: string; content: string }[]
  setAllBibleTexts: (items: { key: string; title: string; content: string }[]) => void
  focusTextByKey: (key: string) => void
  comments: { id: string; anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string; text: string; createdAt: number }[]
  addComment: (data: { anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string; text: string }) => void
  updateComment: (id: string, text: string) => void
  deleteComment: (id: string) => void
  clearComments: () => void
  commentDraft: { anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string } | null
  beginCommentDraft: (data: { anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string }) => void
  clearCommentDraft: () => void
}

const EditorSidebarContext = React.createContext<EditorSidebarContextValue | null>(null)

export function useEditorSidebar() {
  const ctx = React.useContext(EditorSidebarContext)
  if (!ctx) throw new Error("useEditorSidebar must be used within SidebarEditorProvider")
  return ctx
}

export default function SidebarEditorProvider({ children, noteId }: Props) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = React.useState<"texto" | "todos" | "comentarios">("texto")
  const [activeCommentId, setActiveCommentId] = React.useState<string | null>(null)
  const [bibleTitle, setBibleTitle] = React.useState<string | null>(null)
  const [bibleText, setBibleText] = React.useState<string | null>(null)
  const [bibleLoading, setBibleLoading] = React.useState<boolean>(false)
  const [bibleError, setBibleError] = React.useState<string | null>(null)
  const [allBibleTexts, setAllBibleTexts] = React.useState<{ key: string; title: string; content: string }[]>([])
  const [comments, setComments] = React.useState<{ id: string; anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string; text: string; createdAt: number }[]>([])
  const [commentDraft, setCommentDraft] = React.useState<{ anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string } | null>(null)

  // Real-time subscription to comments stored alongside the note in Firestore
  React.useEffect(() => {
    if (!user?.id || !noteId) return
    const commentsRef = collection(db, "users", user.id, "notes", noteId, "comments")
    const unsub = onSnapshot(commentsRef, (snapshot) => {
      const items = snapshot.docs
        .map((d) => {
          const data = d.data() as any
          return {
            id: d.id,
            anchorKey: data.anchorKey,
            anchorOffset: Number(data.anchorOffset ?? 0),
            focusKey: data.focusKey,
            focusOffset: Number(data.focusOffset ?? 0),
            excerpt: data.excerpt ?? "",
            text: String(data.text ?? "").trim(),
            createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
          }
        })
        .sort((a, b) => b.createdAt - a.createdAt)
      setComments(items)
    })
    return () => unsub()
  }, [user?.id, noteId])

  const beginBiblePanel = React.useCallback((title: string) => {
    setActiveTab("texto")
    setBibleTitle(title)
    setBibleText(null)
    setBibleError(null)
    setBibleLoading(true)
  }, [])

  const finishBiblePanel = React.useCallback((text: string) => {
    setBibleText(text)
    setBibleLoading(false)
  }, [])

  const errorBiblePanel = React.useCallback((message: string) => {
    setBibleError(message)
    setBibleLoading(false)
  }, [])

  const clearBiblePanel = React.useCallback(() => {
    setBibleTitle(null)
    setBibleText(null)
    setBibleError(null)
    setBibleLoading(false)
  }, [])

  const focusTextByKey = React.useCallback((key: string) => {
    const evt = new CustomEvent("editor-focus-node", { detail: { key } })
    window.dispatchEvent(evt)
  }, [])

  const addComment = React.useCallback(
    async (data: { anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string; text: string }) => {
      if (!user?.id || !noteId) return
      const ref = doc(collection(db, "users", user.id, "notes", noteId, "comments"))
      const payload = {
        anchorKey: data.anchorKey,
        anchorOffset: data.anchorOffset,
        focusKey: data.focusKey,
        focusOffset: data.focusOffset,
        excerpt: data.excerpt,
        text: data.text.trim(),
        createdAt: Date.now(),
      }
      await setDoc(ref, payload)
      setActiveTab("comentarios")
      setActiveCommentId(ref.id)
    },
    [user?.id, noteId]
  )

  const updateComment = React.useCallback(
    async (id: string, text: string) => {
      if (!user?.id || !noteId) return
      const ref = doc(db, "users", user.id, "notes", noteId, "comments", id)
      await updateDoc(ref, { text: text.trim() })
    },
    [user?.id, noteId]
  )

  const deleteComment = React.useCallback(
    async (id: string) => {
      if (!user?.id || !noteId) return
      const ref = doc(db, "users", user.id, "notes", noteId, "comments", id)
      await deleteDoc(ref)
      if (activeCommentId === id) setActiveCommentId(null)
    },
    [user?.id, noteId, activeCommentId]
  )

  const clearComments = React.useCallback(() => {
    setComments([])
  }, [])

  const beginCommentDraft = React.useCallback((data: { anchorKey: string; anchorOffset: number; focusKey: string; focusOffset: number; excerpt: string }) => {
    setCommentDraft({
      anchorKey: data.anchorKey,
      anchorOffset: data.anchorOffset,
      focusKey: data.focusKey,
      focusOffset: data.focusOffset,
      excerpt: data.excerpt,
    })
    setActiveTab("comentarios")
  }, [])

  const clearCommentDraft = React.useCallback(() => {
    setCommentDraft(null)
  }, [])

  const value: EditorSidebarContextValue = React.useMemo(
    () => ({
      activeTab,
      setActiveTab,
      activeCommentId,
      setActiveCommentId,
      bibleTitle,
      bibleText,
      bibleLoading,
      bibleError,
      beginBiblePanel,
      finishBiblePanel,
      errorBiblePanel,
      clearBiblePanel,
      allBibleTexts,
      setAllBibleTexts,
      focusTextByKey,
      comments,
      addComment,
      updateComment,
      deleteComment,
      clearComments,
      commentDraft,
      beginCommentDraft,
      clearCommentDraft,
    }),
    [
      activeTab,
      activeCommentId,
      bibleTitle,
      bibleText,
      bibleLoading,
      bibleError,
      beginBiblePanel,
      finishBiblePanel,
      errorBiblePanel,
      allBibleTexts,
      comments,
      updateComment,
      commentDraft,
      beginCommentDraft,
      clearCommentDraft,
    ]
  )

  return (
    <SidebarProvider defaultOpen={false} className="has-data-[variant=inset]:bg-transparent">
      <EditorSidebarContext.Provider value={value}>{children}</EditorSidebarContext.Provider>
    </SidebarProvider>
  )
}
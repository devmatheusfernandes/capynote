"use client"

import React from "react"
import { SidebarProvider } from "@/components/ui/sidebar"

type Props = {
  children: React.ReactNode
}

type EditorSidebarContextValue = {
  activeTab: "texto" | "comentarios"
  setActiveTab: (tab: "texto" | "comentarios") => void
  bibleTitle: string | null
  bibleText: string | null
  bibleLoading: boolean
  bibleError: string | null
  beginBiblePanel: (title: string) => void
  finishBiblePanel: (text: string) => void
  errorBiblePanel: (message: string) => void
  clearBiblePanel: () => void
}

const EditorSidebarContext = React.createContext<EditorSidebarContextValue | null>(null)

export function useEditorSidebar() {
  const ctx = React.useContext(EditorSidebarContext)
  if (!ctx) throw new Error("useEditorSidebar must be used within SidebarEditorProvider")
  return ctx
}

export default function SidebarEditorProvider({ children }: Props) {
  const [activeTab, setActiveTab] = React.useState<"texto" | "comentarios">("texto")
  const [bibleTitle, setBibleTitle] = React.useState<string | null>(null)
  const [bibleText, setBibleText] = React.useState<string | null>(null)
  const [bibleLoading, setBibleLoading] = React.useState<boolean>(false)
  const [bibleError, setBibleError] = React.useState<string | null>(null)

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

  const value: EditorSidebarContextValue = React.useMemo(
    () => ({
      activeTab,
      setActiveTab,
      bibleTitle,
      bibleText,
      bibleLoading,
      bibleError,
      beginBiblePanel,
      finishBiblePanel,
      errorBiblePanel,
      clearBiblePanel,
    }),
    [activeTab, bibleTitle, bibleText, bibleLoading, bibleError, beginBiblePanel, finishBiblePanel, errorBiblePanel]
  )

  return (
    <SidebarProvider defaultOpen={false} className="has-data-[variant=inset]:bg-transparent">
      <EditorSidebarContext.Provider value={value}>{children}</EditorSidebarContext.Provider>
    </SidebarProvider>
  )
}
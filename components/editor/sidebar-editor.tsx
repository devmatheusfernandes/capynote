"use client"

import React from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useEditorSidebar } from "./sidebar-editor-provider"
import { Spinner } from "@/components/ui/spinner"

export default function SidebarEditor() {
  const router = useRouter()
  const {
    activeTab,
    setActiveTab,
    bibleTitle,
    bibleText,
    bibleLoading,
    bibleError,
    clearBiblePanel,
    allBibleTexts,
    focusTextByKey,
  } = useEditorSidebar()

  function navigateToBibleReference() {
    if (!bibleTitle) return
    const m = bibleTitle.match(/^(.+?)\s+(\d+)(?::\s*([\d,\-\s]+))?$/)
    if (!m) return
    const book = m[1].trim()
    const chapter = Number(m[2])
    const versesRaw = (m[3] || "").trim()
    let verse: number | undefined
    if (versesRaw) {
      const dash = versesRaw.match(/^(\d+)\s*\-\s*\d+$/)
      if (dash) {
        verse = Number(dash[1])
      } else {
        const first = versesRaw.split(/\s*,\s*/).map((v) => Number(v)).find((n) => !Number.isNaN(n))
        if (typeof first === "number") verse = first
      }
    }
    const params = new URLSearchParams({ book, chapter: String(chapter) })
    if (typeof verse === "number") params.set("verse", String(verse))
    router.push(`/dashboard/biblia?${params.toString()}`)
  }

  return (
    <Sidebar side="right" variant="floating" collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-medium">Editor</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "texto"}
                  onClick={() => setActiveTab("texto")}
                >
                  <span>Texto</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "todos"}
                  onClick={() => setActiveTab("todos")}
                >
                  <span>Todos os textos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "comentarios"}
                  onClick={() => setActiveTab("comentarios")}
                >
                  <span>Comentários</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <div className="px-2 py-1 text-sm">
          {activeTab === "texto" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{bibleTitle ?? "Texto"}</span>
                {(bibleTitle || bibleText || bibleError) && (
                  <button
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={clearBiblePanel}
                  >
                    Limpar
                  </button>
                )}
              </div>
              {bibleLoading && (
                <div className="py-4 flex items-center justify-center">
                  <Spinner />
                </div>
              )}
              {bibleError && (
                <div className="text-destructive">{bibleError}</div>
              )}
              {!bibleLoading && !bibleError && bibleText && (
                <div
                  className="whitespace-pre-wrap text-sm leading-relaxed cursor-pointer active:bg-muted/40 sm:hover:bg-muted/30 rounded-md p-2"
                  onClick={navigateToBibleReference}
                  title={bibleTitle ?? undefined}
                >
                  {bibleText}
                </div>
              )}
              {!bibleLoading && !bibleError && !bibleText && (
                <div className="text-muted-foreground">Selecione uma referência bíblica no texto para visualizar aqui.</div>
              )}
            </div>
          ) : activeTab === "todos" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Todos os textos</span>
              </div>
              {allBibleTexts.length === 0 ? (
                <div className="text-muted-foreground">Nenhum texto bíblico encontrado nesta nota.</div>
              ) : (
                <div className="max-h-[50vh] overflow-auto pr-2 space-y-3">
                  {allBibleTexts.map((item, idx) => (
                    <button
                      key={`${item.key}-${idx}`}
                      className="w-full text-left rounded-md border p-2 hover:bg-muted focus:outline-none"
                      onClick={() => focusTextByKey(item.key)}
                      title={item.title}
                    >
                      <div className="text-xs text-muted-foreground mb-1">{item.title}</div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">
                        {item.content}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>Comentários</div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

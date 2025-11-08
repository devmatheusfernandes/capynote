"use client"

import React from "react"
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
  const {
    activeTab,
    setActiveTab,
    bibleTitle,
    bibleText,
    bibleLoading,
    bibleError,
    clearBiblePanel,
  } = useEditorSidebar()

  return (
    <Sidebar side="right" variant="floating" collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-medium">Editor</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Abas</SidebarGroupLabel>
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
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {bibleText}
                </div>
              )}
              {!bibleLoading && !bibleError && !bibleText && (
                <div className="text-muted-foreground">Selecione uma referência bíblica no texto para visualizar aqui.</div>
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
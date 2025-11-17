"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useIntegratedEditor } from "./integrated-editor-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function IntegratedSidebar({ open, onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [newCommentText, setNewCommentText] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const {
    activeTab,
    setActiveTab,
    activeCommentId,
    bibleTitle,
    bibleText,
    bibleLoading,
    bibleError,
    clearBiblePanel,
    allBibleTexts,
    focusTextByKey,
    comments,
    deleteComment,
    commentDraft,
    clearCommentDraft,
    addComment,
    updateComment,
  } = useIntegratedEditor();

  React.useEffect(() => {
    if (commentDraft) onOpenChange(true);
  }, [commentDraft, onOpenChange]);

  React.useEffect(() => {
    if (bibleTitle) onOpenChange(true);
  }, [bibleTitle, onOpenChange]);

  function navigateToBibleReference() {
    if (!bibleTitle) return;
    const m = bibleTitle.match(/^(.+?)\s+(\d+)(?::\s*([\d,\-\s]+))?$/);
    if (!m) return;
    const book = m[1].trim();
    const chapter = Number(m[2]);
    const versesRaw = (m[3] || "").trim();
    let verse: number | undefined;
    if (versesRaw) {
      const dash = versesRaw.match(/^(\d+)\s*\-\s*\d+$/);
      if (dash) {
        verse = Number(dash[1]);
      } else {
        const first = versesRaw
          .split(/\s*,\s*/)
          .map((v) => Number(v))
          .find((n) => !Number.isNaN(n));
        if (typeof first === "number") verse = first;
      }
    }
    const params = new URLSearchParams({ book, chapter: String(chapter) });
    if (typeof verse === "number") params.set("verse", String(verse));
    router.push(`/dashboard/biblia?${params.toString()}`);
  }

  const panel = (
    <div className="flex h-full w-full flex-col bg-background border-l">
      <div className="flex items-center gap-2 p-2 border-b">
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(!open)} title={open ? "Fechar" : "Abrir"}>
          {open ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
        <div className="flex gap-1">
          <Button variant={activeTab === "texto" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("texto")}>Texto</Button>
          <Button variant={activeTab === "todos" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("todos")}>Todos os textos</Button>
          <Button variant={activeTab === "comentarios" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("comentarios")}>
            Comentários
            {comments.length > 0 && <Badge variant="outline" className="ml-2">{comments.length}</Badge>}
          </Button>
        </div>
        <div className="ml-auto" />
      </div>

      <div className="px-2 py-2 text-sm flex-1 overflow-auto">
        {activeTab === "texto" ? (
          <div className="space-y-2">
            {bibleLoading && <div className="py-4 flex items-center justify-center">Carregando...</div>}
            {bibleError && <div className="text-destructive">{bibleError}</div>}
            {!bibleLoading && !bibleError && bibleText && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed cursor-pointer active:bg-muted/40 sm:hover:bg-muted/30 rounded-md p-2" onClick={navigateToBibleReference} title={bibleTitle ?? undefined}>
                {bibleText}
              </div>
            )}
            {!bibleLoading && !bibleError && !bibleText && (
              <div className="text-muted-foreground">Selecione uma referência bíblica no texto para visualizar aqui.</div>
            )}
          </div>
        ) : activeTab === "todos" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className="font-medium">Todos os textos</span></div>
            {allBibleTexts.length === 0 ? (
              <div className="text-muted-foreground">Nenhum texto bíblico encontrado nesta nota.</div>
            ) : (
              <div className="max-h-full overflow-auto pr-2 space-y-3">
                {allBibleTexts.map((item, idx) => (
                  <button key={`${item.key}-${idx}`} className="w-full text-left rounded-md border p-2 hover:bg-muted focus:outline-none" onClick={() => focusTextByKey(item.key)} title={item.title}>
                    <div className="text-xs text-muted-foreground mb-1">{item.title}</div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">{item.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="font-medium">Comentários</span></div>
            {commentDraft && (
              <div className="rounded-md border p-2 space-y-2">
                <div className="text-xs text-muted-foreground italic">{commentDraft.excerpt || "(vazia)"}</div>
                <Textarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Escreva seu comentário" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { const text = (newCommentText || "").trim(); addComment({ anchorKey: commentDraft.anchorKey, anchorOffset: commentDraft.anchorOffset, focusKey: commentDraft.focusKey, focusOffset: commentDraft.focusOffset, excerpt: commentDraft.excerpt, text: text || "(sem texto)" }); setNewCommentText(""); clearCommentDraft(); }}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNewCommentText(""); clearCommentDraft(); }}>Cancelar</Button>
                </div>
              </div>
            )}
            {comments.length === 0 ? (
              <div className="text-muted-foreground">Nenhum comentário nesta nota.</div>
            ) : (
              <div className="max-h-full overflow-auto pr-2 space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className={`rounded-md border p-2 relative ${activeCommentId === c.id ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="absolute right-2 top-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingId(c.id); setEditText(c.text); }}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteComment(c.id)}>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="w-full text-left cursor-pointer" role="button" tabIndex={0} onClick={() => { if (editingId !== c.id) { focusTextByKey(c.anchorKey); } }} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && editingId !== c.id) { e.preventDefault(); focusTextByKey(c.anchorKey); } }} title={c.excerpt}>
                      <div className="text-xs text-muted-foreground mb-1 italic line-clamp-2">{c.excerpt}</div>
                      {editingId === c.id ? (
                        <div className="space-y-2">
                          <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); const txt = (editText || "").trim(); updateComment(c.id, txt || "(sem texto)"); setEditingId(null); setEditText(""); }}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditText(""); }}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{c.text}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && pathname?.startsWith("/dashboard/notas/editar/") && (
          <motion.div
            className="fixed inset-0 z-30 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {panel}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && pathname?.startsWith("/dashboard/notas/editar/") && (
        <motion.div
          className={`fixed inset-y-0 right-0 z-20`}
          style={{ width: "22rem" }}
          initial={{ x: 352, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 352, opacity: 0 }}
          transition={{ type: "tween", duration: 0.2 }}
        >
          {panel}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
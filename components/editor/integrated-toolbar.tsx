"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save as SaveIcon, SaveOff, ArrowLeft, BookOpen, MoreVertical } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { TagSelector } from "@/components/tag-selector";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingWrites: boolean;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  onSave: () => void;
  onDelete: () => void;
  openReadMode: boolean;
  setOpenReadMode: (open: boolean) => void;
  onToggleSidebar: () => void;
};

export default function IntegratedToolbar({ title, onTitleChange, pendingWrites, tags, onTagsChange, onSave, onDelete, openReadMode, setOpenReadMode, onToggleSidebar }: Props) {
  const router = useRouter();
  return (
    <div className="fixed top-0 left-0 right-0 z-10 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 md:px-6 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="shrink-0" aria-label="Voltar" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Voltar</span>
          </Button>
          <Input placeholder="Título da nota..." value={title} onChange={onTitleChange} className="text-base md:text-lg font-medium border-0 px-2 md:px-3 py-1.5 focus-visible:ring-1 focus-visible:ring-primary bg-transparent hover:bg-muted/50 transition-colors" />
          <Badge variant="outline" className={`text-md ${pendingWrites ? " text-amber-600" : " text-emerald-700"}`} title={pendingWrites ? "Somente offline, aguardando upload" : "Sincronizado com o banco"}>
            {pendingWrites ? <SaveOff className="h-4 w-4" /> : <SaveIcon className="h-4 w-4" />}
          </Badge>
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Abrir painel" title="Painel">
            <BookOpen className="h-5 w-5" />
          </Button>
          {openReadMode ? (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setOpenReadMode(false)}>Sair</Button>
          ) : (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-auto" aria-label="Abrir opções">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Opções</SheetTitle>
                </SheetHeader>
                <div className="p-4 space-y-2">
                  <SheetClose asChild>
                    <Button variant="secondary" className="w-full justify-start gap-2" onClick={() => setOpenReadMode(true)}>
                      <BookOpen className="h-4 w-4" />
                      Modo leitura
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={onSave}>
                      <SaveIcon className="h-4 w-4" />
                      Salvar arquivo
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="destructive" className="w-full justify-start gap-2" onClick={onDelete}>
                      Apagar arquivo
                    </Button>
                  </SheetClose>
                </div>
                <div className="p-4 border-t">
                  <div className="text-sm font-medium mb-2">Tags</div>
                  <TagSelector selectedTags={tags} onTagsChange={onTagsChange} placeholder="Adicionar tags..." mode="id" />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
}
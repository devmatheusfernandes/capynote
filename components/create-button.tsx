"use client";

import * as React from "react";
import { useState } from "react";
import { Plus, FileText, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NoteDrawer } from "@/components/note-drawer";
import { TaskDrawer } from "@/components/task-drawer";
import { cn } from "@/lib/utils";

interface CreateButtonProps {
  variant?: "floating" | "desktop";
  className?: string;
}

export function CreateButton({
  variant = "desktop",
  className,
}: CreateButtonProps) {
  const isFloating = variant === "floating";
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);

  const handleNewNote = () => {
    setNoteDrawerOpen(true);
  };

  const handleNewTask = () => {
    setTaskDrawerOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={isFloating ? "lg" : "default"}
            className={cn(
              isFloating && [
                "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
                "md:hidden", // Só aparece no mobile
                "bg-primary text-white hover:bg-primary",
              ],
              !isFloating &&
                "flex bg-primary hover:bg-primary text-white items-center gap-2",
              className
            )}
          >
            <Plus className={cn("h-4 w-4", isFloating && "h-6 w-6")} />
            {!isFloating && "Criar"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isFloating ? "end" : "start"}
          className="w-48"
        >
          <DropdownMenuItem
            onClick={handleNewNote}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Nova Nota
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleNewTask}
            className="flex items-center gap-2 cursor-pointer"
          >
            <CheckSquare className="h-4 w-4" />
            Nova Tarefa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NoteDrawer open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen} />

      <TaskDrawer open={taskDrawerOpen} onOpenChange={setTaskDrawerOpen} />
    </>
  );
}

// Componente específico para o botão flutuante (mobile)
export function FloatingCreateButton() {
  return <CreateButton variant="floating" />;
}

// Componente específico para desktop
export function DesktopCreateButton({ className }: { className?: string }) {
  return <CreateButton variant="desktop" className={className} />;
}

"use client";

import { useState } from "react";
import { Folder, MoreVertical, Edit, Trash2, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { FolderData } from "@/types";

interface FolderCardProps {
  folder: FolderData;
  noteCount: number;
  onOpen: (folderId: string) => void;
  onRename: (folderId: string, newName: string) => void;
  onDelete: (folderId: string) => void;
  syncPending?: boolean;
  onDropNote?: (folderId: string, noteId: string) => void;
}

export function FolderCard({
  folder,
  noteCount,
  onOpen,
  onRename,
  onDelete,
  syncPending,
  onDropNote,
}: FolderCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== folder.name) {
      onRename(folder.id, newName.trim());
    }
    setIsRenaming(false);
    setNewName(folder.name);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setNewName(folder.name);
    }
  };

  const handleDelete = () => {
    onDelete(folder.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card
        className={`group hover:shadow-md transition-shadow cursor-pointer ${
          isDragOver ? "ring-2 ring-primary/50" : ""
        }`}
        onDragOver={(e) => {
          // Allow dropping notes
          if (onDropNote) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragEnter={(e) => {
          if (onDropNote) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          setIsDragOver(false);
          const noteId = e.dataTransfer.getData("text/plain");
          if (onDropNote && noteId) {
            onDropNote(folder.id, noteId);
          }
        }}
      >
        <CardContent className="">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center space-x-3 flex-1 min-w-0"
              onClick={() => !isRenaming && onOpen(folder.id)}
            >
              <div className="flex-shrink-0 relative">
                <Folder className="h-8 w-8 text-primary" />
                <span
                  className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${
                    syncPending ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  title={syncPending ? "Somente offline, aguardando upload" : "Sincronizado"}
                  aria-label={syncPending ? "Alterações pendentes (offline)" : "Sincronizado"}
                />
              </div>
              <div className="flex-1 min-w-0">
                {isRenaming ? (
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyPress}
                    className="h-6 text-sm font-medium"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div>
                    <h3 className="font-medium text-sm truncate">
                      {folder.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {noteCount} {noteCount === 1 ? "nota" : "notas"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen(folder.id)}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Abrir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => folder.id !== "archive" && setShowDeleteDialog(true)}
                  className="text-destructive"
                  disabled={folder.id === "archive"}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pasta {folder.name}? Todas as
              subpastas também serão excluídas e as notas serão movidas para a
              pasta raiz. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

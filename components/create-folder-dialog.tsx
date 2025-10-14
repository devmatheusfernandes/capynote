"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateFolderDialogProps {
  onCreateFolder: (name: string) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateFolderDialog({
  onCreateFolder,
  open: externalOpen,
  onOpenChange,
}: CreateFolderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [folderName, setFolderName] = useState("");

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName("");
      setOpen(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Pasta</DialogTitle>
          <DialogDescription>
            Digite o nome da nova pasta. Ela será criada na pasta atual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            id="name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="col-span-3"
            placeholder="Nome da pasta..."
            autoFocus
          />
          <Label className="hidden" htmlFor="name">
            Nome da Pasta
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!folderName.trim()}>
            Criar Pasta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

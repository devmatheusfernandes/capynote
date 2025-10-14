"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Check, Plus, Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { TagData } from "@/types";

interface TagSelectorProps {
  // Pode representar IDs ou nomes, conforme o modo
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  // 'id' para trabalhar com IDs de tags; 'name' para nomes (compatibilidade)
  mode?: "id" | "name";
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  placeholder = "Buscar ou criar tags...",
  className,
  mode = "name",
}: TagSelectorProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);

  // Assinar tags do Firestore por usuário
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const tagsRef = collection(db, "users", userId, "tags");
    const unsubscribe = onSnapshot(tagsRef, (snapshot) => {
      const tags: TagData[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<TagData>;
        return {
          id: d.id,
          name: data.name || d.id,
          createdAt: (data.createdAt as Date | undefined)
            ? String(data.createdAt)
            : new Date().toISOString(),
          updatedAt: data.updatedAt,
          color: data.color,
        };
      });
      setAvailableTags(tags);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Filtrar tags que não estão selecionadas e que correspondem ao input
  const unselectedTags = availableTags.filter((tag) => {
    const matchesInput = tag.name
      .toLowerCase()
      .includes(inputValue.toLowerCase());
    const isSelected =
      mode === "id"
        ? selectedTags.includes(tag.id)
        : selectedTags
            .map((t) => t.toLowerCase())
            .includes(tag.name.toLowerCase());
    return !isSelected && matchesInput;
  });

  // Verificar se o input é uma nova tag
  const isNewTag =
    inputValue.trim().length > 0 &&
    !availableTags.some(
      (tag) => tag.name.toLowerCase() === inputValue.toLowerCase()
    ) &&
    !selectedTags.some((tag) => tag.toLowerCase() === inputValue.toLowerCase());

  // Adicionar tag
  const addTag = async (tagName: string) => {
    const trimmedName = tagName.trim();
    if (!trimmedName) return;

    // Verifica se já existe uma tag com esse nome (case-insensitive)
    const existing = availableTags.find(
      (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
    );
    let selectedValue = trimmedName;

    if (existing) {
      selectedValue = mode === "id" ? existing.id : existing.name;
    } else {
      // Criar no Firestore
      const userId = user?.id;
      if (userId) {
        const tagRef = doc(collection(db, "users", userId, "tags"));
        await setDoc(tagRef, {
          name: trimmedName,
          createdAt: serverTimestamp(),
        });
        // Atualizar lista local
        const newTag: TagData = {
          id: tagRef.id,
          name: trimmedName,
          createdAt: new Date().toISOString(),
        };
        setAvailableTags((prev) => [...prev, newTag]);
        selectedValue = mode === "id" ? tagRef.id : trimmedName;
      }
    }

    // Evitar duplicados
    if (mode === "id") {
      if (selectedTags.includes(selectedValue)) return;
    } else {
      if (
        selectedTags
          .map((t) => t.toLowerCase())
          .includes(selectedValue.toLowerCase())
      )
        return;
    }

    onTagsChange([...selectedTags, selectedValue]);
    setInputValue("");
  };

  // Remover tag
  const removeTag = (tagToRemove: string) => {
    const newSelectedTags = selectedTags.filter((tag) => tag !== tagToRemove);
    onTagsChange(newSelectedTags);
  };

  // Lidar com seleção de comando
  const handleSelect = (value: string) => {
    if (value === "create-new") {
      addTag(inputValue);
    } else {
      addTag(value);
    }
  };

  return (
    <div className={cn("", className)}>
      {/* Tags selecionadas */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => {
            const tagName =
              mode === "id"
                ? availableTags.find((t) => t.id === tag)?.name || tag
                : tag;
            return (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2 py-1 gap-1"
              >
                <Tag className="h-3 w-3" />
                {tagName}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 hover:bg-transparent"
                  onClick={() => removeTag(tag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Botão para abrir o seletor */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full justify-start text-muted-foreground"
      >
        <Tag className="h-4 w-4 mr-2" />
        {placeholder}
      </Button>

      {/* Dialog do Command */}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Selecionar Tags"
        description="Busque por tags existentes ou crie novas"
      >
        <CommandInput
          placeholder={placeholder}
          value={inputValue}
          onValueChange={setInputValue}
        />
        <CommandList>
          <CommandEmpty>
            {inputValue.trim()
              ? "Nenhuma tag encontrada"
              : "Digite para buscar tags"}
          </CommandEmpty>

          {/* Tags existentes */}
          {unselectedTags.length > 0 && (
            <CommandGroup heading="Tags existentes">
              {unselectedTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={handleSelect}
                  className="flex items-center gap-2"
                >
                  <Tag className="h-4 w-4" />
                  <span>{tag.name}</span>
                  <Check className="ml-auto h-4 w-4" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Criar nova tag */}
          {isNewTag && (
            <CommandGroup heading="Criar nova">
              <CommandItem
                value="create-new"
                onSelect={handleSelect}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Criar tag: {inputValue}</span>
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

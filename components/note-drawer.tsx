"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Maximize2, Trash2, Folder } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NoteEditorWithToolbar from "@/components/editor/note-editor-with-toolbar";
import IntegratedEditorProvider from "@/components/editor/integrated-editor-provider";
import { TagSelector } from "@/components/tag-selector";
import { NoteData, FolderData, TagData } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

interface NoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNote?: NoteData;
  currentFolderId?: string;
}

export function NoteDrawer({
  open,
  onOpenChange,
  existingNote,
  currentFolderId,
}: NoteDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState(existingNote?.title || "");
  const [content, setContent] = useState(existingNote?.content || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    existingNote?.tagIds || existingNote?.tags || []
  );
  const [folderId, setFolderId] = useState<string | undefined>(
    existingNote?.folderId || currentFolderId
  );
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [noteId] = useState(
    () =>
      existingNote?.id ||
      `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);

  // Subscribe to user's folders from Firestore
  useEffect(() => {
    if (!user?.id) return;
    const foldersRef = collection(db, "users", user.id, "folders");
    const unsub = onSnapshot(foldersRef, (snapshot) => {
      const fetchedFolders: FolderData[] = snapshot.docs.map(
        (d) => d.data() as FolderData
      );
      setFolders(fetchedFolders);
    });
    return () => unsub();
  }, [user?.id]);

  // Update states when existingNote changes
  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title || "");
      setContent(existingNote.content || "");
      setSelectedTags(existingNote.tagIds || existingNote.tags || []);
      setFolderId(existingNote.folderId);
      setHasChanges(false);
    } else {
      setTitle("");
      setContent("");
      setSelectedTags([]);
      setFolderId(currentFolderId);
      setHasChanges(false);
    }
  }, [existingNote, currentFolderId]);

  // Subscribe to user's tags from Firestore for name resolution
  useEffect(() => {
    if (!user?.id) return;
    const tagsRef = collection(db, "users", user.id, "tags");
    const unsub = onSnapshot(tagsRef, (snapshot) => {
      const fetchedTags: TagData[] = snapshot.docs.map((d) => {
        const data = d.data() as TagData;
        return {
          id: d.id,
          name: data.name || d.id,
          createdAt: data.createdAt
            ? String(data.createdAt)
            : new Date().toISOString(),
          updatedAt: data.updatedAt,
          color: data.color,
        };
      });
      setAvailableTags(fetchedTags);
    });
    return () => unsub();
  }, [user?.id]);

  // Function to check if content has meaningful text
  const hasRealContent = useCallback(() => {
    // Check if title has content
    if (title.trim()) return true;

    // Check if content has meaningful text
    if (!content.trim()) return false;

    try {
      // Parse Lexical editor state
      const parsed = JSON.parse(content);
      if (parsed.root && parsed.root.children) {
        let hasText = false;

        type SerializedNode = {
          text?: string;
          children?: SerializedNode[];
        };

        const extractText = (node: SerializedNode) => {
          if (node.text && node.text.trim()) {
            hasText = true;
            return;
          }
          if (node.children) {
            node.children.forEach(extractText);
          }
        };

        parsed.root.children.forEach(extractText);
        return hasText;
      }
    } catch {
      // If not JSON, treat as plain text
      return content.trim().length > 0;
    }

    return false;
  }, [title, content]);

  // Auto-save functionality
  const saveNote = useCallback(async () => {
    if (!hasRealContent()) return;
    if (!user?.id) return;

    // Persist tag IDs, creating missing tags by name
    const toId = async (value: string): Promise<string> => {
      const byId = availableTags.find((t) => t.id === value);
      if (byId) return byId.id;
      const byName = availableTags.find(
        (t) => t.name.toLowerCase() === value.toLowerCase()
      );
      if (byName) return byName.id;
      const tagRef = doc(collection(db, "users", user.id, "tags"));
      await setDoc(tagRef, { name: value });
      const newTag: TagData = {
        id: tagRef.id,
        name: value,
        createdAt: new Date().toISOString(),
      };
      setAvailableTags((prev) => [...prev, newTag]);
      return tagRef.id;
    };

    const resolvedTagIds: string[] = await Promise.all(selectedTags.map(toId));
    const resolvedTagNames: string[] = resolvedTagIds.map(
      (id) => availableTags.find((t) => t.id === id)?.name || id
    );

    const noteDataBase = {
      id: noteId,
      title: title.trim() || "Nota sem título",
      content,
      tagIds: resolvedTagIds,
      tags: resolvedTagNames,
      createdAt: existingNote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const noteData: NoteData = folderId
      ? { ...noteDataBase, folderId }
      : (noteDataBase as NoteData);
    const noteRef = doc(db, "users", user.id, "notes", noteId);
    await setDoc(noteRef, noteData);

    setHasChanges(false);
  }, [
    hasRealContent,
    title,
    content,
    selectedTags,
    availableTags,
    folderId,
    noteId,
    existingNote?.createdAt,
    user?.id,
  ]);

  // Auto-save when content changes
  useEffect(() => {
    if (hasChanges) {
      const timeoutId = setTimeout(() => {
        saveNote();
      }, 1000); // Auto-save after 1 second of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [hasChanges, saveNote]);

  // Handle content changes
  const handleContentChange = useCallback((serializedState: string) => {
    setContent(serializedState);
    setHasChanges(true);
  }, []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      setHasChanges(true);
    },
    []
  );

  const handleTagsChange = useCallback((newTags: string[]) => {
    setSelectedTags(newTags);
    setHasChanges(true);
  }, []);

  const handleFolderChange = useCallback((newFolderId: string) => {
    setFolderId(newFolderId === "root" ? undefined : newFolderId);
    setHasChanges(true);
  }, []);

  // Get folder name for display
  // const getFolderName = useCallback(
  //   (folderId?: string) => {
  //     if (!folderId) return "Raiz";
  //     const folder = folders.find((f) => f.id === folderId);
  //     return folder?.name || "Pasta não encontrada";
  //   },
  //   [folders]
  // );

  // Get folder path for display
  const getFolderPath = useCallback(
    (folderId?: string) => {
      if (!folderId) return "Raiz";
      const path: FolderData[] = [];
      let currentFolder = folders.find((f) => f.id === folderId);
      while (currentFolder) {
        path.unshift(currentFolder);
        currentFolder = currentFolder.parentId
          ? folders.find((f) => f.id === currentFolder!.parentId)
          : undefined;
      }
      return path.map((item) => item.name).join(" / ");
    },
    [folders]
  );

  // Handle drawer close
  const handleClose = useCallback(() => {
    // Only save if there's real content
    if (hasChanges && hasRealContent()) {
      saveNote();
    }
    onOpenChange(false);
    // Reset state after a delay to allow drawer animation
    setTimeout(() => {
      setTitle("");
      setContent("");
      setSelectedTags([]);
      setFolderId(currentFolderId);
      setHasChanges(false);
    }, 300);
  }, [hasChanges, hasRealContent, saveNote, onOpenChange, currentFolderId]);

  // Handle discard - show confirmation dialog
  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(true);
  }, []);

  // Confirm discard
  const confirmDiscard = useCallback(async () => {
    if (!user?.id) return;
    // Remove from Firestore if it exists
    const noteRef = doc(db, "users", user.id, "notes", noteId);
    await deleteDoc(noteRef);

    setShowDiscardDialog(false);
    onOpenChange(false);
    // Reset state
    setTimeout(() => {
      setTitle("");
      setContent("");
      setSelectedTags([]);
      setFolderId(currentFolderId);
      setHasChanges(false);
    }, 300);
  }, [noteId, onOpenChange, user?.id, currentFolderId]);

  // Handle expand to fullscreen
  const handleExpand = useCallback(() => {
    // Save current state before navigating only if there's real content
    if (hasChanges && hasRealContent()) {
      saveNote();
    }

    // Navigate to fullscreen editor with the note ID
    router.push(`/dashboard/notas/editar/${noteId}`);
    onOpenChange(false);
  }, [hasChanges, hasRealContent, saveNote, router, noteId, onOpenChange]);

  return (
    <IntegratedEditorProvider noteId={noteId}>
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="h-[85vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-left">
              {existingNote ? "Editar Nota" : "Nova Nota"}
            </DrawerTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpand}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Title Input */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Input
              placeholder="Título da nota..."
              value={title}
              onChange={handleTitleChange}
              className="text-md font-medium border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            <div className="flex flex-row items-center gap-2 w-full">
              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={handleTagsChange}
                placeholder="Adicionar tags..."
                mode="id"
                className="w-full"
              />

              <Select
                value={folderId || "root"}
                onValueChange={handleFolderChange}
              >
                <SelectTrigger id="folder-select">
                  <div className="flex items-center gap-2 w-full">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <SelectValue>{getFolderPath(folderId)}</SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      Raiz
                    </div>
                  </SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <Folder
                          className="h-4 w-4"
                          style={{ color: folder.color }}
                        />
                        {getFolderPath(folder.id)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full">
              <NoteEditorWithToolbar
                placeholder="Comece a escrever sua nota..."
                onChange={handleContentChange}
                initialValue={content}
                className="h-full"
                showToolbar={true}
              />
            </div>
          </div>
        </div>

        {/* Auto-save indicator */}
        {hasChanges && (
          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
            Salvando...
          </div>
        )}
      </DrawerContent>
        {/* Discard Confirmation Dialog */}
        <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar nota?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A nota será permanentemente
                excluída.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDiscard}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Drawer>
    </IntegratedEditorProvider>
  );
}

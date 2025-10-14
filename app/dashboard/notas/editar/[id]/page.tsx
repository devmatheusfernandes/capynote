"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NoteEditorWithToolbar from "@/components/editor/note-editor-with-toolbar";
import { TagSelector } from "@/components/tag-selector";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  onSnapshot as onTagsSnapshot,
} from "firebase/firestore";
import { NoteData, TagData } from "@/types";

export default function EditNotePage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);

  // Load note from Firestore (real-time)
  useEffect(() => {
    if (!user?.id || !noteId) return;
    const noteRef = doc(db, "users", user.id, "notes", noteId);
    const unsub = onSnapshot(noteRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as NoteData;
        setTitle(data.title || "");
        setContent(data.content || "");
        setTags(data.tagIds || data.tags || []);
        setCreatedAt(data.createdAt);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [user?.id, noteId]);

  // Assinar tags do usuário para resolver nomes e criar novas quando necessário
  useEffect(() => {
    if (!user?.id) return;
    const tagsRef = collection(db, "users", user.id, "tags");
    const unsub = onTagsSnapshot(tagsRef, (snapshot) => {
      const fetchedTags: TagData[] = snapshot.docs.map((d) => {
        const data = d.data() as TagData;
        return {
          id: d.id,
          name: data.name || d.id,
          createdAt: data.createdAt
            ? String(data.createdAt)
            : new Date().toISOString(),
          updatedAt: data.updatedAt
            ? String(data.updatedAt)
            : new Date().toISOString(),
          color: data.color,
        };
      });
      setAvailableTags(fetchedTags);
    });
    return () => unsub();
  }, [user?.id]);

  // Handle scroll for sticky header on mobile
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const isMobile = window.innerWidth < 768; // md breakpoint

      if (isMobile) {
        setShowStickyHeader(scrollY > 100); // Show after scrolling 100px
      } else {
        setShowStickyHeader(false);
      }
    };

    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        setShowStickyHeader(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Auto-save functionality
  const saveNote = useCallback(async () => {
    if (!title.trim() && !content.trim()) return;
    if (!user?.id) return;

    // Resolver para IDs de tag; criar novas tags por nome quando necessário
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

    const resolvedTagIds: string[] = await Promise.all(tags.map(toId));
    const resolvedTagNames: string[] = resolvedTagIds.map(
      (id) => availableTags.find((t) => t.id === id)?.name || id
    );

    const baseData = {
      id: noteId,
      title: title.trim() || "Nota sem título",
      content,
      tagIds: resolvedTagIds,
      tags: resolvedTagNames,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore, merging to preserve other fields (e.g., folderId)
    const noteRef = doc(db, "users", user.id, "notes", noteId);
    await setDoc(noteRef, baseData, { merge: true });
    setHasChanges(false);
  }, [title, content, tags, noteId, user?.id, createdAt, availableTags]);

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
    // serializedState is already a JSON string from Lexical
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
    setTags(newTags);
    setHasChanges(true);
  }, []);

  // Handle manual save
  const handleSave = useCallback(() => {
    saveNote();
  }, [saveNote]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!user?.id) return;
    if (confirm("Tem certeza que deseja excluir esta nota?")) {
      const noteRef = doc(db, "users", user.id, "notes", noteId);
      await deleteDoc(noteRef);
      router.push("/dashboard/notas");
    }
  }, [noteId, router, user?.id]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (hasChanges) {
      saveNote();
    }
    router.back();
  }, [hasChanges, saveNote, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen md:h-screen md:flex md:flex-col">
        {/* Header Principal */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>

              {/* Título editável centralizado */}
              <div className="flex-1 mx-8 hidden md:block">
                <Input
                  placeholder="Título da nota..."
                  value={title}
                  onChange={handleTitleChange}
                  className="text-lg font-medium text-center border-0 px-4 py-2 focus-visible:ring-1 focus-visible:ring-primary bg-transparent hover:bg-muted/50 transition-colors"
                />
              </div>

              {/* Título mobile - visível apenas no mobile */}
              <div className="flex-1 mx-4 md:hidden">
                <Input
                  placeholder="Título da nota..."
                  value={title}
                  onChange={handleTitleChange}
                  className="text-base font-medium text-center border-0 px-2 py-1 focus-visible:ring-1 focus-visible:ring-primary bg-transparent hover:bg-muted/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">Salvar</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 md:flex md:flex-col md:overflow-hidden p-6">
          {/* Tags */}
          <div className="mb-4">
            <TagSelector
              selectedTags={tags}
              onTagsChange={handleTagsChange}
              placeholder="Adicionar tags..."
              mode="id"
            />
          </div>

          {/* Editor */}
          <div className="min-h-screen md:min-h-0 md:flex-1 pb-20">
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

      {/* Header Sticky para Mobile */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
          showStickyHeader ? "translate-y-0" : "-translate-y-full"
        } border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            {/* Título editável centralizado no sticky header */}
            <div className="flex-1 mx-3">
              <Input
                placeholder="Título da nota..."
                value={title}
                onChange={handleTitleChange}
                className="text-sm font-medium text-center border-0 px-2 py-1 focus-visible:ring-1 focus-visible:ring-primary bg-transparent hover:bg-muted/50 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="p-2"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="p-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

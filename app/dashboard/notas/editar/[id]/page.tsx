"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Save, Trash2, MoreVertical, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
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
import CapybaraLoader from "@/components/capybaraLoader";

type EditorOptionsSheetProps = {
  onSave: () => void;
  onDelete: () => void;
  onReadMode: () => void;
};

function EditorOptionsSheet({
  onSave,
  onDelete,
  onReadMode,
}: EditorOptionsSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Abrir opções"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Opções da nota</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-2">
          <SheetClose asChild>
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={onReadMode}
            >
              <BookOpen className="h-4 w-4" />
              Modo leitura
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onSave}
            >
              <Save className="h-4 w-4" />
              Salvar arquivo
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant="destructive"
              className="w-full justify-start gap-2"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Apagar arquivo
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [openReadMode, setOpenReadMode] = useState(false);

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

  // Removido: sticky header de mobile para maximizar espaço da tela do editor

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

  // Sem botão de voltar nesta tela para otimizar espaço

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <CapybaraLoader />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen md:h-screen md:flex md:flex-col">
        {/* Header próprio do editor: título + botão para abrir sheet */}
        <div
          className={`flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${
            !openReadMode ? "sticky top-0 z-10" : ""
          }`}
        >
          <div className="px-4 md:px-6 py-2">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Título da nota..."
                value={title}
                onChange={handleTitleChange}
                className="text-base md:text-lg font-medium border-0 px-2 md:px-3 py-1.5 focus-visible:ring-1 focus-visible:ring-primary bg-transparent hover:bg-muted/50 transition-colors"
              />
              {openReadMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setOpenReadMode(false)}
                >
                  Sair do modo leitura
                </Button>
              ) : (
                <EditorOptionsSheet
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onReadMode={() => setOpenReadMode(true)}
                />
              )}
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
              showToolbar={!openReadMode}
              openReadMode={openReadMode}
              onOpenReadMode={() => setOpenReadMode(true)}
              onCloseReadMode={() => setOpenReadMode(false)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

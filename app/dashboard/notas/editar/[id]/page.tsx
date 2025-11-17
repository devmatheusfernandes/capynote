"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Save,
  Trash2,
  MoreVertical,
  BookOpen,
  ArrowLeft,
  SaveOff,
  SaveIcon,
} from "lucide-react";
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
import IntegratedNoteEditor from "@/components/editor/integrated-note-editor";
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
import { Badge } from "@/components/ui/badge";
import IntegratedEditorProvider from "@/components/editor/integrated-editor-provider";
import IntegratedSidebar from "@/components/editor/integrated-sidebar";
import IntegratedToolbar from "@/components/editor/integrated-toolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";

function HeaderOffset({ children, showHeader, rightPadding }: { children: React.ReactNode; showHeader: boolean; rightPadding: number; }) {
  return (
    <motion.div
      className={`flex-shrink-0 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 fixed top-0 left-0 right-0 z-10`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: showHeader ? 0 : -100, opacity: showHeader ? 1 : 0, paddingRight: rightPadding }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

type EditorOptionsSheetProps = {
  onSave: () => void;
  onDelete: () => void;
  onReadMode: () => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
};

function EditorOptionsSheet({
  onSave,
  onDelete,
  onReadMode,
  selectedTags,
  onTagsChange,
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
          <SheetTitle>Opções</SheetTitle>
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
        <div className="p-4 border-t">
          <div className="text-sm font-medium mb-2">Tags</div>
          <TagSelector
            selectedTags={selectedTags}
            onTagsChange={onTagsChange}
            placeholder="Adicionar tags..."
            mode="id"
          />
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
  const isMobile = useIsMobile();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [openReadMode, setOpenReadMode] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [pendingWrites, setPendingWrites] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

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
      // Update sync status indicator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta: any = (snapshot as any).metadata;
      setPendingWrites(Boolean(meta?.hasPendingWrites));
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

  // Controle de scroll para modo leitura e edição
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY) {
        // Scrolling up
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down and past threshold
        setShowHeader(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Abrir sidebar automaticamente por eventos do editor
  useEffect(() => {
    const open = () => setSidebarOpen(true);
    window.addEventListener("editor-open-sidebar", open);
    window.addEventListener("editor-open-comment-dialog", open);
    return () => {
      window.removeEventListener("editor-open-sidebar", open);
      window.removeEventListener("editor-open-comment-dialog", open);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <CapybaraLoader />
      </div>
    );
  }

  const reservedRight = !isMobile ? (sidebarOpen ? 352 : 0) : 0;

  return (
    <IntegratedEditorProvider noteId={noteId}>
      <IntegratedSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <motion.div className="min-h-screen md:h-screen md:flex md:flex-col" animate={{ paddingRight: reservedRight }} transition={{ duration: 0.2 }}>
        {/* Header próprio do editor: título + botão para abrir sheet */}
        <HeaderOffset showHeader={showHeader} rightPadding={reservedRight}>
          <IntegratedToolbar
            title={title}
            onTitleChange={handleTitleChange}
            pendingWrites={pendingWrites}
            tags={tags}
            onTagsChange={handleTagsChange}
            onSave={handleSave}
            onDelete={handleDelete}
            openReadMode={openReadMode}
            setOpenReadMode={setOpenReadMode}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
        </HeaderOffset>

        {/* Content */}
        <div className="flex-1 md:flex md:flex-col md:overflow-hidden pt-12">
          {/* Editor */}
          <div className="min-h-screen md:min-h-0 md:flex-1 pb-16">
            <IntegratedNoteEditor
              placeholder="Comece a escrever sua nota..."
              onChange={handleContentChange}
              initialValue={content}
              className="h-full"
              showToolbar={!openReadMode}
              openReadMode={openReadMode}
              onOpenReadMode={() => setOpenReadMode(true)}
              onCloseReadMode={() => setOpenReadMode(false)}
              reservedRight={reservedRight}
            />
          </div>
        </div>
      </motion.div>
    </IntegratedEditorProvider>
  );
}

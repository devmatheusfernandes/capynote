"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Calendar,
  Trash2,
  FileText,
  FolderPlus,
  FilePlus2,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ExportImportSheet } from "@/components/ui/sheet";
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
import { NoteDrawer } from "@/components/note-drawer";
import SyncDot from "@/components/sync-dot";
import { PageHeader } from "@/components/page-header";
import { TagSelector } from "@/components/tag-selector";
import { FolderCard } from "@/components/folder-card";
import { FolderBreadcrumbs } from "@/components/folder-breadcrumbs";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { NoteData, FolderData, BreadcrumbItem, TagData } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
} from "firebase/firestore";
import {
  downloadFile,
  exportNotesAsMarkdown,
  buildBackupPayload,
  BackupPayload,
} from "@/lib/export-utils";
import {
  parseJSONFile,
  markdownToLexical,
  deriveTitleFromMarkdown,
  mergeNotes,
  mergeFolders,
  mergeTags,
} from "@/lib/import-utils";
import { useIsMobile } from "@/hooks/use-mobile";

export default function NotasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [notePendingById, setNotePendingById] = useState<
    Record<string, boolean>
  >({});
  const [folderPendingById, setFolderPendingById] = useState<
    Record<string, boolean>
  >({});
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    undefined
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NoteData[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<FolderData[]>([]);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  // Selection and drag state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set()
  );
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  // View filters
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Subscribe to Firestore notes and folders for the authenticated user
  useEffect(() => {
    if (!user?.id) return;

    const notesRef = collection(db, "users", user.id, "notes");
    const foldersRef = collection(db, "users", user.id, "folders");

    const unsubNotes = onSnapshot(notesRef, (snapshot) => {
      const fetchedNotes: NoteData[] = snapshot.docs.map(
        (d) => d.data() as NoteData
      );
      // Track pending writes per note (offline-only until acknowledged by server)
      const pendingMap: Record<string, boolean> = {};
      snapshot.docs.forEach((d) => {
        // QueryDocumentSnapshot has metadata.hasPendingWrites
        // If true, it means local changes not yet committed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: any = (d as any).metadata;
        pendingMap[d.id] = Boolean(meta?.hasPendingWrites);
      });
      setNotePendingById(pendingMap);
      const sortedNotes = fetchedNotes.sort(
        (a: NoteData, b: NoteData) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setNotes(sortedNotes);
    });

    const unsubFolders = onSnapshot(foldersRef, (snapshot) => {
      const fetchedFolders: FolderData[] = snapshot.docs.map(
        (d) => d.data() as FolderData
      );
      const pendingMap: Record<string, boolean> = {};
      snapshot.docs.forEach((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: any = (d as any).metadata;
        pendingMap[d.id] = Boolean(meta?.hasPendingWrites);
      });
      setFolderPendingById(pendingMap);
      setFolders(fetchedFolders);
      // Create permanent Archive folder if missing
      if (!fetchedFolders.some((f) => f.id === "archive") && user?.id) {
        const now = new Date().toISOString();
        const archiveRef = doc(
          collection(db, "users", user.id, "folders"),
          "archive"
        );
        const archiveFolder: FolderData = {
          id: "archive",
          name: "Arquivadas",
          createdAt: now,
          updatedAt: now,
        };
        setDoc(archiveRef, archiveFolder).catch(() => {});
      }
    });

    return () => {
      unsubNotes();
      unsubFolders();
    };
  }, [user?.id]);

  // Subscribe to user's tags for name resolution and filtering
  useEffect(() => {
    if (!user?.id) return;
    const tagsRef = collection(db, "users", user.id, "tags");
    const unsubTags = onSnapshot(tagsRef, (snapshot) => {
      const tags: TagData[] = snapshot.docs.map((d) => {
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
      setAvailableTags(tags);
    });
    return () => unsubTags();
  }, [user?.id]);

  const getTagNameById = useCallback(
    (id: string) => {
      return availableTags.find((t) => t.id === id)?.name || id;
    },
    [availableTags]
  );

  // Compute folder path using loaded folders
  const getFolderPath = useCallback(
    (folderId: string): FolderData[] => {
      const path: FolderData[] = [];
      let currentFolder = folders.find((f) => f.id === folderId);
      while (currentFolder) {
        path.unshift(currentFolder);
        currentFolder = currentFolder.parentId
          ? folders.find((f) => f.id === currentFolder!.parentId)
          : undefined;
      }
      return path;
    },
    [folders]
  );

  // Update breadcrumbs when current folder changes
  useEffect(() => {
    if (currentFolderId) {
      const path = getFolderPath(currentFolderId);
      setBreadcrumbs(
        path.map((folder) => ({ id: folder.id, name: folder.name }))
      );
    } else {
      setBreadcrumbs([]);
    }
  }, [currentFolderId, folders, getFolderPath]);

  const tagsById = useMemo(
    () => Object.fromEntries(availableTags.map((t) => [t.id, t.name])),
    [availableTags]
  );

  // Filter notes and folders based on current folder, search term and selected tags
  useEffect(() => {
    // Filter notes by current folder
    let filteredNotesByFolder = notes.filter(
      (note) => note.folderId === currentFolderId
    );

    // Filter folders by current folder (show subfolders)
    let filteredFoldersByParent = folders.filter(
      (folder) => folder.parentId === currentFolderId
    );

    // Hide the permanent Archive folder from the folders grid
    filteredFoldersByParent = filteredFoldersByParent.filter(
      (folder) => folder.id !== "archive"
    );

    // If there's a search term, search recursively in all folders
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();

      // Function to get all notes in a folder and its subfolders recursively
      const getAllNotesInFolderTree = (folderId?: string): NoteData[] => {
        const notesInFolder = notes.filter(
          (note) => note.folderId === folderId
        );
        const subfolders = folders.filter(
          (folder) => folder.parentId === folderId
        );

        let allNotes = [...notesInFolder];
        subfolders.forEach((subfolder) => {
          allNotes = allNotes.concat(getAllNotesInFolderTree(subfolder.id));
        });

        return allNotes;
      };

      // Search in all notes from current folder tree
      const allNotesInTree = getAllNotesInFolderTree(currentFolderId);
      filteredNotesByFolder = allNotesInTree.filter((note) => {
        const tagNames =
          note.tagIds && note.tagIds.length > 0
            ? note.tagIds.map(getTagNameById)
            : note.tags || [];
        const matchesTags = tagNames.some((tag) =>
          tag.toLowerCase().includes(searchLower)
        );
        return (
          note.title.toLowerCase().includes(searchLower) ||
          note.content.toLowerCase().includes(searchLower) ||
          matchesTags
        );
      });

      // Also search in folder names
      filteredFoldersByParent = filteredFoldersByParent.filter((folder) =>
        folder.name.toLowerCase().includes(searchLower)
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filteredNotesByFolder = filteredNotesByFolder.filter((note) => {
        return selectedTags.every((id) => {
          const name = getTagNameById(id);
          const inIds = Array.isArray(note.tagIds) && note.tagIds.includes(id);
          const inNames = Array.isArray(note.tags) && note.tags.includes(name);
          return inIds || inNames;
        });
      });
    }

    if (showPinnedOnly) {
      filteredNotesByFolder = filteredNotesByFolder.filter((n) => n.pinned);
    }

    // Sort: pinned on top, then by updatedAt desc
    filteredNotesByFolder = filteredNotesByFolder.slice().sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    setFilteredNotes(filteredNotesByFolder);
    setFilteredFolders(filteredFoldersByParent);
  }, [
    notes,
    folders,
    currentFolderId,
    searchTerm,
    selectedTags,
    showPinnedOnly,
    getTagNameById,
  ]);

  // // Export handlers (filtered scope = por pasta ou por tag)
  // const handleExportJSONFiltered = useCallback(() => {
  //   const json = exportNotesAsJSON(filteredNotes);
  //   const filename = currentFolderId
  //     ? `notas_${currentFolderId}.json`
  //     : "notas_root.json";
  //   downloadFile(filename, json, "application/json");
  // }, [filteredNotes, currentFolderId]);

  const handleExportMarkdownFiltered = useCallback(() => {
    const md = exportNotesAsMarkdown(filteredNotes, folders, tagsById);
    const filename = currentFolderId
      ? `notas_${currentFolderId}.md`
      : "notas_root.md";
    downloadFile(filename, md, "text/markdown");
  }, [filteredNotes, folders, tagsById, currentFolderId]);

  const handleExportMarkdownSelected = useCallback(() => {
    const selected = notes.filter((n) => selectedNoteIds.has(n.id));
    if (selected.length === 0) return;
    const md = exportNotesAsMarkdown(selected, folders, tagsById);
    const filename =
      selected.length === 1
        ? `${selected[0].title || selected[0].id}.md`
        : "notas_selecionadas.md";
    downloadFile(filename, md, "text/markdown");
  }, [notes, selectedNoteIds, folders, tagsById]);

  const handleBackupAll = useCallback(() => {
    const payload = buildBackupPayload(notes, folders, availableTags);
    const json = JSON.stringify(payload, null, 2);
    const filename = `capynotes_backup_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    downloadFile(filename, json, "application/json");
    try {
      const history = JSON.parse(localStorage.getItem("backupHistory") || "[]");
      history.push({
        filename,
        at: new Date().toISOString(),
        notes: notes.length,
        folders: folders.length,
        tags: availableTags.length,
      });
      localStorage.setItem("backupHistory", JSON.stringify(history));
    } catch {}
  }, [notes, folders, availableTags]);

  // View toggles (Sheet buttons)
  const showPinnedView = useCallback(() => {
    setShowPinnedOnly(true);
  }, []);

  const openArchiveFolder = useCallback(() => {
    setCurrentFolderId("archive");
  }, []);

  const showAllView = useCallback(() => {
    setShowPinnedOnly(false);
  }, []);

  // Import para pasta atual/raiz (JSON ou Markdown)
  const triggerImportFile = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const onImportFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !user?.id) return;

      try {
        // Processar múltiplos arquivos
        const fileArray = Array.from(files);
        
        // Separar arquivos Markdown e JSON
        const markdownFiles = fileArray.filter(file => 
          file.name.toLowerCase().endsWith(".md") || file.type === "text/markdown"
        );
        const jsonFiles = fileArray.filter(file => 
          file.name.toLowerCase().endsWith(".json") || file.type === "application/json"
        );

        // Processar arquivos Markdown (múltiplos)
        if (markdownFiles.length > 0) {
          await Promise.all(
            markdownFiles.map(async (file) => {
              const text = await file.text();
              const content = markdownToLexical(text);
              const title = deriveTitleFromMarkdown(
                text,
                file.name.replace(/\.md$/, "")
              );
              const noteRef = doc(collection(db, "users", user.id, "notes"));
              const note: NoteData = {
                id: noteRef.id,
                title: title || "Nota importada",
                content,
                folderId: currentFolderId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                tags: [],
                tagIds: [],
              };
              const payload = Object.fromEntries(
                Object.entries(note).filter(([, v]) => v !== undefined)
              );
              await setDoc(noteRef, payload);
            })
          );
        }

        // Processar arquivos JSON (um por vez, como antes)
        for (const file of jsonFiles) {
          const text = await file.text();
          const parsed = parseJSONFile(text);
          
          if (Array.isArray(parsed)) {
            await Promise.all(
              parsed.map(async (n) => {
                const noteRef = doc(collection(db, "users", user.id, "notes"));
                const note: NoteData = {
                  id: noteRef.id,
                  title: n.title || "Nota importada",
                  content: n.content || "",
                  folderId: currentFolderId,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  tags: n.tags || [],
                  tagIds: n.tagIds || [],
                };
                const payload = Object.fromEntries(
                  Object.entries(note).filter(([, v]) => v !== undefined)
                );
                await setDoc(noteRef, payload);
              })
            );
          } else if (
            (parsed as BackupPayload)?.notes ||
            (parsed as BackupPayload)?.folders ||
            (parsed as BackupPayload)?.tags
          ) {
            // Se for payload de backup, sugerimos usar a ação de Restore
            alert(
              "Este arquivo parece um backup. Use 'Restaurar backup' para mesclar os dados."
            );
          } else {
            const n = parsed as NoteData;
            const noteRef = doc(collection(db, "users", user.id, "notes"));
            const note: NoteData = {
              id: noteRef.id,
              title: n.title || "Nota importada",
              content: n.content || "",
              folderId: currentFolderId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: n.tags || [],
              tagIds: n.tagIds || [],
            };
            const payload = Object.fromEntries(
              Object.entries(note).filter(([, v]) => v !== undefined)
            );
            await setDoc(noteRef, payload);
          }
        }

        // Mostrar mensagem de sucesso
        const totalFiles = markdownFiles.length + jsonFiles.length;
        if (totalFiles > 1) {
          alert(`${totalFiles} arquivos importados com sucesso!`);
        }
      } catch (error) {
        console.error("Erro ao importar arquivos:", error);
        alert("Erro ao importar arquivos. Verifique o formato dos arquivos.");
      }

      // limpa input
      e.target.value = "";
    },
    [user?.id, currentFolderId]
  );

  // Restore com merge a partir de backup JSON
  const triggerRestoreFile = useCallback(() => {
    restoreFileInputRef.current?.click();
  }, []);

  const onRestoreFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.id) return;
      const text = await file.text();
      try {
        const parsed = parseJSONFile(text) as BackupPayload;
        const incomingNotes: NoteData[] = parsed.notes || [];
        const incomingFolders: FolderData[] = parsed.folders || [];
        const incomingTags: TagData[] = parsed.tags || [];

        const mergedNotes = mergeNotes(notes, incomingNotes);
        const mergedFolders = mergeFolders(folders, incomingFolders);
        const mergedTags = mergeTags(availableTags, incomingTags);

        await Promise.all(
          mergedFolders.map((f) => {
            const payload = Object.fromEntries(
              Object.entries(f).filter(([, v]) => v !== undefined)
            );
            return setDoc(doc(db, "users", user.id, "folders", f.id), payload, {
              merge: true,
            });
          })
        );
        await Promise.all(
          mergedTags.map((t) => {
            const payload = Object.fromEntries(
              Object.entries(t).filter(([, v]) => v !== undefined)
            );
            return setDoc(doc(db, "users", user.id, "tags", t.id), payload, {
              merge: true,
            });
          })
        );
        await Promise.all(
          mergedNotes.map((n) => {
            const payload = Object.fromEntries(
              Object.entries(n).filter(([, v]) => v !== undefined)
            );
            return setDoc(doc(db, "users", user.id, "notes", n.id), payload, {
              merge: true,
            });
          })
        );
      } catch (err) {
        console.error(err);
        alert("Falha ao restaurar backup. Verifique o arquivo.");
      }
      e.target.value = "";
    },
    [user?.id, notes, folders, availableTags]
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString("pt-BR", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  };

  // Get preview text from content
  const getPreviewText = (content: string) => {
    try {
      // If content is JSON (from Lexical editor), try to extract text
      type LexicalNode = { text?: string; children?: LexicalNode[] };
      type LexicalContent = { root?: { children?: LexicalNode[] } };
      const parsed = JSON.parse(content) as LexicalContent;
      if (parsed.root && parsed.root.children) {
        let text = "";
        const extractText = (node: LexicalNode) => {
          if (node.text) {
            text += node.text + " ";
          }
          if (node.children) {
            node.children.forEach(extractText);
          }
        };
        parsed.root.children.forEach(extractText);
        return text.trim().substring(0, 150) + (text.length > 150 ? "..." : "");
      }
    } catch {
      // If not JSON, treat as plain text
      return content.substring(0, 150) + (content.length > 150 ? "..." : "");
    }
    return "Nota vazia";
  };

  // Handle note deletion
  const handleDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteNote = () => {
    if (noteToDelete && user?.id) {
      const noteRef = doc(db, "users", user.id, "notes", noteToDelete);
      deleteDoc(noteRef);
    }
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
  };

  // Handle note editing
  const handleEditNote = (noteId: string) => {
    router.push(`/dashboard/notas/editar/${noteId}`);
  };

  // Selection helpers
  const toggleSelectNote = useCallback((noteId: string, checked?: boolean) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      const isSelected = next.has(noteId);
      const willSelect = typeof checked === "boolean" ? checked : !isSelected;
      if (willSelect) next.add(noteId);
      else next.delete(noteId);
      setSelectionMode(next.size > 0);
      return next;
    });
  }, []);

  const selectAllNotes = useCallback(() => {
    const allIds = filteredNotes.map((n) => n.id);
    setSelectedNoteIds(new Set(allIds));
    setSelectionMode(allIds.length > 0);
  }, [filteredNotes]);

  const clearSelection = useCallback(() => {
    setSelectedNoteIds(new Set());
    setSelectionMode(false);
  }, []);

  const deleteSelectedNotes = useCallback(async () => {
    if (!user?.id || selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    await Promise.all(
      ids.map((id) => deleteDoc(doc(db, "users", user.id, "notes", id)))
    );
    clearSelection();
  }, [user?.id, selectedNoteIds, clearSelection]);

  const moveSelectedNotes = useCallback(
    async (destFolderId?: string) => {
      if (!user?.id || selectedNoteIds.size === 0) return;
      const ids = Array.from(selectedNoteIds);
      await Promise.all(
        ids.map((id) =>
          updateDoc(doc(db, "users", user.id, "notes", id), {
            folderId: destFolderId ?? deleteField(),
            updatedAt: new Date().toISOString(),
          })
        )
      );
      clearSelection();
    },
    [user?.id, selectedNoteIds, clearSelection]
  );

  const archiveSelectedNotes = useCallback(async () => {
    if (!user?.id || selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    await Promise.all(
      ids.map((id) =>
        updateDoc(doc(db, "users", user.id, "notes", id), {
          folderId: "archive",
          updatedAt: new Date().toISOString(),
        })
      )
    );
    clearSelection();
  }, [user?.id, selectedNoteIds, clearSelection]);

  const unarchiveSelectedNotes = useCallback(async () => {
    if (!user?.id || selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    await Promise.all(
      ids.map((id) =>
        updateDoc(doc(db, "users", user.id, "notes", id), {
          folderId: deleteField(),
          updatedAt: new Date().toISOString(),
        })
      )
    );
    clearSelection();
  }, [user?.id, selectedNoteIds, clearSelection]);

  const pinSelectedNotes = useCallback(async () => {
    if (!user?.id || selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    await Promise.all(
      ids.map((id) =>
        updateDoc(doc(db, "users", user.id, "notes", id), {
          pinned: true,
          updatedAt: new Date().toISOString(),
        })
      )
    );
    clearSelection();
  }, [user?.id, selectedNoteIds, clearSelection]);

  // Drag helpers
  const handleNoteDragStart = useCallback(
    (noteId: string, e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", noteId);
      setDraggingNoteId(noteId);
    },
    []
  );

  const handleNoteDragEnd = useCallback(() => {
    setDraggingNoteId(null);
  }, []);

  const handleDropNoteToFolder = useCallback(
    async (folderId: string, noteId: string) => {
      if (!user?.id) return;
      await updateDoc(doc(db, "users", user.id, "notes", noteId), {
        folderId,
        updatedAt: new Date().toISOString(),
      });
    },
    [user?.id]
  );

  // Folder management functions
  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!user?.id) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const folderRef = doc(collection(db, "users", user.id, "folders"));
      const folder: FolderData = {
        id: folderRef.id,
        name: trimmed,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(currentFolderId ? { parentId: currentFolderId } : {}),
      };
      await setDoc(folderRef, folder);
    },
    [currentFolderId, user?.id]
  );

  const handleOpenFolder = useCallback((folderId: string) => {
    setCurrentFolderId(folderId);
  }, []);

  const handleNavigateToFolder = useCallback((folderId?: string) => {
    setCurrentFolderId(folderId);
  }, []);

  const handleRenameFolder = useCallback(
    async (folderId: string, newName: string) => {
      if (!user?.id) return;
      const folderRef = doc(db, "users", user.id, "folders", folderId);
      await updateDoc(folderRef, {
        name: newName,
        updatedAt: new Date().toISOString(),
      });
    },
    [user?.id]
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!user?.id) return;
      // Prevent deleting the permanent Archive folder
      if (folderId === "archive") return;
      // Find all subfolders recursively
      const findAllSubfolders = (parentId: string): string[] => {
        const subfolders = folders.filter((f) => f.parentId === parentId);
        let allIds = [parentId];
        subfolders.forEach((subfolder) => {
          allIds = allIds.concat(findAllSubfolders(subfolder.id));
        });
        return allIds;
      };

      const foldersToDelete = findAllSubfolders(folderId);
      // Delete folders
      await Promise.all(
        foldersToDelete.map((id) =>
          deleteDoc(doc(db, "users", user.id, "folders", id))
        )
      );

      // Move notes from deleted folders to root
      const notesToMove = notes.filter((n) =>
        foldersToDelete.includes(n.folderId || "")
      );
      await Promise.all(
        notesToMove.map((n) =>
          updateDoc(doc(db, "users", user.id, "notes", n.id), {
            folderId: deleteField(),
            updatedAt: new Date().toISOString(),
          })
        )
      );

      // If we're currently in the deleted folder, go back to parent
      if (currentFolderId === folderId) {
        const folder = folders.find((f) => f.id === folderId);
        setCurrentFolderId(folder?.parentId);
      }
    },
    [currentFolderId, folders, notes, user?.id]
  );

  // Count notes in a folder
  const getNotesCountInFolder = useCallback(
    (folderId: string) => {
      return notes.filter((note) => note.folderId === folderId).length;
    },
    [notes]
  );

  return (
    <div className="container sm:p-6 p-4 sm:max-w-[80vw] max-w-[100vw]">
      {/* Header */}
      <PageHeader
        title="Notas"
        otherButton={
          selectionMode ? (
            isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">Ações</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={selectAllNotes}>
                    Selecionar todas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={deleteSelectedNotes}
                  >
                    Excluir
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Mover</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onClick={() => moveSelectedNotes(undefined)}
                      >
                        Raiz
                      </DropdownMenuItem>
                      {folders
                        .filter((f) => f.id !== "archive")
                        .map((f) => (
                          <DropdownMenuItem
                            key={f.id}
                            onClick={() => moveSelectedNotes(f.id)}
                          >
                            {f.name}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onClick={handleExportMarkdownSelected}>
                    <FileText className="h-4 w-4" />
                    Exportar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={archiveSelectedNotes}>
                    Arquivar
                  </DropdownMenuItem>
                  {Array.from(selectedNoteIds).some((id) => {
                    const n = notes.find((note) => note.id === id);
                    return n?.folderId === "archive";
                  }) && (
                    <DropdownMenuItem onClick={unarchiveSelectedNotes}>
                      Desarquivar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={pinSelectedNotes}>
                    Fixar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={clearSelection}>
                    Cancelar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex flex-row items-center gap-2">
                <Button variant="outline" onClick={selectAllNotes}>
                  Selecionar todas
                </Button>
                <Button variant="destructive" onClick={deleteSelectedNotes}>
                  Excluir
                </Button>
                {/* Move menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">Mover</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => moveSelectedNotes(undefined)}
                    >
                      Raiz
                    </DropdownMenuItem>
                    {folders
                      .filter((f) => f.id !== "archive")
                      .map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          onClick={() => moveSelectedNotes(f.id)}
                        >
                          {f.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  onClick={handleExportMarkdownSelected}
                >
                  <FileText className="h-4 w-4" />
                  Exportar
                </Button>
                <Button variant="outline" onClick={archiveSelectedNotes}>
                  Arquivar
                </Button>
                {Array.from(selectedNoteIds).some((id) => {
                  const n = notes.find((note) => note.id === id);
                  return n?.folderId === "archive";
                }) && (
                  <Button variant="outline" onClick={unarchiveSelectedNotes}>
                    Desarquivar
                  </Button>
                )}
                <Button variant="outline" onClick={pinSelectedNotes}>
                  Fixar
                </Button>
                <Button variant="ghost" onClick={clearSelection}>
                  Cancelar
                </Button>
              </div>
            )
          ) : (
            <div className="flex flex-row items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateFolderOpen(true)}
              >
                <FolderPlus className="h-4 w-4" />
                Pasta
              </Button>
              <Button variant="default" onClick={() => setNoteDrawerOpen(true)}>
                <FilePlus2 className="h-4 w-4" />
                Nota
              </Button>
              <ExportImportSheet
                onExportMarkdown={handleExportMarkdownFiltered}
                onBackupAll={handleBackupAll}
                onImportNotes={triggerImportFile}
                onRestoreBackup={triggerRestoreFile}
                onShowPinnedNotes={showPinnedView}
                onShowArchivedNotes={openArchiveFolder}
                onShowAllNotes={showAllView}
                activePinned={showPinnedOnly}
                activeArchived={currentFolderId === "archive"}
                activeAll={!showPinnedOnly && currentFolderId !== "archive"}
              />
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,.md"
                multiple
                className="hidden"
                onChange={onImportFileChange}
              />
              <input
                ref={restoreFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={onRestoreFileChange}
              />
            </div>
          )
        }
      />

      {/* Breadcrumbs */}
      <div className="mb-4">
        <FolderBreadcrumbs
          path={breadcrumbs}
          onNavigate={handleNavigateToFolder}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-row items-center sm:min-w-max min-w-min gap-2 mb-6">
        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas e pastas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tag Filter and Create Folder Button */}
        <TagSelector
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          placeholder="Filtrar por tags..."
          mode="id"
        />
      </div>

      {/* Folders and Notes Grid */}
      {filteredFolders.length === 0 && filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchTerm
              ? "Nenhum item encontrado"
              : "Nenhuma pasta ou nota ainda"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? "Tente buscar por outros termos"
              : "Comece criando sua primeira pasta ou nota"}
          </p>
          {!searchTerm && (
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => setCreateFolderOpen(true)}
                variant="outline"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Criar pasta
              </Button>
              <Button onClick={() => setNoteDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar nota
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Folders */}
          {filteredFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              noteCount={getNotesCountInFolder(folder.id)}
              onOpen={handleOpenFolder}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
              syncPending={folderPendingById[folder.id]}
              onDropNote={handleDropNoteToFolder}
            />
          ))}

          {/* Notes */}
          {filteredNotes.map((note) => {
            const isSelected = selectedNoteIds.has(note.id);
            return (
              <Card
                key={note.id}
                className={`relative cursor-pointer hover:shadow-md transition-shadow group ${
                  isSelected ? "ring-2 ring-primary/50" : ""
                } ${draggingNoteId === note.id ? "opacity-70" : ""}`}
                draggable
                onDragStart={(e) => handleNoteDragStart(note.id, e)}
                onDragEnd={handleNoteDragEnd}
                onClick={() =>
                  selectionMode
                    ? toggleSelectNote(note.id)
                    : handleEditNote(note.id)
                }
              >
                {/* Hover selection checkbox */}
                <div
                  className={`absolute top-2 left-2 z-10 ${
                    isSelected
                      ? ""
                      : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked: boolean) => {
                      toggleSelectNote(note.id, Boolean(checked));
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />
                </div>
                <CardHeader className="">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <SyncDot pending={notePendingById[note.id]} />
                      {note.pinned && (
                        <Pin
                          className="h-4 w-4 text-amber-500"
                          aria-label="Fixada"
                        />
                      )}
                      <CardTitle className="text-md line-clamp-2 transition-colors">
                        {note.title || "Nota sem título"}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">Mais ações</span>⋮
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              // Ativa modo de seleção e seleciona esta nota
                              setSelectionMode(true);
                              toggleSelectNote(note.id, true);
                            }}
                          >
                            Selecionar
                          </DropdownMenuItem>
                          {/* <DropdownMenuItem
                          onClick={() => {
                            const json = exportNotesAsJSON([note]);
                            downloadFile(
                              `${note.title || note.id}.json`,
                              json,
                              "application/json"
                            );
                          }}
                        >
                          Exportar (JSON)
                        </DropdownMenuItem> */}
                          <DropdownMenuItem
                            onClick={() => {
                              const md = exportNotesAsMarkdown(
                                [note],
                                folders,
                                tagsById
                              );
                              downloadFile(
                                `${note.title || note.id}.md`,
                                md,
                                "text/markdown"
                              );
                            }}
                          >
                            Exportar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {getPreviewText(note.content)}
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Tags */}
                  {(() => {
                    const tagNames =
                      note.tagIds && note.tagIds.length > 0
                        ? note.tagIds.map(getTagNameById)
                        : note.tags || [];
                    return tagNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {tagNames.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {tagNames.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{tagNames.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : null;
                  })()}

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(note.updatedAt)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Note Drawer */}
      <NoteDrawer
        open={noteDrawerOpen}
        onOpenChange={setNoteDrawerOpen}
        currentFolderId={currentFolderId}
      />

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreateFolder={handleCreateFolder}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A nota será permanentemente
              excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

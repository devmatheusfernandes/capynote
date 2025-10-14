"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Calendar,
  Trash2,
  Edit,
  FileText,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function NotasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
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

  // Subscribe to Firestore notes and folders for the authenticated user
  useEffect(() => {
    if (!user?.id) return;

    const notesRef = collection(db, "users", user.id, "notes");
    const foldersRef = collection(db, "users", user.id, "folders");

    const unsubNotes = onSnapshot(notesRef, (snapshot) => {
      const fetchedNotes: NoteData[] = snapshot.docs.map(
        (d) => d.data() as NoteData
      );
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
      setFolders(fetchedFolders);
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

    setFilteredNotes(filteredNotesByFolder);
    setFilteredFolders(filteredFoldersByParent);
  }, [
    notes,
    folders,
    currentFolderId,
    searchTerm,
    selectedTags,
    getTagNameById,
  ]);

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
    <div className="container mx-auto p-6 sm:max-w-[80vw] max-w-[100vw]">
      {/* Header */}
      <PageHeader
        title="Notas"
        otherButton={
          <div className="flex flex-row items-center gap-2">
            <Button variant="outline" onClick={() => setNoteDrawerOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova Nota
            </Button>
            <Button variant="outline" onClick={() => setCreateFolderOpen(true)}>
              <FolderPlus className="h-4 w-4" />
              Nova Pasta
            </Button>
          </div>
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
            />
          ))}

          {/* Notes */}
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => handleEditNote(note.id)}
            >
              <CardHeader className="">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2 transition-colors">
                    {note.title || "Nota sem título"}
                  </CardTitle>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditNote(note.id);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
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
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {getPreviewText(note.content)}
                </p>

                {/* Tags */}
                {(() => {
                  const tagNames =
                    note.tagIds && note.tagIds.length > 0
                      ? note.tagIds.map(getTagNameById)
                      : note.tags || [];
                  return tagNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tagNames.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
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
          ))}
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

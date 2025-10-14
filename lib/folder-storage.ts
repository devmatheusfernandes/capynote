import { FolderData, NoteData } from "@/types";

export const folderStorage = {
  getFolders: (): FolderData[] => {
    try {
      return JSON.parse(localStorage.getItem("folders") || "[]");
    } catch {
      return [];
    }
  },

  saveFolders: (folders: FolderData[]) => {
    localStorage.setItem("folders", JSON.stringify(folders));
    window.dispatchEvent(new Event("foldersUpdated"));
  },

  createFolder: (name: string, parentId?: string): FolderData => {
    const folder: FolderData = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const folders = folderStorage.getFolders();
    folders.push(folder);
    folderStorage.saveFolders(folders);

    return folder;
  },

  updateFolder: (folderId: string, updates: Partial<FolderData>) => {
    const folders = folderStorage.getFolders();
    const folderIndex = folders.findIndex((f) => f.id === folderId);

    if (folderIndex >= 0) {
      folders[folderIndex] = {
        ...folders[folderIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      folderStorage.saveFolders(folders);
    }
  },

  deleteFolder: (folderId: string) => {
    const folders = folderStorage.getFolders();

    // Função recursiva para encontrar todas as subpastas
    const findAllSubfolders = (parentId: string): string[] => {
      const subfolders = folders.filter((f) => f.parentId === parentId);
      let allIds = [parentId];

      subfolders.forEach((subfolder) => {
        allIds = allIds.concat(findAllSubfolders(subfolder.id));
      });

      return allIds;
    };

    const foldersToDelete = findAllSubfolders(folderId);
    const updatedFolders = folders.filter(
      (f) => !foldersToDelete.includes(f.id)
    );
    folderStorage.saveFolders(updatedFolders);

    // Mover notas das pastas deletadas para a pasta raiz
    const notes: NoteData[] = JSON.parse(localStorage.getItem("notes") || "[]");
    const updatedNotes = notes.map((note) =>
      foldersToDelete.includes(note.folderId || "")
        ? { ...note, folderId: undefined }
        : note
    );
    localStorage.setItem("notes", JSON.stringify(updatedNotes));
    window.dispatchEvent(new Event("notesUpdated"));
  },

  getFolderPath: (folderId: string): FolderData[] => {
    const folders = folderStorage.getFolders();
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

  getSubfolders: (parentId?: string): FolderData[] => {
    const folders = folderStorage.getFolders();
    return folders.filter((f) => f.parentId === parentId);
  },
};

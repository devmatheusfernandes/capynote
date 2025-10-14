export interface TagData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  color?: string;
}

export interface NoteData {
  id: string;
  title: string;
  content: string;
  // Novo modelo: IDs de tags referenciando documentos em `users/{userId}/tags`
  tagIds?: string[];
  // Legado: nomes de tags diretamente na nota (mantido para compatibilidade)
  tags?: string[];
  folderId?: string; // ID da pasta onde a nota está localizada
  createdAt: string;
  updatedAt: string;
}

export interface FolderData {
  id: string;
  name: string;
  parentId?: string; // ID da pasta pai (para subpastas)
  color?: string; // Cor opcional para personalização
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

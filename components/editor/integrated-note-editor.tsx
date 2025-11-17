"use client";

import React from "react";
import NoteEditorWithToolbar from "@/components/editor/note-editor-with-toolbar";

type Props = {
  initialValue: string;
  placeholder?: string;
  onChange: (serializedState: string) => void;
  className?: string;
  showToolbar: boolean;
  openReadMode: boolean;
  onOpenReadMode: () => void;
  onCloseReadMode: () => void;
  reservedRight?: number;
};

export default function IntegratedNoteEditor({ initialValue, placeholder, onChange, className, showToolbar, openReadMode, onOpenReadMode, onCloseReadMode, reservedRight = 0 }: Props) {
  return (
    <NoteEditorWithToolbar
      placeholder={placeholder || "Comece a escrever sua nota..."}
      onChange={onChange}
      initialValue={initialValue}
      className={className}
      showToolbar={showToolbar}
      openReadMode={openReadMode}
      onOpenReadMode={onOpenReadMode}
      onCloseReadMode={onCloseReadMode}
      reservedRight={reservedRight}
    />
  );
}
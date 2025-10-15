"use client";

import "./toolbar.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType,
} from "@lexical/rich-text";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link,
  Hash,
  Eye,
} from "lucide-react";

function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv =
      (window as Window & { visualViewport?: VisualViewport }).visualViewport;
    if (!vv) return;

    const update = () => {
      // Considera apenas mobile para evitar deslocamento em telas grandes
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (!isMobile) {
        setOffset(0);
        return;
      }
      // Área oculta pelo teclado = diferença entre layout viewport e visual viewport
      const layoutH = window.innerHeight;
      const visualBottom = vv.height + vv.offsetTop;
      const hidden = Math.max(0, Math.round(layoutH - visualBottom));
      setOffset(hidden);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return offset;
}

export default function Toolbar({
  onToggleReadMode,
}: {
  onToggleReadMode?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const keyboardOffset = useKeyboardOffset();

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
    }
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      1
    );
  }, [editor, updateToolbar]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const insertHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const headingNode = $createHeadingNode(headingSize);
        selection.insertNodes([headingNode]);
      }
    });
  };

  const insertList = (listType: "bullet" | "number") => {
    if (listType === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const insertQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const quoteNode = $createQuoteNode();
        selection.insertNodes([quoteNode]);
      }
    });
  };

  const insertWikiLink = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent();
        const linkText = text || "link";
        selection.insertText(`[[${linkText}]]`);
      }
    });
  };

  const insertTag = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent();
        const tagText = text || "tag";
        selection.insertText(`#${tagText}`);
      }
    });
  };

  return (
    <div
      className="toolbar-container"
      style={{ "--kb-offset": `${keyboardOffset}px` } as CSSProperties}
    >
      <div className="toolbar-content">
        {/* Grupo de formatação de texto */}
        <div className="toolbar-group">
          <Button
            variant={isBold ? "default" : "outline"}
            size="sm"
            onClick={() => formatText("bold")}
            className="toolbar-button"
            title="Negrito (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            variant={isItalic ? "default" : "outline"}
            size="sm"
            onClick={() => formatText("italic")}
            className="toolbar-button"
            title="Itálico (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            variant={isUnderline ? "default" : "outline"}
            size="sm"
            onClick={() => formatText("underline")}
            className="toolbar-button"
            title="Sublinhado (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>

          <Button
            variant={isStrikethrough ? "default" : "outline"}
            size="sm"
            onClick={() => formatText("strikethrough")}
            className="toolbar-button"
            title="Riscado"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>

          <Button
            variant={isCode ? "default" : "outline"}
            size="sm"
            onClick={() => formatText("code")}
            className="toolbar-button"
            title="Código inline"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        <div className="toolbar-separator" />

        {/* Grupo de títulos */}
        <div className="toolbar-group">
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertHeading("h1")}
            className="toolbar-button"
            title="Título 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => insertHeading("h2")}
            className="toolbar-button"
            title="Título 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => insertHeading("h3")}
            className="toolbar-button"
            title="Título 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        <div className="toolbar-separator" />

        {/* Grupo de listas e citação */}
        <div className="toolbar-group">
          <Button
            variant="outline"
            size="sm"
            onClick={() => insertList("bullet")}
            className="toolbar-button"
            title="Lista com marcadores"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => insertList("number")}
            className="toolbar-button"
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={insertQuote}
            className="toolbar-button"
            title="Citação"
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>

        <div className="toolbar-separator" />

        {/* Grupo Obsidian */}
        <div className="toolbar-group">
          <Button
            variant="outline"
            size="sm"
            onClick={insertWikiLink}
            className="toolbar-button toolbar-button-secondary"
            title="Wikilink [[]]"
          >
            <Link className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={insertTag}
            className="toolbar-button toolbar-button-secondary"
            title="Tag #"
          >
            <Hash className="h-4 w-4" />
          </Button>
        </div>

        <div className="toolbar-separator" />

        {/* Modo leitura */}
        <div className="toolbar-group">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleReadMode}
            className="toolbar-button"
            title="Modo leitura"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

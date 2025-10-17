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
import { $insertNodeToNearestRoot } from "@lexical/utils";
import {
  INSERT_HORIZONTAL_RULE_COMMAND,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $createCodeNode } from "@lexical/code";
import { TOGGLE_LINK_COMMAND } from "@lexical/link"; // Usando TOGGLE_LINK_COMMAND

import { useCallback, useEffect, useState, useRef } from "react";
import type { CSSProperties, JSX } from "react";
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
  Eye,
  ChevronUp,
  Quote,
  Minus,
  Link,
  BookOpenText,
  Hash,
  SquareTerminal,
} from "lucide-react";

export { HorizontalRuleNode };

// ===============================================
// === 🎯 CORREÇÃO 1: Botões fora do componente ===
// ===============================================

// Largura de um botão para cálculo de responsividade
const BUTTON_WIDTH = 40; // Largura aproximada de cada botão
const EXPAND_BUTTON_WIDTH = 40; // Largura do botão de expandir
const BUTTON_GAP = 4; // Espaçamento entre botões

// Funções de ação (passadas como props ou definidas globalmente)
type ToolbarActions = {
  formatText: (format: TextFormatType) => void;
  insertHeading: (headingSize: HeadingTagType) => void;
  insertList: (listType: "bullet" | "number") => void;
  insertQuote: () => void;
  insertHorizontalRule: () => void;
  insertCodeBlock: () => void;
  insertLink: () => void;
  insertWikiLink: () => void;
  insertTag: () => void;
  onToggleReadMode: () => void;
};

// O componente que representa cada botão
type ToolbarButtonComponent = {
  id: number;
  component: JSX.Element;
};

// Função para criar a lista de botões (passa os estados is* e ações como props)
const createButtonsList = (
  isBold: boolean,
  isItalic: boolean,
  isUnderline: boolean,
  isStrikethrough: boolean,
  isCode: boolean,
  actions: ToolbarActions
): ToolbarButtonComponent[] => [
  {
    id: 0,
    component: (
      <Button
        key="bold"
        variant={isBold ? "default" : "ghost"}
        size="sm"
        onClick={() => actions.formatText("bold")}
        className={`toolbar-button ${isBold ? "active" : ""}`}
        data-state={isBold ? "on" : "off"}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 1,
    component: (
      <Button
        key="italic"
        variant={isItalic ? "default" : "ghost"}
        size="sm"
        onClick={() => actions.formatText("italic")}
        className={`toolbar-button ${isItalic ? "active" : ""}`}
        data-state={isItalic ? "on" : "off"}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 2,
    component: (
      <Button
        key="underline"
        variant={isUnderline ? "default" : "ghost"}
        size="sm"
        onClick={() => actions.formatText("underline")}
        className={`toolbar-button ${isUnderline ? "active" : ""}`}
        data-state={isUnderline ? "on" : "off"}
        title="Sublinhado (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 3,
    component: (
      <Button
        key="strikethrough"
        variant={isStrikethrough ? "default" : "ghost"}
        size="sm"
        onClick={() => actions.formatText("strikethrough")}
        className={`toolbar-button ${isStrikethrough ? "active" : ""}`}
        data-state={isStrikethrough ? "on" : "off"}
        title="Riscado"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 4,
    component: (
      <Button
        key="code"
        variant={isCode ? "default" : "ghost"}
        size="sm"
        onClick={() => actions.formatText("code")}
        className={`toolbar-button ${isCode ? "active" : ""}`}
        data-state={isCode ? "on" : "off"}
        title="Código inline"
      >
        <Code className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 5,
    component: (
      <Button
        key="h1"
        variant="ghost"
        size="sm"
        onClick={() => actions.insertHeading("h1")}
        className="toolbar-button"
        title="Título 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 6,
    component: (
      <Button
        key="h2"
        variant="ghost"
        size="sm"
        onClick={() => actions.insertHeading("h2")}
        className="toolbar-button"
        title="Título 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 7,
    component: (
      <Button
        key="h3"
        variant="ghost"
        size="sm"
        onClick={() => actions.insertHeading("h3")}
        className="toolbar-button"
        title="Título 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 8,
    component: (
      <Button
        key="bullet-list"
        variant="ghost"
        size="sm"
        onClick={() => actions.insertList("bullet")}
        className="toolbar-button"
        title="Lista com marcadores"
      >
        <List className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 9,
    component: (
      <Button
        key="ordered-list"
        variant="ghost"
        size="sm"
        onClick={() => actions.insertList("number")}
        className="toolbar-button"
        title="Lista numerada"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 10,
    component: (
      <Button
        key="quote"
        variant="ghost"
        size="sm"
        onClick={actions.insertQuote}
        className="toolbar-button"
        title="Citação"
      >
        <Quote className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 11,
    component: (
      <Button
        key="hr"
        variant="ghost"
        size="sm"
        onClick={actions.insertHorizontalRule}
        className="toolbar-button"
        title="Divisor Horizontal"
      >
        <Minus className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 12,
    component: (
      <Button
        key="code-block"
        variant="ghost"
        size="sm"
        onClick={actions.insertCodeBlock}
        className="toolbar-button"
        title="Bloco de Código"
      >
        <SquareTerminal className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 13,
    component: (
      <Button
        key="link"
        variant="ghost"
        size="sm"
        onClick={actions.insertLink}
        className="toolbar-button"
        title="Inserir Link"
      >
        <Link className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 14,
    component: (
      <Button
        key="insert-tag"
        variant="ghost"
        size="sm"
        onClick={actions.insertTag}
        className="toolbar-button toolbar-button-secondary"
        title="Inserir Tag (#tag)"
      >
        <Hash className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 15,
    component: (
      <Button
        key="insert-wiki-link"
        variant="ghost"
        size="sm"
        onClick={actions.insertWikiLink}
        className="toolbar-button toolbar-button-secondary"
        title="Inserir Link Wiki ([[link]])"
      >
        <BookOpenText className="h-4 w-4" />
      </Button>
    ),
  },
  {
    id: 16,
    component: (
      <Button
        key="read-mode"
        variant="ghost"
        size="sm"
        onClick={actions.onToggleReadMode}
        className="toolbar-button"
        title="Modo leitura"
      >
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];

// O número total de botões é estável
const TOTAL_BUTTONS = createButtonsList(
  false,
  false,
  false,
  false,
  false,
  {} as ToolbarActions
).length;

// ===============================================
// === FIM: Botões fora do componente          ===
// ===============================================

function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = (window as Window & { visualViewport?: VisualViewport })
      .visualViewport;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleButtons, setVisibleButtons] = useState<number[]>([]);
  const [hasOverflow, setHasOverflow] = useState(false);
  const keyboardOffset = useKeyboardOffset();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // --- Funções de Ação Lexical (Permanecem aqui) ---
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
        $insertNodeToNearestRoot(quoteNode);
      }
    });
  };

  const insertHorizontalRule = () => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  };

  const insertCodeBlock = () => {
    editor.update(() => {
      const codeNode = $createCodeNode();
      $insertNodeToNearestRoot(codeNode);
    });
  };

  const insertLink = () => {
    const linkUrl = prompt("Enter the URL");
    if (linkUrl) {
      // Usando TOGGLE_LINK_COMMAND
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
    }
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
  // --- Fim das Funções de Ação Lexical ---

  // Objeto de ações para ser passado para createButtonsList
  const actions: ToolbarActions = {
    formatText,
    insertHeading,
    insertList,
    insertQuote,
    insertHorizontalRule,
    insertCodeBlock,
    insertLink,
    insertWikiLink,
    insertTag,
    onToggleReadMode: onToggleReadMode || (() => {}),
  };

  // A lista de botões é re-criada AQUI para refletir os estados is* atuais
  const buttons = createButtonsList(
    isBold,
    isItalic,
    isUnderline,
    isStrikethrough,
    isCode,
    actions
  );

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

  // Calcula quantos botões cabem na largura disponível
  useEffect(() => {
    const calculateVisibleButtons = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const padding = 16;
      const buttonWidth = BUTTON_WIDTH;
      const expandButtonWidth = EXPAND_BUTTON_WIDTH;
      const gap = BUTTON_GAP;

      const availableWidthForButtons = containerWidth - padding;
      const reservedWidthForExpand = expandButtonWidth + gap;

      let count = 0;
      let buttonsFit = 0;

      // Usamos a constante TOTAL_BUTTONS que é estável
      for (let i = 0; i < TOTAL_BUTTONS; i++) {
        const currentButtonsWidth = i * (buttonWidth + gap);
        const nextTotalWidth =
          currentButtonsWidth + buttonWidth + reservedWidthForExpand;

        if (nextTotalWidth > availableWidthForButtons) {
          break;
        }
        buttonsFit++;
      }

      count = buttonsFit;
      count = Math.max(3, count);
      count = Math.min(TOTAL_BUTTONS, count);

      // Gera o novo array de IDs visíveis
      const newVisibleButtons = Array.from({ length: count }, (_, i) => i);

      // --- Checagem de Mudança para Evitar Loop ---
      // CORREÇÃO ESSENCIAL: Checa se houve mudança real antes de chamar setState
      // Este bloco foi mantido e é a chave para evitar loop *dentro* da função
      // (embora a dependência fosse o problema primário).

      // 1. Atualiza visibleButtons se for diferente
      const currentVisibleButtonsString = JSON.stringify(visibleButtons);
      const newVisibleButtonsString = JSON.stringify(newVisibleButtons);

      if (currentVisibleButtonsString !== newVisibleButtonsString) {
        setVisibleButtons(newVisibleButtons);
      }

      // 2. Atualiza hasOverflow se for diferente
      const newHasOverflow = count < TOTAL_BUTTONS;
      if (newHasOverflow !== hasOverflow) {
        setHasOverflow(newHasOverflow);
        // Garante que isExpanded é false se não há overflow
        if (!newHasOverflow && isExpanded) {
          setIsExpanded(false);
        }
      }
    };

    const debouncedCalculate = () => {
      requestAnimationFrame(calculateVisibleButtons);
    };

    // Chama a função imediatamente
    calculateVisibleButtons();

    // Adiciona event listeners
    window.addEventListener("resize", debouncedCalculate);
    window.addEventListener("orientationchange", debouncedCalculate);

    return () => {
      window.removeEventListener("resize", debouncedCalculate);
      window.removeEventListener("orientationchange", debouncedCalculate);
    };
    // CORREÇÃO FINAL: Usamos TOTAL_BUTTONS que é estável e global.
    // O problema de loop era causado pela declaração de 'buttons' dentro do componente.
    // Agora, as dependências do useEffect estão corretas e estáveis.
  }, [hasOverflow, isExpanded, visibleButtons]); // Manter estas dependências para React 18, mas a lista de botões é estável.

  return (
    <div
      ref={containerRef}
      className={`toolbar-container ${
        hasOverflow && isExpanded ? "expanded" : ""
      }`}
      style={{ "--kb-offset": `${keyboardOffset}px` } as CSSProperties}
    >
      <div ref={contentRef} className="toolbar-content">
        {/* Renderiza botões visíveis ou todos se expandido */}
        {(isExpanded && hasOverflow
          ? buttons
          : buttons.filter((b) => visibleButtons.includes(b.id))
        ).map((button) => button.component)}

        {/* Botão de expandir - só aparece se houver overflow */}
        {hasOverflow && (
          <div className="toolbar-expand-button">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="toolbar-button"
              title={isExpanded ? "Recolher toolbar" : "Expandir toolbar"}
            >
              <ChevronUp
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

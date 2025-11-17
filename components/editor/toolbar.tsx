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
import { $setBlocksType, $patchStyleText } from "@lexical/selection";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType,
} from "@lexical/rich-text";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";
import {
  INSERT_HORIZONTAL_RULE_COMMAND,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $createCodeNode } from "@lexical/code";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";

import { useCallback, useEffect, useState, useRef, Fragment } from "react";
import { $isTextNode } from "lexical";
import type { CSSProperties, JSX, ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Eye,
  ChevronsUp,
  Quote,
  Minus,
  Link2,
  FileText,
  Hash,
  Terminal,
  Highlighter,
  Palette,
  MessageSquareText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export { HorizontalRuleNode };

const BUTTON_WIDTH = 40;
const EXPAND_BUTTON_WIDTH = 40;
const BUTTON_GAP = 4;

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
  toggleHighlight: () => void;
  setTextColor: (color: string) => void;
  insertComment: () => void;
};

type ToolbarButtonComponent = {
  id: number;
  component: JSX.Element;
  category: "format" | "structure" | "insert" | "special";
};

// Componente de botão animado com Framer Motion
const AnimatedButton = ({
  isActive,
  onClick,
  title,
  icon: Icon,
  variant = "default",
}: {
  isActive?: boolean;
  onClick: () => void;
  title: string;
  icon: ComponentType<{ className?: string }>;
  variant?: "default" | "secondary";
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Button
        variant={isActive ? "default" : "ghost"}
        size="sm"
        onClick={onClick}
        className={`toolbar-button ${isActive ? "active" : ""} ${
          variant === "secondary" ? "toolbar-button-secondary" : ""
        }`}
        data-state={isActive ? "on" : "off"}
        title={title}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </motion.div>
  );
};

// Componente de dropdown animado para cores
const ColorPicker = ({
  onColorSelect,
}: {
  onColorSelect: (color: string) => void;
}) => {
  const colors = [
    { label: "Padrão", value: "", color: "rgb(148 163 184)" },
    { label: "Vermelho", value: "#dc2626", color: "#dc2626" },
    { label: "Laranja", value: "#ea580c", color: "#ea580c" },
    { label: "Amarelo", value: "#ca8a04", color: "#ca8a04" },
    { label: "Verde", value: "#16a34a", color: "#16a34a" },
    { label: "Azul", value: "#2563eb", color: "#2563eb" },
    { label: "Roxo", value: "#9333ea", color: "#9333ea" },
    { label: "Rosa", value: "#db2777", color: "#db2777" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="sm"
            className="toolbar-button"
            title="Cor do texto"
          >
            <Palette className="h-4 w-4" />
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {colors.map((c) => (
          <DropdownMenuItem
            key={c.label}
            onClick={() => onColorSelect(c.value)}
            className="cursor-pointer"
          >
            <div
              className="w-4 h-4 rounded mr-2 border border-border"
              style={{ backgroundColor: c.color }}
            />
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const createButtonsList = (
  isBold: boolean,
  isItalic: boolean,
  isUnderline: boolean,
  isStrikethrough: boolean,
  isCode: boolean,
  actions: ToolbarActions
): ToolbarButtonComponent[] => [
  // FORMATAÇÃO
  {
    id: 0,
    category: "format",
    component: (
      <AnimatedButton
        key="bold"
        isActive={isBold}
        onClick={() => actions.formatText("bold")}
        title="Negrito (Ctrl+B)"
        icon={Bold}
      />
    ),
  },
  {
    id: 1,
    category: "format",
    component: (
      <AnimatedButton
        key="italic"
        isActive={isItalic}
        onClick={() => actions.formatText("italic")}
        title="Itálico (Ctrl+I)"
        icon={Italic}
      />
    ),
  },
  {
    id: 2,
    category: "format",
    component: (
      <AnimatedButton
        key="underline"
        isActive={isUnderline}
        onClick={() => actions.formatText("underline")}
        title="Sublinhado (Ctrl+U)"
        icon={Underline}
      />
    ),
  },
  {
    id: 3,
    category: "format",
    component: (
      <AnimatedButton
        key="highlight"
        onClick={actions.toggleHighlight}
        title="Destacar texto"
        icon={Highlighter}
      />
    ),
  },
  {
    id: 4,
    category: "format",
    component: (
      <AnimatedButton
        key="code"
        isActive={isCode}
        onClick={() => actions.formatText("code")}
        title="Código inline"
        icon={Code2}
      />
    ),
  },
  {
    id: 17,
    category: "format",
    component: (
      <ColorPicker key="text-color" onColorSelect={actions.setTextColor} />
    ),
  },
  // ESTRUTURA
  {
    id: 5,
    category: "structure",
    component: (
      <AnimatedButton
        key="h1"
        onClick={() => actions.insertHeading("h1")}
        title="Título 1"
        icon={Heading1}
      />
    ),
  },
  {
    id: 6,
    category: "structure",
    component: (
      <AnimatedButton
        key="h2"
        onClick={() => actions.insertHeading("h2")}
        title="Título 2"
        icon={Heading2}
      />
    ),
  },
  {
    id: 7,
    category: "structure",
    component: (
      <AnimatedButton
        key="h3"
        onClick={() => actions.insertHeading("h3")}
        title="Título 3"
        icon={Heading3}
      />
    ),
  },
  {
    id: 8,
    category: "structure",
    component: (
      <AnimatedButton
        key="bullet-list"
        onClick={() => actions.insertList("bullet")}
        title="Lista com marcadores"
        icon={List}
      />
    ),
  },
  {
    id: 9,
    category: "structure",
    component: (
      <AnimatedButton
        key="ordered-list"
        onClick={() => actions.insertList("number")}
        title="Lista numerada"
        icon={ListOrdered}
      />
    ),
  },
  {
    id: 10,
    category: "structure",
    component: (
      <AnimatedButton
        key="quote"
        onClick={actions.insertQuote}
        title="Citação"
        icon={Quote}
      />
    ),
  },
  // INSERIR
  {
    id: 11,
    category: "insert",
    component: (
      <AnimatedButton
        key="hr"
        onClick={actions.insertHorizontalRule}
        title="Divisor horizontal"
        icon={Minus}
      />
    ),
  },
  {
    id: 12,
    category: "insert",
    component: (
      <AnimatedButton
        key="code-block"
        onClick={actions.insertCodeBlock}
        title="Bloco de código"
        icon={Terminal}
      />
    ),
  },
  {
    id: 13,
    category: "insert",
    component: (
      <AnimatedButton
        key="link"
        onClick={actions.insertLink}
        title="Inserir link"
        icon={Link2}
      />
    ),
  },
  {
    id: 18,
    category: "insert",
    component: (
      <AnimatedButton
        key="comment"
        onClick={actions.insertComment}
        title="Adicionar comentário"
        icon={MessageSquareText}
      />
    ),
  },
  // ESPECIAIS
  {
    id: 14,
    category: "special",
    component: (
      <AnimatedButton
        key="insert-tag"
        onClick={actions.insertTag}
        title="Inserir tag (#tag)"
        icon={Hash}
        variant="secondary"
      />
    ),
  },
  {
    id: 15,
    category: "special",
    component: (
      <AnimatedButton
        key="insert-wiki-link"
        onClick={actions.insertWikiLink}
        title="Inserir link wiki ([[link]])"
        icon={FileText}
        variant="secondary"
      />
    ),
  },
  {
    id: 16,
    category: "special",
    component: (
      <AnimatedButton
        key="read-mode"
        onClick={actions.onToggleReadMode}
        title="Modo leitura"
        icon={Eye}
      />
    ),
  },
];

const TOTAL_BUTTONS = createButtonsList(
  false,
  false,
  false,
  false,
  false,
  {} as ToolbarActions
).length;

function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = (window as Window & { visualViewport?: VisualViewport })
      .visualViewport;
    if (!vv) return;

    const update = () => {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (!isMobile) {
        setOffset(0);
        return;
      }
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
  reservedRight = 0,
}: {
  onToggleReadMode?: () => void;
  reservedRight?: number;
}) {
  const sidebarExpanded = reservedRight > 0;
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

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const insertHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
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
        const anchor = selection.anchor;
        const element = anchor.getNode().getTopLevelElement();
        if (element && element.getType() !== "quote") {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      }
    });
  };

  const insertHorizontalRule = () => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  };

  const insertCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        const codeNode = $createCodeNode();
        const children = element.getChildren();
        children.forEach((child) => {
          codeNode.append(child);
        });
        element.replace(codeNode);
        codeNode.selectEnd();
      }
    });
  };

  const insertLink = () => {
    const linkUrl = prompt("Digite a URL do link:");
    if (linkUrl) {
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

  const toggleHighlight = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const HIGHLIGHT_COLOR = "#fef08a";
        const nodes = selection.getNodes();

        let anyHighlighted = false;
        let allHighlightedWithTarget = true;

        for (const node of nodes) {
          if ($isTextNode(node)) {
            const style = node.getStyle() || "";
            const hasBg = /background-color\s*:\s*[^;]+/i.test(style);
            if (hasBg) anyHighlighted = true;
            if (
              !new RegExp(
                `background-color\\s*:\\s*${HIGHLIGHT_COLOR}`,
                "i"
              ).test(style)
            ) {
              allHighlightedWithTarget = false;
            }
          }
        }

        if (anyHighlighted && allHighlightedWithTarget) {
          $patchStyleText(selection, { "background-color": "", color: "" });
        } else {
          $patchStyleText(selection, {
            "background-color": HIGHLIGHT_COLOR,
            color: "#000000",
          });
        }
      }
    });
  };

  const setTextColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (!color) {
          $patchStyleText(selection, { color: "", "background-color": "" });
        } else {
          $patchStyleText(selection, { color });
        }
      }
    });
  };

  const insertComment = () => {
    window.dispatchEvent(new Event("editor-open-comment-dialog"));
  };

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
    toggleHighlight,
    setTextColor,
    insertComment,
  };

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

      let buttonsFit = 0;

      for (let i = 0; i < TOTAL_BUTTONS; i++) {
        const currentButtonsWidth = i * (buttonWidth + gap);
        const nextTotalWidth =
          currentButtonsWidth + buttonWidth + reservedWidthForExpand;

        if (nextTotalWidth > availableWidthForButtons) {
          break;
        }
        buttonsFit++;
      }

      const count = Math.min(TOTAL_BUTTONS, Math.max(3, buttonsFit));
      const newVisibleButtons = Array.from({ length: count }, (_, i) => i);

      const currentVisibleButtonsString = JSON.stringify(visibleButtons);
      const newVisibleButtonsString = JSON.stringify(newVisibleButtons);

      if (currentVisibleButtonsString !== newVisibleButtonsString) {
        setVisibleButtons(newVisibleButtons);
      }

      const newHasOverflow = count < TOTAL_BUTTONS;
      if (newHasOverflow !== hasOverflow) {
        setHasOverflow(newHasOverflow);
        if (!newHasOverflow && isExpanded) {
          setIsExpanded(false);
        }
      }
    };

    const debouncedCalculate = () => {
      requestAnimationFrame(calculateVisibleButtons);
    };

    calculateVisibleButtons();

    window.addEventListener("resize", debouncedCalculate);
    window.addEventListener("orientationchange", debouncedCalculate);

    return () => {
      window.removeEventListener("resize", debouncedCalculate);
      window.removeEventListener("orientationchange", debouncedCalculate);
    };
  }, [hasOverflow, isExpanded, visibleButtons]);

  // Organiza botões por categoria quando expandido
  const buttonsByCategory = {
    format: buttons.filter((b) => b.category === "format"),
    structure: buttons.filter((b) => b.category === "structure"),
    insert: buttons.filter((b) => b.category === "insert"),
    special: buttons.filter((b) => b.category === "special"),
  };

  const categoryLabels = {
    format: "Formatação",
    structure: "Estrutura",
    insert: "Inserir",
    special: "Especial",
  };

  return (
    <motion.div
      ref={containerRef}
      className={`toolbar-container ${
        hasOverflow && isExpanded ? "expanded" : ""
      }`}
      style={{ "--kb-offset": `${keyboardOffset}px` } as CSSProperties}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1, right: reservedRight }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div ref={contentRef} className="toolbar-content">
        {!isExpanded ? (
          // Vista compacta - botões em linha
          <AnimatePresence mode="popLayout">
            {buttons
              .filter((b) => visibleButtons.includes(b.id))
              .map((button) => (
                <motion.div
                  key={button.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  {button.component}
                </motion.div>
              ))}
          </AnimatePresence>
        ) : (
          // Vista expandida - botões por categoria
          <motion.div
            className="toolbar-categories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {Object.entries(buttonsByCategory).map(
              ([category, categoryButtons], categoryIndex) => (
                <motion.div
                  key={category}
                  className="toolbar-category"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: categoryIndex * 0.05 }}
                >
                  <div className="toolbar-category-label">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </div>
                  <div className="toolbar-category-buttons">
                    {categoryButtons.map((button, index) => (
                      <motion.div
                        key={button.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          delay: categoryIndex * 0.05 + index * 0.02,
                        }}
                      >
                        {button.component}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )
            )}
          </motion.div>
        )}

        {hasOverflow && (
          <motion.div
            className="toolbar-expand-button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="toolbar-button"
                title={isExpanded ? "Recolher toolbar" : "Expandir toolbar"}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronsUp className="h-4 w-4" />
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

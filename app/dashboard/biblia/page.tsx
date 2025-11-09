"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, X, Loader2, ChevronDown } from "lucide-react";

type ChapterContent = { verse: number; text: string }[];

export default function BibliaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const verseParam = params.get("verse");
  const [books, setBooks] = useState<string[]>([]);
  const [book, setBook] = useState<string>(params.get("book") || "");
  const [chapters, setChapters] = useState<number[]>([]);
  const [chapter, setChapter] = useState<number | null>(
    params.get("chapter") ? Number(params.get("chapter")) : null
  );
  const [content, setContent] = useState<ChapterContent>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<
    Array<{ book: string; chapter: number; verse: number; text: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  function scrollVerseIntoView(n: number) {
    const el = document.querySelector(
      `[data-verse="${n}"]`
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offset = 96; // keep verse near the top under sticky header
    const y = rect.top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // Load books
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/bible");
        const data = await res.json();
        setBooks(data.books || []);
      } catch {
        setError("Falha ao carregar livros");
      }
    })();
  }, []);

  // Default to Gênesis 1 when no params are provided
  useEffect(() => {
    if (!book && books.length > 0) {
      setBook(books[0]);
      setChapter(1);
    }
  }, [books]);

  // When book changes, load chapters
  useEffect(() => {
    if (!book) return;
    (async () => {
      try {
        const res = await fetch(`/api/bible?book=${encodeURIComponent(book)}`);
        const data = await res.json();
        if (data.chapters) setChapters(data.chapters);
        // If no chapter was specified (e.g., only book in URL), default to 1
        if (chapter === null) {
          setChapter(1);
        }
        setError(null);
      } catch {
        setError("Falha ao carregar capítulos");
      }
    })();
  }, [book]);

  // When chapter changes, load content
  useEffect(() => {
    if (!book || !chapter) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/bible?book=${encodeURIComponent(book)}&chapter=${chapter}`
        );
        const data = await res.json();
        setContent(data.content || []);
        setNotes(data.notes ?? null);
        setError(null);
      } catch {
        setError("Falha ao carregar capítulo");
      } finally {
        setLoading(false);
      }
    })();
  }, [book, chapter]);

  // Sync URL
  useEffect(() => {
    const q = new URLSearchParams();
    if (book) q.set("book", book);
    if (chapter) q.set("chapter", String(chapter));
    if (verseParam) q.set("verse", verseParam);
    router.replace(`/dashboard/biblia?${q.toString()}`);
  }, [book, chapter, router]);

  async function handleSearch() {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearching(true);
    setShowSearchResults(true);
    try {
      const res = await fetch(`/api/bible/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setError("Falha ao buscar versículos");
    } finally {
      setSearching(false);
    }
  }

  function handleResultClick(r: {
    book: string;
    chapter: number;
    verse: number;
  }) {
    setBook(r.book);
    setChapter(r.chapter);
    setHighlightedVerse(r.verse);
    setShowSearchResults(false);

    // Remove highlight after 3 seconds
    setTimeout(() => setHighlightedVerse(null), 3000);
    // Scroll to selected verse so it appears on top
    requestAnimationFrame(() => scrollVerseIntoView(r.verse));
  }

  // Highlight verse from URL when arriving via deep-link
  useEffect(() => {
    if (!verseParam) return;
    const n = Number(verseParam);
    if (Number.isNaN(n)) return;
    if (content.length === 0) return; // wait until chapter content loads
    setHighlightedVerse(n);
    // Scroll so the verse is visible at the top region
    requestAnimationFrame(() => scrollVerseIntoView(n));
    const t = setTimeout(() => setHighlightedVerse(null), 3000);
    return () => clearTimeout(t);
  }, [verseParam, content]);

  function clearSearch() {
    setQuery("");
    setResults([]);
    setShowSearchResults(false);
  }

  // Highlight matching text in search results
  function highlightText(text: string, searchQuery: string) {
    if (!searchQuery) return text;

    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-safe">
      <div className="p-3 sm:p-4 w-full px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold">Bíblia Sagrada</h1>
          </div>
        </motion.div>

        {/* Search and Selectors - Same Row on Desktop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex flex-wrap gap-3">
            {/* Search Bar */}
            <div className="min-w-0">
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar versículos..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                  className="pl-9 pr-20 h-11 text-base"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <AnimatePresence>
                    {query && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={clearSearch}
                        className="p-1.5 hover:bg-muted rounded-md transition-colors"
                        aria-label="Limpar busca"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Book Selector */}
            <div className="min-w-0">
              <label className="text-sm font-medium mb-2 block">Livro</label>
              <Select
                value={book}
                onValueChange={(value) => {
                  setBook(value);
                  setChapter(1);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione um livro" />
                </SelectTrigger>
                <SelectContent>
                  {books.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chapter Selector */}
            <div className="min-w-0">
              <label className="text-sm font-medium mb-2 block">Capítulo</label>
              <Select
                value={chapter ? String(chapter) : ""}
                onValueChange={(v) => setChapter(Number(v))}
                disabled={!book}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Cap." />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Search Results */}
        <AnimatePresence>
          {showSearchResults && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="border rounded-lg bg-card shadow-lg">
                <div className="p-3 sm:p-4 border-b bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium">Resultados</span>
                      <span className="text-xs text-muted-foreground">
                        ({results.length})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSearchResults(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                  {searching ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-12 px-4 text-muted-foreground">
                      <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum versículo encontrado</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {results.map((r, idx) => (
                        <motion.button
                          key={`${r.book}-${r.chapter}-${r.verse}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="w-full text-left active:bg-muted/70 sm:hover:bg-muted/50 p-3 sm:p-4 transition-colors group touch-manipulation"
                          onClick={() => handleResultClick(r)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {r.verse}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {r.book} {r.chapter}:{r.verse}
                              </div>
                              <div className="text-sm leading-relaxed">
                                {highlightText(r.text, query)}
                              </div>
                            </div>
                            <ChevronDown className="hidden sm:block w-4 h-4 text-muted-foreground -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Carregando capítulo...
              </p>
            </div>
          </motion.div>
        )}

        {/* Chapter Content */}
        <AnimatePresence mode="wait">
          {!loading && !error && content.length > 0 && (
            <motion.div
              key={`${book}-${chapter}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-lg shadow-lg border overflow-hidden"
            >
              <div className="p-4 sm:p-6 border-b bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                <h2 className="text-xl sm:text-2xl font-bold truncate">
                  {book} - Capítulo {chapter}
                </h2>
              </div>
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                {content.map((v, idx) => (
                  <motion.div
                    key={v.verse}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    data-verse={v.verse}
                    className={`flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all touch-manipulation ${
                      highlightedVerse === v.verse
                        ? "bg-yellow-100 dark:bg-yellow-900/20 shadow-md scale-[1.02]"
                        : "active:bg-muted/50 sm:hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs sm:text-sm font-semibold text-primary">
                      {v.verse}
                    </div>
                    <div className="flex-1 text-sm sm:text-base leading-relaxed pt-0.5 sm:pt-1">
                      {v.text}
                    </div>
                  </motion.div>
                ))}
              </div>
              {notes && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="p-4 sm:p-6 border-t bg-muted/20"
                >
                  <h3 className="text-xs sm:text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                    Notas
                  </h3>
                  <div className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {notes}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && !error && content.length === 0 && !book && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 px-4 text-muted-foreground"
          >
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-base mb-2">Bem-vindo à Bíblia Sagrada</p>
            <p className="text-sm">
              Selecione um livro e capítulo para começar a ler
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

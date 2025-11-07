"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeBookToken } from "@/lib/bible-abbreviations-pt";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "../ui/spinner";
import Error from "next/error";

type VerseInfo = {
  book: string;
  chapter: number;
  // quando múltiplos versos são especificados
  verses?: number[];
  // fallback para único verso
  verse?: number;
  text?: string;
};

function parseReference(text: string): VerseInfo | null {
  // Suporta: "Livro 1:2", "Livro 1:2-5", "Livro 1:2, 4-6", "Livro 1 do 1 - 5"
  const m = text.match(
    /\b((?:[1-3]\s*)?[A-Za-zçÇáÁéÉíÍóÓúÚâÂêÊôÔãÃõÕüÜ\.]+)\s+(\d+)(?:(?::\s*([0-9,\s\-]+))|\s+(?:do|dos)\s+([0-9\s\-]+))?/i
  );
  if (!m) return null;
  const rawBook = m[1];
  const chapter = Number(m[2]);
  const versesRaw = (m[3] ?? m[4] ?? "").trim();
  const normalized =
    normalizeBookToken(rawBook) ?? rawBook.trim().replace(/\.$/, "");

  if (!versesRaw) {
    // Sem versos: considerar capítulo inteiro (navegação)
    return { book: normalized, chapter };
  }

  const verses: number[] = [];
  for (const part of versesRaw.split(/\s*,\s*/)) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const [s, e] = start <= end ? [start, end] : [end, start];
      for (let v = s; v <= e; v++) verses.push(v);
    } else {
      const n = Number(p);
      if (!Number.isNaN(n)) verses.push(n);
    }
  }

  if (verses.length === 1) {
    return { book: normalized, chapter, verse: verses[0] };
  }
  return { book: normalized, chapter, verses };
}

export default function BibleReferenceHandler() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<VerseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      const block = target.closest<HTMLElement>(
        ".editor-paragraph, p, li, div, span"
      ) ?? anchor ?? target;
      const raw = block.textContent || "";
      const text = raw.replace(/\u00A0/g, " "); // normaliza NBSP
      const info = parseReference(text);
      if (!info) return; // não é referência bíblica, segue o fluxo normal
      if (anchor) e.preventDefault();
      // Fechar teclado mobile, se aberto
      const active = document.activeElement as HTMLElement | null;
      active?.blur?.();
      setError(null);
      setLoading(true);
      setCurrent(info);
      setOpen(true);
      try {
        let displayText = "";
        if (info.verse && !info.verses) {
          // Verso único
          const params = new URLSearchParams({
            book: info.book,
            chapter: String(info.chapter),
            verse: String(info.verse),
          });
          const res = await fetch(`/api/bible?${params.toString()}`);
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || `Erro ${res.status}`);
          }
          const data = await res.json();
          displayText = data.text ?? "";
        } else {
          // Lista/faixa de versos: buscar capítulo e filtrar
          const params = new URLSearchParams({
            book: info.book,
            chapter: String(info.chapter),
          });
          const res = await fetch(`/api/bible?${params.toString()}`);
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || `Erro ${res.status}`);
          }
          const data = await res.json();
          const selected = (info.verses ?? []).length > 0 ? info.verses! : data.verses;
          const byNumber = new Map<number, string>();
          for (const item of data.content as { verse: number; text: string }[]) {
            byNumber.set(item.verse, item.text);
          }
          const lines: string[] = [];
          for (const v of selected) {
            const t = byNumber.get(v);
            if (t) lines.push(`${v}. ${t}`);
          }
          displayText = lines.join("\n\n");
        }
        setCurrent({ ...info, text: displayText });
      } catch (err: unknown) {
        const message =
          typeof err === "object" && err && "message" in (err as Record<string, unknown>)
            ? String((err as Record<string, unknown>).message)
            : "Falha ao carregar versículo";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    // captura clicks dentro do editor
    const container = document.querySelector<HTMLElement>(".editor-inner");
    if (!container) return;
    const wrappedListener: EventListener = (evt) => {
      void handleClick(evt as MouseEvent);
    };
    container.addEventListener("click", wrappedListener);
    return () => container.removeEventListener("click", wrappedListener);
  }, []);

  const title = (() => {
    if (!current) return "";
    const base = `${current.book} ${current.chapter}`;
    if (current.verse) return `${base}:${current.verse}`;
    if (current.verses && current.verses.length > 0) {
      const sorted = [...current.verses].sort((a, b) => a - b);
      // compacta se possível
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (sorted.length > 2 && last - first + 1 === sorted.length) {
        return `${base}:${first}-${last}`;
      }
      return `${base}:${sorted.join(", ")}`;
    }
    return base;
  })();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle
            className="cursor-pointer font-semibold"
            onClick={() => {
              if (!current) return;
              const q = new URLSearchParams({
                book: current.book,
                chapter: String(current.chapter),
              });
              router.push(`/dashboard/biblia?${q.toString()}`);
              setOpen(false);
            }}
          >
            {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col items-center justify-center py-4 pb-10 px-4 mb-8">
          {loading && <Spinner />}
          {error && <div className="text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="whitespace-pre-wrap pb-8">{current?.text}</div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

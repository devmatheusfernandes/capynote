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
  verse: number;
  text?: string;
};

function parseReference(text: string): VerseInfo | null {
  const m = text.match(
    /\b((?:[1-3]\s*)?[A-Za-zçÇáÁéÉíÍóÓúÚâÂêÊôÔãÃõÕüÜ\.]+)\s+(\d+):(\d+)\b/
  );
  if (!m) return null;
  const rawBook = m[1];
  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  // tenta normalizar abreviação; se falhar, usa como veio
  const normalized =
    normalizeBookToken(rawBook) ?? rawBook.trim().replace(/\.$/, "");
  return { book: normalized, chapter, verse };
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
      if (!anchor) return;
      const text = anchor.textContent || "";
      const info = parseReference(text);
      if (!info) return; // não é referência bíblica, segue o fluxo normal
      e.preventDefault();
      setError(null);
      setLoading(true);
      setCurrent(info);
      setOpen(true);
      try {
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
        setCurrent({ ...info, text: data.text });
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

  const title = current
    ? `${current.book} ${current.chapter}:${current.verse}`
    : "";

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

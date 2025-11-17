"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { normalizeBookToken, setCustomAbbreviations } from "@/lib/bible-abbreviations-pt";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useEditorSidebar } from "./integrated-editor-provider";
import { parseAllReferences } from "./utils/bible-parse";


export default function BibleReferenceHandler() {
  const { beginBiblePanel, finishBiblePanel, errorBiblePanel } = useEditorSidebar();
  const router = useRouter();
  const { user } = useAuth();

  // Assinar abreviações personalizadas do usuário e injetar no normalizador
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const settingsRef = doc(db, "users", userId, "meta", "settings");
    const unsub = onSnapshot(settingsRef, (snap) => {
      const data = snap.data() as { customAbbreviations?: Record<string, string> } | undefined;
      setCustomAbbreviations(data?.customAbbreviations || {});
    });
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return; // só reage a cliques em links
      // Apenas links bíblicos (marcados pelo autolink com href começando em #bible)
      const href = (anchor as HTMLAnchorElement).getAttribute("href") || "";
      if (!href.startsWith("#bible")) return;
      // Garante que o clique veio de dentro do editor
      const insideEditor = (anchor as HTMLElement).closest(".editor-inner");
      if (!insideEditor) return;
      const raw = anchor.textContent || "";
      const text = raw.replace(/\u00A0/g, " "); // normaliza NBSP
      const infos = parseAllReferences(text);
      if (infos.length === 0) return; // não é referência bíblica, segue o fluxo normal
      e.preventDefault();
      // Fechar teclado mobile, se aberto
      const active = document.activeElement as HTMLElement | null;
      active?.blur?.();
      // Exibir primeira referência no título; conteúdo agregará todas
      const first = infos[0];
      const title = (() => {
        const base = `${first.book} ${first.chapter}`;
        if (first.verse) return `${base}:${first.verse}`;
        if (first.verses && first.verses.length > 0) {
          const sorted = [...first.verses].sort((a, b) => a - b);
          const f = sorted[0];
          const l = sorted[sorted.length - 1];
          if (sorted.length > 2 && l - f + 1 === sorted.length) {
            return `${base}:${f}-${l}`;
          }
          return `${base}:${sorted.join(", ")}`;
        }
        return base;
      })();
      beginBiblePanel(title);
      // Solicita abertura da sidebar do editor
      try {
        window.dispatchEvent(new CustomEvent("editor-open-sidebar"));
      } catch {}
      // A abertura do painel é controlada pelo componente de sidebar integrado
      try {
        const parts: string[] = [];
        for (const info of infos) {
          if (info.verse && !info.verses) {
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
            const title = `${info.book} ${info.chapter}:${info.verse}`;
            parts.push(`${title}\n\n${data.text ?? ""}`);
          } else {
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
            const title = (() => {
              if (selected.length === 0) return `${info.book} ${info.chapter}`;
              const sorted = [...selected].sort((a, b) => a - b);
              const first = sorted[0];
              const last = sorted[sorted.length - 1];
              if (sorted.length > 2 && last - first + 1 === sorted.length) {
                return `${info.book} ${info.chapter}:${first}-${last}`;
              }
              return `${info.book} ${info.chapter}:${sorted.join(", ")}`;
            })();
            parts.push(`${title}\n\n${lines.join("\n\n")}`);
          }
        }
        const displayText = parts.join("\n\n—\n\n");
        finishBiblePanel(displayText);
      } catch (err: unknown) {
        const message =
          typeof err === "object" && err && "message" in (err as Record<string, unknown>)
            ? String((err as Record<string, unknown>).message)
            : "Falha ao carregar versículo";
        errorBiblePanel(message);
      } finally {
        // loading é controlado pelo contexto
      }
    };
    // Delegação global: captura cliques e filtra por elementos dentro do editor
    const wrappedListener: EventListener = (evt) => {
      void handleClick(evt as MouseEvent);
    };
    document.addEventListener("click", wrappedListener, true);
    return () => document.removeEventListener("click", wrappedListener, true);
  }, []);

  return null;
}

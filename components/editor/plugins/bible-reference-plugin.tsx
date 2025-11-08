import React from "react";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { normalizeBookToken } from "@/lib/bible-abbreviations-pt";

type MatcherResult = {
  index: number;
  length: number;
  text: string;
  url: string;
};

function getBibleMatch(text: string): MatcherResult | null {
  // Linka todo o conteúdo entre parênteses se TODAS as referências internas forem válidas
  // Suporta múltiplas referências separadas por ';' dentro do mesmo parêntese
  const group = /\(([^)]+)\)/i.exec(text);
  if (!group) return null;
  const inner = group[1];
  const chunks = inner.split(/\s*;\s*/).filter(Boolean);
  if (chunks.length === 0) return null;

  const singleRef = /^\s*((?:[1-3]\s*)?[A-Za-zçÇáÁéÉíÍóÓúÚâÂêÊôÔãÃõÕüÜ\.]+)\s+(\d+)(?::\s*([0-9,\s\-]+)|\s+(?:do|dos)\s+([0-9\s\-]+))?\s*$/i;
  for (const chunk of chunks) {
    const m = chunk.match(singleRef);
    if (!m) return null; // qualquer chunk inválido cancela
    const rawBook = m[1];
    const normalized = normalizeBookToken(rawBook);
    if (!normalized) return null; // exige sigla/livro conhecido
  }

  const full = group[0];
  return {
    index: group.index!,
    length: full.length,
    text: full,
    url: "#bible", // marcador para estilização e interceptação de clique
  };
}

const matchers = [(text: string) => getBibleMatch(text)];

export default function BibleReferenceAutoLink() {
  return <AutoLinkPlugin matchers={matchers} />;
}

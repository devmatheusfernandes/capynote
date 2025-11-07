import React from "react";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";

type MatcherResult = {
  index: number;
  length: number;
  text: string;
  url: string;
};

function getBibleMatch(text: string): MatcherResult | null {
  // Combina:
  //  - Livro (com ou sem número, aceita abreviações e ponto)
  //  - Capítulo
  //  - Versos opcionais: "x", "x-y", "x, y", "x, y-z" ou "do x - y"
  const m =
    /\b((?:[1-3]\s*)?[A-Za-zçÇáÁéÉíÍóÓúÚâÂêÊôÔãÃõÕüÜ\.]+)\s+(\d+)(?:(?::\s*([0-9,\s\-]+))|\s+(?:do|dos)\s+([0-9\s\-]+))?/i.exec(
      text
    );
  if (!m) return null;
  const full = m[0];
  return {
    index: m.index,
    length: full.length,
    text: full,
    url: "#", // usamos '#' e interceptamos o clique
  };
}

const matchers = [(text: string) => getBibleMatch(text)];

export default function BibleReferenceAutoLink() {
  return <AutoLinkPlugin matchers={matchers} />;
}

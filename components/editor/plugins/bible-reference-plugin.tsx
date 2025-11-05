import React from "react";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";

type MatcherResult = {
  index: number;
  length: number;
  text: string;
  url: string;
};

function getBibleMatch(text: string): MatcherResult | null {
  const m =
    /\b((?:[1-3]\s*)?[A-Za-zçÇáÁéÉíÍóÓúÚâÂêÊôÔãÃõÕüÜ\.]+)\s+(\d+):(\d+)\b/.exec(
      text
    );
  if (!m) return null;
  const full = m[0];
  return {
    index: m.index,
    length: full.length,
    text: full,
    url: "#", // usamos '#' e interceptamos o clique
    // `attributes` não é suportado diretamente; usaremos o texto para parsing
  };
}

const matchers = [(text: string) => getBibleMatch(text)];

export default function BibleReferenceAutoLink() {
  return <AutoLinkPlugin matchers={matchers} />;
}

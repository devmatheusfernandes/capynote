"use client"
import { normalizeBookToken } from "@/lib/bible-abbreviations-pt"

export type VerseInfo = {
  book: string
  chapter: number
  verses?: number[]
  verse?: number
}

export function parseAllReferences(text: string): VerseInfo[] {
  const refs: VerseInfo[] = []
  const groupPattern = /\(([^)]+)\)/g
  let gm: RegExpExecArray | null
  while ((gm = groupPattern.exec(text)) !== null) {
    const inner = gm[1]
    const chunks = inner.split(/\s*;\s*/).filter(Boolean)
    for (const chunk of chunks) {
      const m = chunk.match(/\b((?:[1-3]\s*)?[A-Za-zçÇáÁéÉíÍóÓúÚâÂêÊôÔãÃõÕüÜ\.]+)\s+(\d+)(?::\s*([0-9,\s\-]+)|\s+(?:do|dos)\s+([0-9\s\-]+))?/i)
      if (!m) continue
      const rawBook = m[1]
      const chapter = Number(m[2])
      const versesRaw = (m[3] ?? m[4] ?? "").trim()
      const normalized = normalizeBookToken(rawBook) ?? rawBook.trim().replace(/\.$/, "")
      if (!normalized) continue
      if (!versesRaw) {
        refs.push({ book: normalized, chapter })
        continue
      }
      const verses: number[] = []
      for (const part of versesRaw.split(/\s*,\s*/)) {
        const p = part.trim()
        if (!p) continue
        const range = p.match(/^(\d+)\s*\-\s*(\d+)$/)
        if (range) {
          const start = Number(range[1])
          const end = Number(range[2])
          const [s, e] = start <= end ? [start, end] : [end, start]
          for (let v = s; v <= e; v++) verses.push(v)
        } else {
          const n = Number(p)
          if (!Number.isNaN(n)) verses.push(n)
        }
      }
      if (verses.length === 1) {
        refs.push({ book: normalized, chapter, verse: verses[0] })
      } else {
        refs.push({ book: normalized, chapter, verses })
      }
    }
  }
  return refs
}

export function formatReferenceTitle(info: VerseInfo, selectedVerses?: number[]): string {
  const base = `${info.book} ${info.chapter}`
  const verses = selectedVerses ?? (info.verses ?? (info.verse ? [info.verse] : []))
  if (!verses || verses.length === 0) return base
  const sorted = [...verses].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (sorted.length > 2 && last - first + 1 === sorted.length) {
    return `${base}:${first}-${last}`
  }
  if (sorted.length === 1) {
    return `${base}:${sorted[0]}`
  }
  return `${base}:${sorted.join(", ")}`
}
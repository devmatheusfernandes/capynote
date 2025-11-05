import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type { Bible } from "@/types/bible";

export const runtime = "nodejs";

function loadBible(): Bible {
  const filePath = path.join(process.cwd(), "bible", "pt", "nwt-pt.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Bible;
}

function openDb() {
  const sqlitePath = path.join(process.cwd(), "bible", "db", "nwt-pt.sqlite");
  if (!fs.existsSync(sqlitePath)) return null;
  return new Database(sqlitePath, { readonly: true });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const book = url.searchParams.get("book");
    const chapter = url.searchParams.get("chapter");
    const verse = url.searchParams.get("verse");

    const db = openDb();

    if (db) {
      // No params: return list of books
      if (!book) {
        const rows = db.prepare(`SELECT DISTINCT book FROM verses`).all() as { book: string }[];
        const rawBooks = rows.map((r) => r.book);
        // Use canonical order from JSON file to sort server-side
        const canonical = Object.keys(loadBible());
        const books = rawBooks.sort((a, b) => {
          const ia = canonical.indexOf(a);
          const ib = canonical.indexOf(b);
          if (ia === -1 && ib === -1) return a.localeCompare(b);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        return NextResponse.json({ books });
      }

      // Only book provided: return chapters
      if (book && !chapter) {
        const rows = db
          .prepare(`SELECT DISTINCT chapter FROM verses WHERE book = ? ORDER BY chapter`)
          .all(book) as { chapter: number }[];
        const chapters = rows.map((r) => r.chapter);
        return NextResponse.json({ book, chapters });
      }

      // Book + chapter, no verse: return verses for chapter
      if (book && chapter && !verse) {
        const chapNum = Number(chapter);
        const versesRows = db
          .prepare(`SELECT verse, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse`)
          .all(book, chapNum) as { verse: number; text: string }[];
        const notesRow = db
          .prepare(`SELECT notes FROM notes WHERE book = ? AND chapter = ? LIMIT 1`)
          .get(book, chapNum) as { notes: string } | undefined;
        const verses = versesRows.map((r) => r.verse);
        const content = versesRows.map((r) => ({ verse: r.verse, text: r.text }));
        const notes = notesRow?.notes ?? null;
        return NextResponse.json({ book, chapter: chapNum, verses, content, notes });
      }

      // Book + chapter + verse: return the specific verse
      if (book && chapter && verse) {
        const vNum = Number(verse);
        const one = db
          .prepare(`SELECT text FROM verses WHERE book = ? AND chapter = ? AND verse = ? LIMIT 1`)
          .get(book, Number(chapter), vNum) as { text?: string } | undefined;
        if (!one?.text) {
          return NextResponse.json(
            { error: `Versículo não encontrado: ${verse}` },
            { status: 404 }
          );
        }
        return NextResponse.json({ book, chapter: Number(chapter), verse: vNum, text: one.text });
      }
    }

    // Fallback to JSON
    const bible = loadBible();

    // No params: return list of books
    if (!book) {
      const books = Object.keys(bible);
      return NextResponse.json({ books });
    }

    const bookData = bible[book];
    if (!bookData) {
      return NextResponse.json(
        { error: `Livro não encontrado: ${book}` },
        { status: 404 }
      );
    }

    // Only book provided: return chapters
    if (book && !chapter) {
      const chapters = Object.keys(bookData)
        .map((n) => Number(n))
        .sort((a, b) => a - b);
      return NextResponse.json({ book, chapters });
    }

    const chapterData = bookData[chapter!];
    if (!chapterData) {
      return NextResponse.json(
        { error: `Capítulo não encontrado: ${chapter}` },
        { status: 404 }
      );
    }

    // Book + chapter, no verse: return verses for chapter
    if (book && chapter && !verse) {
      const verses = Object.keys(chapterData.versos || {})
        .map((n) => Number(n))
        .sort((a, b) => a - b);
      const content = verses.map((v) => ({ verse: v, text: chapterData.versos[String(v)] }));
      const notes = chapterData.notas ?? null;
      return NextResponse.json({ book, chapter: Number(chapter), verses, content, notes });
    }

    // Book + chapter + verse: return the specific verse
    const text = chapterData.versos?.[verse!];
    if (!text) {
      return NextResponse.json(
        { error: `Versículo não encontrado: ${verse}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ book, chapter: Number(chapter), verse: Number(verse), text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao carregar a Bíblia" }, { status: 500 });
  }
}
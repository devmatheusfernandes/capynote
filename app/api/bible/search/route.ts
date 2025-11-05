import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

export const runtime = "nodejs";

function openDb() {
  const sqlitePath = path.join(process.cwd(), "bible", "db", "nwt-pt.sqlite");
  if (!fs.existsSync(sqlitePath)) return null;
  return new Database(sqlitePath, { readonly: true });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: "Parâmetro 'q' é obrigatório" }, { status: 400 });
    }

    const db = openDb();
    if (!db) {
      return NextResponse.json({ error: "Banco SQLite não encontrado" }, { status: 500 });
    }

    const stmt = db.prepare(
      `SELECT book, chapter, verse, text
       FROM verses
       WHERE text LIKE ?
       ORDER BY book, chapter, verse
       LIMIT 50`
    );
    const results = stmt.all(`%${q}%`) as Array<{
      book: string;
      chapter: number;
      verse: number;
      text: string;
    }>;

    return NextResponse.json({ q, results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha na busca" }, { status: 500 });
  }
}
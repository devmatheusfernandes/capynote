// Normaliza abreviações comuns para o nome canônico do livro
export const BOOK_ABBREVIATIONS: Record<string, string> = {
  // Antigo Testamento
  gn: "Gênesis",
  gên: "Gênesis",
  êx: "Êxodo",
  ex: "Êxodo",
  lv: "Levítico",
  nm: "Números",
  dt: "Deuteronômio",
  js: "Josué",
  jz: "Juízes",
  rt: "Rute",
  // variações
  esd: "Esdras",
  "1 sm": "1 Samuel",
  "2 sm": "2 Samuel",
  "1 rs": "1 Reis",
  "2 rs": "2 Reis",
  "1 cr": "1 Crônicas",
  "2 cr": "2 Crônicas",
  ed: "Esdras",
  ne: "Neemias",
  est: "Ester",
  jó: "Jó",
  sl: "Salmo",
  sal: "Salmo",
  pv: "Provérbios",
  pr: "Provérbios",
  ec: "Eclesiastes",
  ct: "Cântico de Salomão",
  is: "Isaías",
  je: "Jeremias",
  jr: "Jeremias",
  lm: "Lamentações",
  ez: "Ezequiel",
  dn: "Daniel",
  os: "Oseias",
  jl: "Joel",
  am: "Amós",
  jn: "Jonas",
  mq: "Miqueias",
  na: "Naum",
  hc: "Habacuque",
  sf: "Sofonias",
  sof: "Sofonias",
  ag: "Ageu",
  zc: "Zacarias",
  ml: "Malaquias",
  // Novo Testamento
  mt: "Mateus",
  mat: "Mateus",
  mateus: "Mateus",
  mc: "Marcos",
  mr: "Marcos",
  mar: "Marcos",
  "mar.": "Marcos",
  marcos: "Marcos",
  lc: "Lucas",
  lucas: "Lucas",
  lu: "Lucas",
  jo: "João",
  joão: "João",
  at: "Atos",
  atos: "Atos",
  rm: "Romanos",
  romanos: "Romanos",
  "1 co": "1 Coríntios",
  "2 co": "2 Coríntios",
  "1co": "1 Coríntios",
  "2co": "2 Coríntios",
  gl: "Gálatas",
  ef: "Efésios",
  fp: "Filipenses",
  cl: "Colossenses",
  col: "Colossenses",
  "1 ts": "1 Tessalonicenses",
  "2 ts": "2 Tessalonicenses",
  "1 tm": "1 Timóteo",
  "2 tm": "2 Timóteo",
  "1ti": "1 Timóteo",
  "2ti": "2 Timóteo",
  tt: "Tito",
  hb: "Hebreus",
  he: "Hebreus",
  tg: "Tiago",
  "1 pe": "1 Pedro",
  "2 pe": "2 Pedro",
  "1 jo": "1 João",
  "2 jo": "2 João",
  "3 jo": "3 João",
  ap: "Apocalipse",
};

// Abreviações personalizadas injetadas em tempo de execução (por usuário)
let CUSTOM_ABBREVIATIONS: Record<string, string> = {};

export function setCustomAbbreviations(map: Record<string, string>) {
  CUSTOM_ABBREVIATIONS = { ...map };
}

export function normalizeBookToken(raw: string): string | null {
  const token = raw.trim().toLowerCase().replace(/\.$/, "");
  // permitir formatos como "1Jo", "1 Jo"
  const m = token.match(/^(\d)\s*([a-zçáéíóúâêôãõü]+)$/i);
  if (m) {
    const key = `${m[1]} ${m[2]}`.toLowerCase();
    return CUSTOM_ABBREVIATIONS[key] ?? BOOK_ABBREVIATIONS[key] ?? null;
  }
  return CUSTOM_ABBREVIATIONS[token] ?? BOOK_ABBREVIATIONS[token] ?? null;
}
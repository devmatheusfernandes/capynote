import { auth, db, googleProvider } from "./firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup, linkWithPopup } from "firebase/auth";
import { buildBackupPayload } from "./export-utils";
import { NoteData, FolderData, TagData } from "@/types";

type BackupResult = {
  success: boolean;
  lastBackupAt?: string;
  error?: string;
};

// Cache simples de token do Drive no localStorage para reduzir popups
function getCachedDriveToken(): string | null {
  try {
    const raw = localStorage.getItem("driveAccessToken");
    const exp = Number(localStorage.getItem("driveAccessTokenExpiresAt") || 0);
    if (!raw || !exp) return null;
    const now = Date.now();
    if (now < exp - 30_000) {
      // margem de 30s para evitar expiração durante requisições
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedDriveToken(token: string, ttlMs = 55 * 60 * 1000) {
  try {
    localStorage.setItem("driveAccessToken", token);
    localStorage.setItem(
      "driveAccessTokenExpiresAt",
      String(Date.now() + Math.max(60_000, ttlMs))
    );
  } catch {
    // ignore
  }
}

async function getDriveAccessToken(force = false): Promise<string> {
  if (!force) {
    const cached = getCachedDriveToken();
    if (cached) return cached;
  }

  let result;
  const current = auth.currentUser;
  if (current) {
    // Se o usuário não tem Google vinculado, tente vincular para obter o token
    const hasGoogle = current.providerData?.some((p) => p.providerId === "google.com");
    try {
      result = hasGoogle
        ? await reauthenticateWithPopup(current, googleProvider)
        : await linkWithPopup(current, googleProvider);
    } catch (err: unknown) {
      // Fallback: se vincular falhar por conta já vinculada ou conflito, reautentica
      const code = (err as unknown as { code?: string })?.code || "";
      if (
        code === "auth/provider-already-linked" ||
        code === "auth/credential-already-in-use" ||
        code === "auth/account-exists-with-different-credential"
      ) {
        result = await reauthenticateWithPopup(current, googleProvider);
      } else {
        throw err;
      }
    }
  } else {
    // Não autenticado: abre popup do Google com escopo do Drive
    result = await signInWithPopup(auth, googleProvider);
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new Error(
      "Falha ao obter token do Google Drive. Permita popups e aceite o acesso ao Drive."
    );
  }
  // Assumimos validade ~55min e cacheamos para reduzir prompts
  setCachedDriveToken(accessToken);
  return accessToken;
}

async function fetchUserDataForBackup(userId: string): Promise<{
  notes: NoteData[];
  folders: FolderData[];
  tags: TagData[];
}> {
  const [notesSnap, foldersSnap, tagsSnap] = await Promise.all([
    getDocs(collection(db, "users", userId, "notes")),
    getDocs(collection(db, "users", userId, "folders")),
    getDocs(collection(db, "users", userId, "tags")),
  ]);

  const notes = notesSnap.docs.map((d) => d.data() as NoteData);
  const folders = foldersSnap.docs.map((d) => d.data() as FolderData);
  const tags = tagsSnap.docs.map((d) => {
    const t = d.data() as TagData;
    return {
      id: d.id,
      name: t.name || d.id,
      createdAt: String(t.createdAt || new Date().toISOString()),
      updatedAt: t.updatedAt,
      color: t.color,
    } as TagData;
  });
  return { notes, folders, tags };
}

async function ensureBackupFolder(token: string): Promise<string> {
  // Look for app-created folder named "CapyNotes Backups"
  const searchUrl =
    "https://www.googleapis.com/drive/v3/files?q=" +
    encodeURIComponent(
      "name = 'CapyNotes Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    ) +
    "&fields=files(id,name)&spaces=drive";

  const searchResp = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!searchResp.ok) {
    // If listing fails (e.g., scope restrictions), proceed to create folder
  } else {
    const data = await searchResp.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id as string;
    }
  }

  // Create folder
  const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "CapyNotes Backups",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createResp.ok) {
    const text = await createResp.text();
    throw new Error("Falha ao criar pasta no Drive: " + text);
  }
  const created = await createResp.json();
  return created.id as string;
}

async function uploadBackupFile(
  token: string,
  folderId: string,
  filename: string,
  content: string
): Promise<void> {
  const boundary =
    "capynotes_backup_boundary_" + Math.random().toString(36).slice(2);
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/json",
  };

  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    "\r\n" +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    content +
    "\r\n" +
    `--${boundary}--`;

  const resp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    let hint = "";
    try {
      const j = JSON.parse(text);
      const msg = j?.error?.message || j?.error?.status || "";
      if (
        typeof msg === "string" &&
        (msg.includes("not been used in project") || msg.includes("disabled"))
      ) {
        hint =
          " — Verifique se a Google Drive API está ativada no projeto do Firebase/Google Cloud.";
      }
    } catch {}
    throw new Error("Falha ao subir backup no Drive: " + text + hint);
  }
}

export async function driveBackupNow(userId: string): Promise<BackupResult> {
  try {
    let token = await getDriveAccessToken();
    const { notes, folders, tags } = await fetchUserDataForBackup(userId);
    const payload = buildBackupPayload(notes, folders, tags);
    const json = JSON.stringify(payload, null, 2);

    let folderId: string;
    try {
      folderId = await ensureBackupFolder(token);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      // Se token inválido/expirado, renova e tenta novamente uma vez
      if (/401|invalid|expired|credentials/i.test(msg)) {
        token = await getDriveAccessToken(true);
        folderId = await ensureBackupFolder(token);
      } else {
        throw err;
      }
    }

    const filename = `capynotes-backup-${new Date()
      .toISOString()
      .replace(/[:\.]/g, "-")}.json`;
    try {
      await uploadBackupFile(token, folderId, filename, json);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      if (/401|invalid|expired|credentials/i.test(msg)) {
        token = await getDriveAccessToken(true);
        await uploadBackupFile(token, folderId, filename, json);
      } else {
        throw err;
      }
    }

    const lastBackupAt = new Date().toISOString();
    const settingsRef = doc(db, "users", userId, "meta", "settings");
    await setDoc(settingsRef, { lastBackupAt }, { merge: true });
    return { success: true, lastBackupAt };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error)?.message || String(error),
    };
  }
}

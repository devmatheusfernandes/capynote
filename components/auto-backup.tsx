"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { driveBackupNow } from "@/lib/drive-backup";

type Settings = {
  autoBackupEnabled?: boolean;
  lastBackupAt?: string;
  backupIntervalHours?: number;
  backupPreferredTime?: string; // HH:mm
};

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30min
const PREFERRED_TIME_WINDOW_MIN = 30; // janela para horário preferido

export default function AutoBackup() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({});
  const checkingRef = useRef<number | null>(null);
  const backingUpRef = useRef<boolean>(false);

  // Subscribe to settings
  useEffect(() => {
    if (!user?.id) return;
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    const unsub = onSnapshot(settingsRef, (snap) => {
      const data = snap.data() as Settings | undefined;
      setSettings(data || {});
    });
    return () => unsub();
  }, [user?.id]);

  const maybeRunBackup = async () => {
    if (!user?.id) return;
    if (!settings.autoBackupEnabled) return;
    if (backingUpRef.current) return;

    try {
      const last = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0;
      const now = Date.now();
      const intervalMs = Math.max(1, Number(settings.backupIntervalHours || (DEFAULT_INTERVAL_MS / 3600000))) * 3600000;
      const due = now - last > intervalMs || last === 0;
      if (!due) return;

      // Se há horário preferido, só executa próximo dessa janela
      if (settings.backupPreferredTime) {
        const [hhStr, mmStr] = settings.backupPreferredTime.split(":");
        const hh = Number(hhStr);
        const mm = Number(mmStr);
        if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
          const nowDate = new Date();
          const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
          const prefMin = hh * 60 + mm;
          const diff = Math.abs(nowMin - prefMin);
          const wrapDiff = Math.min(diff, 1440 - diff);
          const inWindow = wrapDiff <= PREFERRED_TIME_WINDOW_MIN;
          if (!inWindow) return;
        }
      }
      backingUpRef.current = true;
      await driveBackupNow(user.id);
    } catch (error) {
      // Silent failure; will retry later
      console.log(error);
    } finally {
      backingUpRef.current = false;
    }
  };

  // Check immediately on settings change and then periodically
  useEffect(() => {
    maybeRunBackup();
    if (checkingRef.current) {
      clearInterval(checkingRef.current);
    }
    checkingRef.current = window.setInterval(maybeRunBackup, CHECK_INTERVAL_MS);
    return () => {
      if (checkingRef.current) clearInterval(checkingRef.current);
      checkingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoBackupEnabled, settings.lastBackupAt, settings.backupIntervalHours, settings.backupPreferredTime, user?.id]);

  // Trigger on reconnect
  useEffect(() => {
    const onOnline = () => maybeRunBackup();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoBackupEnabled, settings.lastBackupAt, settings.backupIntervalHours, settings.backupPreferredTime, user?.id]);

  return null;
}
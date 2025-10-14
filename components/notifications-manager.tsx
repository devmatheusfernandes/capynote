"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

interface TaskData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em-progresso" | "concluida";
  dueDate?: string;
  dueTime?: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotificationsManager() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<{
    defaultTaskTime?: string;
    notificationsEnabled?: boolean;
  }>({});
  const timersRef = useRef<Map<string, number>>(new Map());

  // Subscribe to settings
  useEffect(() => {
    if (!user?.id) return;
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    const unsub = onSnapshot(settingsRef, (snap) => {
      const data = snap.data() as
        | { defaultTaskTime?: string; notificationsEnabled?: boolean }
        | undefined;
      setSettings(data || {});
    });
    return () => unsub();
  }, [user?.id]);

  // Subscribe to tasks and schedule notifications
  useEffect(() => {
    if (!user?.id) return;

    const tasksRef = collection(db, "users", user.id, "tasks");
    const unsub = onSnapshot(tasksRef, async (snapshot) => {
      const tasks: TaskData[] = snapshot.docs.map((d) => {
        const data = d.data() as TaskData;
        return {
          id: data.id || d.id,
          title: data.title || "",
          description: data.description || "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          priority: data.priority || "media",
          status: data.status || "pendente",
          dueDate: data.dueDate || undefined,
          dueTime: data.dueTime || undefined,
          createdAt:
            typeof data.createdAt === "string"
              ? data.createdAt
              : new Date().toISOString(),
          updatedAt:
            typeof data.updatedAt === "string"
              ? data.updatedAt
              : new Date().toISOString(),
        };
      });

      // Clear any timers for tasks no longer present or when disabled
      if (!settings.notificationsEnabled) {
        timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        timersRef.current.clear();
        return;
      }

      // Request permission if needed
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        try {
          await Notification.requestPermission();
        } catch (error: unknown) {
          const message = error;
          console.log(message);
        }
      }
      if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      ) {
        // Can't schedule notifications without permission
        timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        timersRef.current.clear();
        return;
      }

      const defaultTime = settings.defaultTaskTime || "09:00";

      // Helper to compute due date
      const computeDueDateTime = (task: TaskData) => {
        if (!task.dueDate) return null;
        const [year, month, day] = task.dueDate.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        const timeStr = task.dueTime || defaultTime;
        if (timeStr) {
          const [hours, minutes] = timeStr.split(":").map(Number);
          date.setHours(hours, minutes, 0, 0);
        } else {
          // Default end of day
          date.setHours(23, 59, 59, 999);
        }
        return date;
      };

      const now = new Date();
      const existingTimers = timersRef.current;

      // Cancel timers for tasks not in snapshot
      const currentIds = new Set(tasks.map((t) => t.id));
      Array.from(existingTimers.keys()).forEach((key) => {
        if (!currentIds.has(key)) {
          const tid = existingTimers.get(key);
          if (tid) clearTimeout(tid);
          existingTimers.delete(key);
        }
      });

      for (const task of tasks) {
        if (task.status === "concluida") {
          // Cancel any existing timer
          const tid = existingTimers.get(task.id);
          if (tid) clearTimeout(tid);
          existingTimers.delete(task.id);
          continue;
        }

        const due = computeDueDateTime(task);
        if (!due) {
          // No due date; ensure no timer
          const tid = existingTimers.get(task.id);
          if (tid) clearTimeout(tid);
          existingTimers.delete(task.id);
          continue;
        }

        const delay = due.getTime() - now.getTime();
        if (delay <= 0) {
          // Past due; do not schedule
          const tid = existingTimers.get(task.id);
          if (tid) clearTimeout(tid);
          existingTimers.delete(task.id);
          continue;
        }

        // If already scheduled, skip
        if (existingTimers.has(task.id)) continue;

        const timeoutId = window.setTimeout(async () => {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            const title = `Tarefa: ${task.title || "Sem título"}`;
            const bodyTime = task.dueTime || defaultTime;
            const body = task.dueDate
              ? `Agendada para ${new Date(due).toLocaleDateString(
                  "pt-BR"
                )} às ${bodyTime}`
              : `Lembrete de tarefa`;
            const options: NotificationOptions = {
              body,
              tag: `task-${task.id}`,
              data: { url: "/dashboard/tarefas" },
              requireInteraction: false,
              icon: "/adaptive-icon.png",
            };
            if (reg) {
              reg.showNotification(title, options);
            } else if (typeof Notification !== "undefined") {
              new Notification(title, options);
            }
          } catch (error: unknown) {
            const message = error;
            console.log(message);
          } finally {
            // Remove timer once triggered
            const tid = timersRef.current.get(task.id);
            if (tid) clearTimeout(tid);
            timersRef.current.delete(task.id);
          }
        }, delay);

        existingTimers.set(task.id, timeoutId);
      }
    });

    // Capture the ref's current value for use in cleanup
    const timers = timersRef.current;

    return () => {
      unsub();
      timers.forEach((tid) => clearTimeout(tid));
      timers.clear();
    };
  }, [user?.id, settings.notificationsEnabled, settings.defaultTaskTime]);

  return null;
}

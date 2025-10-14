"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, CheckSquare, User } from "lucide-react";
import { DesktopCreateButton } from "@/components/create-button";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { NoteData, FolderData } from "@/types";

// Tipo local para tarefas, alinhado com a página de Tarefas
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
  isRecurring?: boolean;
  recurringType?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  recurringInterval?: number;
  recurringDays?: string[];
  recurringEndDate?: string;
  recurringEndCount?: number;
  excludedDates?: string[];
}

function formatRelativeTime(isoDate?: string) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const isSameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isSameDay) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `Há ${diffHours} horas`;
  }
  if (isYesterday) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseTaskDueDate(task: TaskData): Date | null {
  if (!task.dueDate) return null;
  try {
    if (task.dueTime) {
      // Combinar data e hora no formato ISO local (YYYY-MM-DDTHH:MM)
      return new Date(`${task.dueDate}T${task.dueTime}`);
    }
    return new Date(task.dueDate);
  } catch {
    return null;
  }
}

function getTaskDueLabel(due: Date | null): {
  text: string;
  className: string;
} {
  if (!due) return { text: "Sem prazo", className: "text-muted-foreground" };
  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow);
  startOfTomorrow.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(tomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  if (due < startOfToday) {
    return { text: "Vencida", className: "text-red-600 dark:text-red-400" };
  }
  if (due >= startOfToday && due <= endOfToday) {
    return { text: "Vence hoje", className: "text-red-600 dark:text-red-400" };
  }
  if (due >= startOfTomorrow && due <= endOfTomorrow) {
    return {
      text: "Vence amanhã",
      className: "text-orange-600 dark:text-orange-400",
    };
  }
  return { text: "Próximo prazo", className: "text-muted-foreground" };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [notes, setNotes] = useState<NoteData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);

  // Assinar notas do usuário
  useEffect(() => {
    if (!user?.id) return;
    const notesRef = collection(db, "users", user.id, "notes");
    const unsub = onSnapshot(notesRef, (snapshot) => {
      const fetched: NoteData[] = snapshot.docs.map(
        (d) => d.data() as NoteData
      );
      const sorted = fetched.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setNotes(sorted);
    });
    return () => unsub();
  }, [user?.id]);

  // Assinar pastas do usuário
  useEffect(() => {
    if (!user?.id) return;
    const foldersRef = collection(db, "users", user.id, "folders");
    const unsub = onSnapshot(foldersRef, (snapshot) => {
      const fetched: FolderData[] = snapshot.docs.map(
        (d) => d.data() as FolderData
      );
      setFolders(fetched);
    });
    return () => unsub();
  }, [user?.id]);

  // Assinar tarefas do usuário
  useEffect(() => {
    if (!user?.id) return;
    const tasksRef = collection(db, "users", user.id, "tasks");
    const unsub = onSnapshot(tasksRef, (snapshot) => {
      const fetched: TaskData[] = snapshot.docs.map((d) => {
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
          isRecurring: data.isRecurring,
          recurringType: data.recurringType,
          recurringInterval: data.recurringInterval,
          recurringDays: data.recurringDays,
          recurringEndDate: data.recurringEndDate,
          recurringEndCount: data.recurringEndCount,
          excludedDates: Array.isArray(data.excludedDates)
            ? data.excludedDates
            : [],
        };
      });
      const sorted = fetched.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setTasks(sorted);
    });
    return () => unsub();
  }, [user?.id]);

  const totalNotes = notes.length;
  const pendingTasksCount = useMemo(
    () => tasks.filter((t) => t.status === "pendente").length,
    [tasks]
  );
  const dueTodayCount = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === "concluida") return false;
      const due = parseTaskDueDate(t);
      if (!due) return false;
      const today = new Date();
      return due.toDateString() === today.toDateString();
    }).length;
  }, [tasks]);

  const recentNotes = useMemo(() => notes.slice(0, 2), [notes]);
  const urgentTasks = useMemo(() => {
    const notDone = tasks.filter((t) => t.status !== "concluida");
    const withDue = notDone
      .map((t) => ({ t, due: parseTaskDueDate(t) }))
      .filter(({ due }) => !!due) as { t: TaskData; due: Date }[];
    const sortedByDue = withDue.sort(
      (a, b) => a.due.getTime() - b.due.getTime()
    );
    // Priorizar hoje/amanhã e vencidas
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    const near = sortedByDue.filter(({ due }) => due <= endOfTomorrow);
    return near.slice(0, 2).map(({ t }) => t);
  }, [tasks]);

  return (
    <div className="container mx-auto p-6 sm:max-w-[80vw] max-w-[100vw]">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description={`Bem-vindo de volta, ${user?.name}!`}
        otherButton={
          <div className="hidden md:block mb-8">
            <DesktopCreateButton />
          </div>
        }
      />
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Notas
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNotes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de pastas {folders.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tarefas Pendentes
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasksCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dueTodayCount} vencendo hoje
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perfil</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{user?.email}</div>
            <p className="text-xs text-muted-foreground">Membro desde hoje</p>
          </CardContent>
        </Card>
      </div>
      {/* Quick Actions */}{" "}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Notas Recentes
            </CardTitle>
            <CardDescription>Suas últimas anotações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentNotes.length === 0 ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-muted-foreground">
                  Nenhuma nota recente
                </div>
              ) : (
                recentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {note.title || "Nota sem título"}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {formatRelativeTime(note.updatedAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => router.push("/dashboard/notas")}
            >
              Ver todas as notas
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-orange-600" />
              Tarefas Urgentes
            </CardTitle>
            <CardDescription>Itens que precisam de atenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {urgentTasks.length === 0 ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-muted-foreground">
                  Nenhuma tarefa urgente
                </div>
              ) : (
                urgentTasks.map((task) => {
                  const due = parseTaskDueDate(task);
                  const { text, className } = getTaskDueLabel(due);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{task.title || "Tarefa"}</p>
                        <p className={`text-sm ${className}`}>{text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => router.push("/dashboard/tarefas")}
            >
              Ver todas as tarefas
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

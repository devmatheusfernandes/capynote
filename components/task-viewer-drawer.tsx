"use client";

import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Edit, Trash2, Repeat } from "lucide-react";

interface Subtask {
  id: string;
  title: string;
  status: "pendente" | "concluida";
  createdAt: string;
  updatedAt: string;
}

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
  subtasks?: Subtask[];
}

interface TaskViewerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskData | null;
  onEdit?: (task: TaskData) => void;
  onDelete?: (task: TaskData) => void;
  onToggleComplete?: (task: TaskData, checked: boolean) => void;
  onToggleSubtask?: (
    taskId: string,
    subtaskId: string,
    checked: boolean
  ) => void;
}

const formatTaskDueDate = (dueDate: string, dueTime?: string) => {
  const [year, month, day] = dueDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return dueTime ? `Hoje às ${dueTime}` : "Hoje";
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return dueTime ? `Amanhã às ${dueTime}` : "Amanhã";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return dueTime ? `Ontem às ${dueTime}` : "Ontem";
  }

  const diffInDays = Math.floor(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (Math.abs(diffInDays) <= 7) {
    const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
    const capitalizedWeekday =
      weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return dueTime ? `${capitalizedWeekday} às ${dueTime}` : capitalizedWeekday;
  }
  const formattedDate = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
  return dueTime ? `${formattedDate} às ${dueTime}` : formattedDate;
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "alta":
      return "bg-red-100 text-red-800 border-red-200";
    case "media":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "baixa":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "concluida":
      return "bg-green-100 text-green-800 border-green-200";
    case "em-progresso":
      return "bg-blue-100 text-primary border-blue-200";
    case "pendente":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const isOverdue = (dueDate?: string, dueTime?: string) => {
  if (!dueDate) return false;
  const [year, month, day] = dueDate.split("-").map(Number);
  const taskDate = new Date(year, month - 1, day);
  const now = new Date();
  if (dueTime) {
    const [hours, minutes] = dueTime.split(":").map(Number);
    taskDate.setHours(hours, minutes, 0, 0);
  } else {
    taskDate.setHours(23, 59, 59, 999);
  }
  return taskDate < now;
};

export function TaskViewerDrawer({
  open,
  onOpenChange,
  task,
  onEdit,
  onDelete,
  onToggleComplete,
  onToggleSubtask,
}: TaskViewerDrawerProps) {
  const isRecurringOccurrence = task?.id
    ? task.id.includes("_occurrence_")
    : false;

  const [localTask, setLocalTask] = React.useState<TaskData | null>(task ?? null);
  React.useEffect(() => {
    setLocalTask(task ?? null);
  }, [task]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[75vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-left">Tarefa</DrawerTitle>
            <div className="flex items-center gap-2">
              {task && onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(task)}
                  className="h-8 w-8 p-0"
                  aria-label="Editar"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {task && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(task)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 flex flex-col p-4 pb-12 overflow-auto">
          {!task ? (
            <div className="text-center text-sm text-muted-foreground">
              Nenhuma tarefa selecionada.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-row items-center gap-2">
                    <Checkbox
                      checked={localTask?.status === "concluida"}
                      onCheckedChange={(checked) => {
                        if (onToggleComplete && task) {
                          onToggleComplete(task, Boolean(checked));
                        }
                        // Atualização otimista imediata no Drawer
                        setLocalTask((prev) =>
                          prev
                            ? {
                                ...prev,
                                status: Boolean(checked) ? "concluida" : "pendente",
                                updatedAt: new Date().toISOString(),
                              }
                            : prev
                        );
                      }}
                      aria-label="Concluir tarefa"
                    />
                    <h2 className="text-md font-semibold">
                      {task.title || "(Sem título)"}
                    </h2>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {task.dueDate && (
                  <Badge
                    variant="outline"
                    className={
                      isOverdue(task.dueDate, task.dueTime)
                        ? "border-red-500 text-red-600"
                        : ""
                    }
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {formatTaskDueDate(task.dueDate, task.dueTime)}
                  </Badge>
                )}
                {isRecurringOccurrence && (
                  <Badge
                    variant="secondary"
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    <Repeat className="h-3 w-3" />
                    Ocorrência:{" "}
                    {new Date(task.dueDate!).toLocaleDateString("pt-BR")}
                  </Badge>
                )}
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Subtarefas
                  </div>
                  <div className="space-y-2">
                    {(localTask?.subtasks ?? task.subtasks).map((st) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={st.status === "concluida"}
                          onCheckedChange={(checked) => {
                            if (onToggleSubtask && !isRecurringOccurrence) {
                              onToggleSubtask(task.id, st.id, Boolean(checked));
                            }
                            // Atualização otimista imediata da subtarefa
                            setLocalTask((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    subtasks: (prev.subtasks || []).map((s) =>
                                      s.id === st.id
                                        ? {
                                            ...s,
                                            status: Boolean(checked)
                                              ? "concluida"
                                              : "pendente",
                                            updatedAt: new Date().toISOString(),
                                          }
                                        : s
                                    ),
                                    updatedAt: new Date().toISOString(),
                                  }
                                : prev
                            );
                          }}
                          disabled={isRecurringOccurrence}
                          className="flex-shrink-0"
                        />
                        <span
                          className={`text-sm ${
                            st.status === "concluida"
                              ? "line-through text-primary"
                              : "text-text"
                          }`}
                        >
                          {st.title || "Subtarefa"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 pt-4">
                <Badge
                  variant="outline"
                  className={getStatusColor(localTask?.status ?? task.status)}
                >
                  {(localTask?.status ?? task.status) === "em-progresso"
                    ? "Em Progresso"
                    : (localTask?.status ?? task.status) === "concluida"
                    ? "Concluída"
                    : "Pendente"}
                </Badge>
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

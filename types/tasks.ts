export interface Subtask {
  id: string;
  title: string;
  status: "pendente" | "concluida";
  createdAt: string;
  updatedAt: string;
}

export interface TaskData {
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
  // Campos de repetição
  isRecurring?: boolean;
  recurringType?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  recurringInterval?: number; // Para intervalos customizados (ex: a cada 2 dias)
  recurringDays?: string[]; // Para repetições semanais (ex: ["monday", "wednesday", "friday"])
  recurringEndDate?: string; // Data final da repetição
  recurringEndCount?: number; // Número de ocorrências
  excludedDates?: string[]; // Datas excluídas da repetição
  subtasks?: Subtask[];
}

export type ViewType = "list" | "kanban" | "calendar";

export interface TasksMeta {
  completedOccurrences?: string[];
}

export interface RecurringTaskToDelete extends TaskData {
  isOccurrence?: boolean;
}

export type TaskPriority = TaskData["priority"];
export type TaskStatus = TaskData["status"];
export type RecurringType = NonNullable<TaskData["recurringType"]>;
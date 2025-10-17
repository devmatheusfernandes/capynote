import React from "react";
import { TaskCard } from "./task-card";
import { TaskData } from "@/types/tasks";

interface TaskListProps {
  tasks: TaskData[];
  taskPendingById?: Record<string, boolean>;
  onToggleStatus?: (taskId: string, newStatus: TaskData["status"]) => void;
  onEdit?: (task: TaskData) => void;
  onView?: (task: TaskData) => void;
  onDelete?: (taskId: string) => void;
  // Additional props for compatibility with page.tsx
  onTaskEdit?: (task: TaskData) => void;
  onTaskView?: (task: TaskData) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskStatusChange?: (taskId: string, status: TaskData["status"]) => void;
  onTaskToggleComplete?: (task: TaskData, checked: boolean) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, checked: boolean) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  taskPendingById = {},
  onToggleStatus,
  onEdit,
  onView,
  onDelete,
  // Additional props for compatibility
  onTaskEdit,
  onTaskView,
  onTaskDelete,
  onTaskStatusChange,
  onTaskToggleComplete,
  onSubtaskToggle,
}) => {
  // Map props to ensure compatibility
  const handleEdit = onEdit || onTaskEdit || (() => {});
  const handleView = onView || onTaskView || (() => {});
  const handleDelete = onDelete || onTaskDelete || (() => {});
  const handleToggleStatus = onToggleStatus || onTaskStatusChange || (() => {});
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isPending={taskPendingById[task.id]}
          onToggleStatus={handleToggleStatus}
          onEdit={handleEdit}
          onView={handleView}
          onDelete={handleDelete}
          onToggleComplete={onTaskToggleComplete}
          onSubtaskToggle={onSubtaskToggle}
        />
      ))}
    </div>
  );
};
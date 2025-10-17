"use client";

import { Badge } from "@/components/ui/badge";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskData } from "@/types/tasks";
import { SortableTaskCard } from "./sortable-task-card";

interface DroppableAreaProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

function DroppableArea({ id, className, children }: DroppableAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const style = {
    backgroundColor: isOver ? "rgba(59, 130, 246, 0.1)" : undefined,
    border: isOver ? "2px dashed rgba(59, 130, 246, 0.5)" : "2px dashed transparent",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  };

  return (
    <div ref={setNodeRef} className={className} style={style}>
      {children}
    </div>
  );
}

interface KanbanViewProps {
  tasks: TaskData[];
  onTaskEdit: (task: TaskData) => void;
  onTaskView: (task: TaskData) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskData["status"]) => void;
  onTaskToggleComplete: (task: TaskData, checked: boolean) => void;
  onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
}

export function KanbanView({
  tasks,
  onTaskEdit,
  onTaskView,
  onTaskDelete,
  onTaskStatusChange,
  onTaskToggleComplete,
  onSubtaskToggle,
}: KanbanViewProps) {
  const statusColumns = [
    { id: "pendente", label: "Pendente" },
    { id: "em-progresso", label: "Em Progresso" },
    { id: "concluida", label: "Concluída" },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {statusColumns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);

        return (
          <div key={column.id} className="space-y-4 pt-2 px-2 rounded-md">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg capitalize">
                {column.label}
              </h3>
              <Badge variant="secondary">{columnTasks.length}</Badge>
            </div>

            <DroppableArea
              id={column.id}
              className="min-h-[200px] space-y-3"
            >
              <SortableContext
                items={columnTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {columnTasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    onEdit={onTaskEdit}
                    onView={onTaskView}
                    onDelete={onTaskDelete}
                    onStatusChange={onTaskStatusChange}
                    onToggleComplete={onTaskToggleComplete}
                    onSubtaskToggle={onSubtaskToggle}
                    showMobileStatusArrows={true}
                  />
                ))}
              </SortableContext>
            </DroppableArea>
          </div>
        );
      })}
    </div>
  );
}
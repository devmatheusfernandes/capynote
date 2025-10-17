import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "./task-card";
import { TaskData } from "@/types/tasks";

interface SortableTaskCardProps {
  task: TaskData;
  isPending?: boolean;
  onToggleStatus?: (taskId: string, newStatus: TaskData["status"]) => void;
  onEdit: (task: TaskData) => void;
  onView: (task: TaskData) => void;
  onDelete: (taskId: string) => void;
  // Additional props for compatibility with parent components
  onStatusChange?: (taskId: string, status: TaskData["status"]) => void;
  onToggleComplete?: (task: TaskData, checked: boolean) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, checked: boolean) => void;
  // Calendar-specific props
  showCheckbox?: boolean;
  calendarDayIndex?: number;
  calendarMoveLeftEnabled?: boolean;
  calendarMoveRightEnabled?: boolean;
}

export const SortableTaskCard: React.FC<SortableTaskCardProps> = (props) => {
  const {
    onStatusChange,
    onToggleStatus,
    ...restProps
  } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Map onStatusChange to onToggleStatus for TaskCard compatibility
  const taskCardProps = {
    ...restProps,
    onToggleStatus: onToggleStatus || onStatusChange || (() => {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard {...taskCardProps} />
    </div>
  );
};
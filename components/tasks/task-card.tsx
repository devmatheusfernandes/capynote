import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  Trash2, 
  Edit, 
  Clock, 
  AlertCircle, 
  Repeat,
  CheckSquare 
} from "lucide-react";
import { TaskData } from "@/types/tasks";
import { 
  formatTaskDueDate, 
  getPriorityColor, 
  getStatusColor, 
  isOverdue, 
  truncateWords 
} from "@/lib/task-utils";
import SyncDot from "@/components/sync-dot";

interface TaskCardProps {
  task: TaskData;
  isPending?: boolean;
  onToggleStatus: (taskId: string, newStatus: TaskData["status"]) => void;
  onEdit: (task: TaskData) => void;
  onView: (task: TaskData) => void;
  onDelete: (taskId: string) => void;
  // Additional props for compatibility
  onToggleComplete?: (task: TaskData, checked: boolean) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, checked: boolean) => void;
  // Calendar-specific props
  showCheckbox?: boolean;
  calendarDayIndex?: number;
  calendarMoveLeftEnabled?: boolean;
  calendarMoveRightEnabled?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isPending = false,
  onToggleStatus,
  onEdit,
  onView,
  onDelete,
}) => {
  const handleStatusToggle = () => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    onToggleStatus(task.id, newStatus);
  };

  const overdue = isOverdue(task.dueDate, task.dueTime);

  return (
    <Card
      className={`group hover:shadow-md transition-all duration-200 cursor-pointer ${
        task.status === "concluida" ? "opacity-60" : ""
      } ${overdue && task.status !== "concluida" ? "border-red-200" : ""}`}
      onClick={() => onView(task)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Checkbox
              checked={task.status === "concluida"}
              onCheckedChange={handleStatusToggle}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className={`font-medium text-sm leading-tight ${
                    task.status === "concluida"
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {task.title}
                </h3>
                {task.isRecurring && (
                  <Repeat className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                {isPending && <SyncDot />}
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  {truncateWords(task.description, 15)}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0.5 ${getPriorityColor(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0.5 ${getStatusColor(
                    task.status
                  )}`}
                >
                  {task.status}
                </Badge>
                {task.tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              {task.dueDate && (
                <div
                  className={`flex items-center gap-1 text-xs ${
                    overdue && task.status !== "concluida"
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {overdue && task.status !== "concluida" ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  <span>{formatTaskDueDate(task.dueDate, task.dueTime)}</span>
                </div>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <CheckSquare className="h-3 w-3" />
                  <span>
                    {task.subtasks.filter((st) => st.status === "concluida").length}/
                    {task.subtasks.length} subtarefas
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
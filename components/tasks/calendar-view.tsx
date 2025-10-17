"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskData } from "@/types/tasks";
import { SortableTaskCard } from "./sortable-task-card";
import { generateRecurringOccurrences } from "@/lib/task-utils";

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
    border: isOver ? "2px dashed rgba(59, 130, 246, 0.5)" : "2px dashed rgba(229, 231, 235, 1)",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  };

  return (
    <div ref={setNodeRef} className={className} style={style}>
      {children}
    </div>
  );
}

interface CalendarViewProps {
  tasks: TaskData[];
  currentWeekStart: Date;
  visibleDayStart: number;
  isMobile: boolean;
  onTaskEdit: (task: TaskData) => void;
  onTaskView: (task: TaskData) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskData["status"]) => void;
  onTaskToggleComplete: (task: TaskData, checked: boolean) => void;
  onSubtaskToggle: (taskId: string, subtaskId: string, checked: boolean) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onGoToCurrentWeek: () => void;
  onVisibleDayChange: (direction: "prev" | "next") => void;
}

export function CalendarView({
  tasks,
  currentWeekStart,
  visibleDayStart,
  isMobile,
  onTaskEdit,
  onTaskView,
  onTaskDelete,
  onTaskStatusChange,
  onTaskToggleComplete,
  onSubtaskToggle,
  onPreviousWeek,
  onNextWeek,
  onGoToCurrentWeek,
  onVisibleDayChange,
}: CalendarViewProps) {
  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const handlePreviousClick = () => {
    if (isMobile) {
      if (visibleDayStart > 0) {
        onVisibleDayChange("prev");
      } else {
        onPreviousWeek();
      }
    } else {
      onPreviousWeek();
    }
  };

  const handleNextClick = () => {
    if (isMobile) {
      if (visibleDayStart < 4) {
        onVisibleDayChange("next");
      } else {
        onNextWeek();
      }
    } else {
      onNextWeek();
    }
  };

  return (
    <div className="space-y-1">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousClick}
          className=""
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center">
          <h3 className="font-semibold text-md">
            {currentWeekStart.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h3>
          <p className="text-xs text-gray-500">
            {currentWeekStart.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}{" "}
            -{" "}
            {(() => {
              const weekEnd = new Date(currentWeekStart);
              weekEnd.setDate(currentWeekStart.getDate() + 6);
              return weekEnd.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              });
            })()}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoToCurrentWeek}
            className="text-xs mt-1"
          >
            Ir para hoje
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNextClick}
          className="flex"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {(() => {
          const week = getWeekDays();
          const days = isMobile
            ? week.slice(visibleDayStart, visibleDayStart + 3)
            : week;
          return days.map((day, sliceIndex) => {
            const index = isMobile ? visibleDayStart + sliceIndex : sliceIndex;
            
            // Get regular tasks for this day
            const regularTasks = tasks.filter((task) => {
              // Exclude recurring tasks from regular display
              if (task.isRecurring) return false;

              if (task.dueDate) {
                return task.dueDate === day.toISOString().split("T")[0];
              } else {
                // If no due date, show in the day it was created
                const createdDate = new Date(task.createdAt)
                  .toISOString()
                  .split("T")[0];
                return createdDate === day.toISOString().split("T")[0];
              }
            });

            // Get recurring task occurrences for this day
            const recurringOccurrences: TaskData[] = [];
            const dayStart = new Date(day);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            tasks.forEach((task) => {
              if (task.isRecurring) {
                const occurrences = generateRecurringOccurrences(
                  task,
                  dayStart,
                  dayEnd
                );
                recurringOccurrences.push(...occurrences);
              }
            });

            // Combine regular tasks and recurring occurrences
            const dayTasks = [...regularTasks, ...recurringOccurrences];

            return (
              <div key={index} className="space-y-1">
                <div className="text-center">
                  <h3 className="font-semibold">
                    {day.toLocaleDateString("pt-BR", {
                      weekday: "short",
                    })}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {day.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                </div>

                <DroppableArea
                  id={`day-${index}`}
                  className="min-h-[300px] space-y-2 p-2"
                >
                  <SortableContext
                    items={dayTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {dayTasks.map((task) => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onEdit={onTaskEdit}
                        onView={onTaskView}
                        onDelete={onTaskDelete}
                        onStatusChange={onTaskStatusChange}
                        onToggleComplete={onTaskToggleComplete}
                        onSubtaskToggle={onSubtaskToggle}
                        showCheckbox={true}
                        calendarDayIndex={index}
                        calendarMoveLeftEnabled={
                          isMobile ? sliceIndex > 0 : false
                        }
                        calendarMoveRightEnabled={
                          isMobile ? sliceIndex < days.length - 1 : false
                        }
                      />
                    ))}
                  </SortableContext>
                </DroppableArea>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
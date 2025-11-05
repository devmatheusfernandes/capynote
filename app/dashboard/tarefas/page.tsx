"use client";

import { useState } from "react";
import { Plus, CheckSquare, Kanban, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { TaskDrawer } from "@/components/task-drawer";
import { TaskViewerDrawer } from "@/components/task-viewer-drawer";
import { PageHeader } from "@/components/page-header";
import { TagSelector } from "@/components/tag-selector";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { useIsMobile } from "@/hooks/use-mobile";
import { collection, doc, setDoc } from "firebase/firestore";

// Import types
import { TaskData, ViewType } from "@/types/tasks";

// Import hooks
import { useTasks } from "@/hooks/use-tasks";
import { useTaskFilters } from "@/hooks/use-tasks";
import { useTasksForView } from "@/hooks/use-tasks";
import { useCalendar } from "@/hooks/use-calendar";

// Import components
import { TaskList } from "@/components/tasks/task-list";
import { KanbanView } from "@/components/tasks/kanban-view";
import { CalendarView } from "@/components/tasks/calendar-view";
import { TaskCard } from "@/components/tasks/task-card";

export default function TarefasPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [taskViewerOpen, setTaskViewerOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<TaskData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>("list");
  const [draggedTask, setDraggedTask] = useState<TaskData | null>(null);

  // Custom hooks
  const {
    tasks,
    completedOccurrences,
    handleDeleteTask,
    updateTaskStatus,
    markTaskCompleted,
    markRecurringOccurrenceCompleted,
    unmarkRecurringOccurrenceCompleted,
    toggleSubtaskStatus,
  } = useTasks(user?.id);

  const filteredTasks = useTaskFilters(tasks, searchTerm, selectedTags);
  const tasksForCurrentView = useTasksForView(
    filteredTasks,
    currentView,
    completedOccurrences
  );

  const {
    currentWeekStart,
    setCurrentWeekStart,
    visibleDayStart,
    setVisibleDayStart,
  } = useCalendar(isMobile, currentView);

  // Calendar navigation functions
  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    setCurrentWeekStart(monday);
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Task handlers
  const handleTaskEdit = (task: TaskData) => {
    setEditingTask(task);
    setTaskDrawerOpen(true);
  };

  const handleTaskView = (task: TaskData) => {
    setViewingTask(task);
    setTaskViewerOpen(true);
  };

  const handleTaskDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      handleDeleteTask(taskToDelete);
      setTaskToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleTaskToggleComplete = (task: TaskData, checked: boolean) => {
    const isOccurrence = task.id.includes("_occurrence_");
    if (checked) {
      if (isOccurrence) {
        if (task.dueDate)
          markRecurringOccurrenceCompleted(task.id, task.dueDate);
      } else {
        markTaskCompleted(task.id);
      }
    } else {
      if (isOccurrence) {
        if (task.dueDate)
          unmarkRecurringOccurrenceCompleted(task.id, task.dueDate);
      } else {
        updateTaskStatus(task.id, "pendente");
      }
    }
  };

  // Calendar navigation handlers
  const handleVisibleDayChange = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (visibleDayStart > 0) {
        setVisibleDayStart((s) => s - 1);
      } else {
        goToPreviousWeek();
        setVisibleDayStart(4);
      }
    } else {
      if (visibleDayStart < 4) {
        setVisibleDayStart((s) => s + 1);
      } else {
        goToNextWeek();
        setVisibleDayStart(0);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setDraggedTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Handle status change in kanban view
    if (["pendente", "em-progresso", "concluida"].includes(overId)) {
      updateTaskStatus(taskId, overId as TaskData["status"]);
    }

    // Handle calendar day changes
    if (overId.startsWith("day-")) {
      const dayIndex = parseInt(overId.replace("day-", ""));
      const targetDate = new Date(currentWeekStart);
      targetDate.setDate(currentWeekStart.getDate() + dayIndex);
      const targetDateString = targetDate.toISOString().split("T")[0];

      // Find the task and update its due date
      const task = tasks.find((t) => t.id === taskId);
      if (task && user?.id) {
        const taskRef = doc(db, "users", user.id, "tasks", taskId);

        // Filter out undefined fields to avoid Firebase errors
        const taskUpdate = Object.fromEntries(
          Object.entries({
            ...task,
            dueDate: targetDateString,
            updatedAt: new Date().toISOString(),
          }).filter(([value]) => value !== undefined)
        );

        setDoc(taskRef, taskUpdate, { merge: true });
      }
    }
  };

  // Quick task creation
  const handleQuickTaskCreate = () => {
    const title = searchTerm.trim();
    if (!title) return;
    if (!user?.id) {
      console.warn("Usuário não autenticado; não é possível criar a tarefa.");
      return;
    }

    const taskRef = doc(collection(db, "users", user.id, "tasks"));
    const now = new Date().toISOString();
    const taskData = {
      id: taskRef.id,
      title,
      description: "",
      tags: [],
      priority: "baixa" as const,
      status: "pendente" as const,
      createdAt: now,
      updatedAt: now,
    };

    setDoc(taskRef, taskData, { merge: true });
    setSearchTerm("");
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="container sm:p-6 p-4 sm:max-w-[80vw] max-w-[100vw]">
        <PageHeader
          title="Tarefas"
          otherButton={
            <Button onClick={() => setTaskDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          }
        />

        {/* View Selector and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex gap-2">
            <Button
              variant={currentView === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentView("list")}
            >
              Lista
            </Button>
            <Button
              variant={currentView === "kanban" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentView("kanban")}
            >
              <Kanban className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={currentView === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentView("calendar")}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendário
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <Plus className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Criar tarefa rápida ou pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleQuickTaskCreate();
                  }
                }}
                className="pl-10"
              />
            </div>

            <div className="hidden gap-2">
              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                placeholder="Filtrar por tags"
              />
            </div>
          </div>
        </div>

        {/* Content based on current view */}
        {tasksForCurrentView.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {tasks.length === 0
                ? "Nenhuma tarefa criada"
                : "Nenhuma tarefa encontrada"}
            </h3>
            <p className="text-gray-500 mb-4">
              {tasks.length === 0
                ? "Comece criando sua primeira tarefa para organizar seu trabalho."
                : "Tente ajustar os filtros ou termos de busca."}
            </p>
            {tasks.length === 0 && (
              <Button onClick={() => setTaskDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira tarefa
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* List View */}
            {currentView === "list" && (
              <TaskList
                tasks={tasksForCurrentView}
                onTaskEdit={handleTaskEdit}
                onTaskView={handleTaskView}
                onTaskDelete={handleTaskDelete}
                onTaskStatusChange={updateTaskStatus}
                onTaskToggleComplete={handleTaskToggleComplete}
                onSubtaskToggle={toggleSubtaskStatus}
              />
            )}

            {/* Kanban View */}
            {currentView === "kanban" && (
              <KanbanView
                tasks={tasksForCurrentView}
                onTaskEdit={handleTaskEdit}
                onTaskView={handleTaskView}
                onTaskDelete={handleTaskDelete}
                onTaskStatusChange={updateTaskStatus}
                onTaskToggleComplete={handleTaskToggleComplete}
                onSubtaskToggle={toggleSubtaskStatus}
              />
            )}

            {/* Calendar View */}
            {currentView === "calendar" && (
              <CalendarView
                tasks={tasksForCurrentView}
                currentWeekStart={currentWeekStart}
                visibleDayStart={visibleDayStart}
                isMobile={isMobile}
                onTaskEdit={handleTaskEdit}
                onTaskView={handleTaskView}
                onTaskDelete={handleTaskDelete}
                onTaskStatusChange={updateTaskStatus}
                onTaskToggleComplete={handleTaskToggleComplete}
                onSubtaskToggle={toggleSubtaskStatus}
                onPreviousWeek={goToPreviousWeek}
                onNextWeek={goToNextWeek}
                onGoToCurrentWeek={goToCurrentWeek}
                onVisibleDayChange={handleVisibleDayChange}
              />
            )}
          </>
        )}

        {/* Task Drawer */}
        <TaskDrawer
          open={taskDrawerOpen}
          onOpenChange={(open) => {
            setTaskDrawerOpen(open);
            if (!open) {
              setEditingTask(null);
            }
          }}
          editingTask={editingTask}
        />

        {/* Task Viewer Drawer */}
        <TaskViewerDrawer
          open={taskViewerOpen}
          onOpenChange={(open) => {
            setTaskViewerOpen(open);
            if (!open) {
              setViewingTask(null);
            }
          }}
          task={viewingTask}
          onEdit={(task) => {
            setEditingTask(task);
            setTaskDrawerOpen(true);
            setTaskViewerOpen(false);
          }}
          onDelete={(task) => handleDeleteTask(task.id)}
          onToggleComplete={handleTaskToggleComplete}
          onToggleSubtask={toggleSubtaskStatus}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta tarefa? Esta ação não pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteTask}
                className="bg-red-600 hover:bg-red-700"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <DragOverlay>
        {draggedTask && (
          <div className="opacity-80 rotate-3 transform">
            <TaskCard
              task={draggedTask}
              onEdit={() => {}}
              onView={() => {}}
              onDelete={() => {}}
              onToggleStatus={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

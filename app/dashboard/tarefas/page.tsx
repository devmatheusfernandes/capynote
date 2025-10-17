"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Plus,
  Calendar,
  Trash2,
  Edit,
  CheckSquare,
  Clock,
  AlertCircle,
  Kanban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskDrawer } from "@/components/task-drawer";
import { PageHeader } from "@/components/page-header";
import { TagSelector } from "@/components/tag-selector";
import SyncDot from "@/components/sync-dot";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

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

type ViewType = "list" | "kanban" | "calendar";

const truncateWords = (text: string, max: number) => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text;
  return words.slice(0, max).join(" ") + "…";
};

export default function TarefasPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskData[]>([]);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [recurringDeleteDialogOpen, setRecurringDeleteDialogOpen] =
    useState(false);
  const [recurringTaskToDelete, setRecurringTaskToDelete] =
    useState<TaskData | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>("list");
  const [, setDraggedTask] = useState<TaskData | null>(null);
  // Mobile calendar: start index of 3-day window (0..4)
  const [visibleDayStart, setVisibleDayStart] = useState(0);

  // Get Monday of current week
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    getMonday(new Date())
  );

  // Ensure today appears as left as possible in the visible 3-day window
  useEffect(() => {
    if (!(isMobile && currentView === "calendar")) return;
    const monday = new Date(currentWeekStart);
    const today = new Date();
    const startMonday = getMonday(today);
    // Only center around today when viewing this week
    if (monday.toDateString() === startMonday.toDateString()) {
      const diffMs = today.setHours(0, 0, 0, 0) - monday.setHours(0, 0, 0, 0);
      const index = Math.max(
        0,
        Math.min(Math.floor(diffMs / (24 * 60 * 60 * 1000)), 6)
      );
      setVisibleDayStart(Math.max(0, Math.min(index, 4)));
    } else {
      setVisibleDayStart(0);
    }
  }, [currentWeekStart, isMobile, currentView]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Subscribe to tasks from Firestore under users/{userId}/tasks
  useEffect(() => {
    if (!user?.id) return;

    const tasksRef = collection(db, "users", user.id, "tasks");
    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const fetched = snapshot.docs.map((d) => {
        const data = d.data() as TaskData;
        const createdAt =
          typeof data.createdAt === "string"
            ? data.createdAt
            : new Date().toISOString();
        const updatedAt =
          typeof data.updatedAt === "string"
            ? data.updatedAt
            : new Date().toISOString();
        const task: TaskData = {
          id: data.id || d.id,
          title: data.title || "",
          description: data.description || "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          priority: data.priority || "media",
          status: data.status || "pendente",
          dueDate: data.dueDate || undefined,
          dueTime: data.dueTime || undefined,
          createdAt,
          updatedAt,
          isRecurring: data.isRecurring,
          recurringType: data.recurringType,
          recurringInterval: data.recurringInterval,
          recurringDays: data.recurringDays,
          recurringEndDate: data.recurringEndDate,
          recurringEndCount: data.recurringEndCount,
          excludedDates: data.excludedDates || [],
          subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
        };
        return task;
      });

      // Track pending writes per task
      const pendingMap: Record<string, boolean> = {};
      snapshot.docs.forEach((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: any = (d as any).metadata;
        pendingMap[d.id] = Boolean(meta?.hasPendingWrites);
      });
      setTaskPendingById(pendingMap);

      // Sort by priority and then by updatedAt
      const sortedTasks = fetched.sort((a: TaskData, b: TaskData) => {
        const priorityOrder = { alta: 3, media: 2, baixa: 1 };
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });

      setTasks(sortedTasks);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const [taskPendingById, setTaskPendingById] = useState<
    Record<string, boolean>
  >({});

  interface TasksMeta {
    completedOccurrences?: string[];
  }

  // Subscribe to completed recurring occurrences meta doc: users/{userId}/meta/tasks
  const [completedOccurrences, setCompletedOccurrences] = useState<string[]>(
    []
  );
  useEffect(() => {
    if (!user?.id) return;
    const metaRef = doc(db, "users", user.id, "meta", "tasks");
    const unsub = onSnapshot(metaRef, (snap) => {
      const data = snap.data() as TasksMeta | undefined;
      const keys = Array.isArray(data?.completedOccurrences)
        ? data.completedOccurrences
        : [];
      setCompletedOccurrences(keys);
    });
    return () => unsub();
  }, [user?.id]);

  // Filter tasks based on search term and selected tags
  useEffect(() => {
    let filtered = tasks;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.tags &&
            task.tags.some((tag) =>
              tag.toLowerCase().includes(searchTerm.toLowerCase())
            ))
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(
        (task) =>
          task.tags &&
          selectedTags.every((selectedTag) => task.tags.includes(selectedTag))
      );
    }

    // Sort by temporal proximity (closest due date first)
    filtered = filtered.sort((a, b) => {
      const now = new Date();

      // Helper function to get task date for comparison
      const getTaskDate = (task: TaskData) => {
        if (task.dueDate) {
          const [year, month, day] = task.dueDate.split("-").map(Number);
          const date = new Date(year, month - 1, day);
          if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(":").map(Number);
            date.setHours(hours, minutes);
          }
          return date;
        }
        // If no due date, use creation date
        return new Date(task.createdAt);
      };

      const dateA = getTaskDate(a);
      const dateB = getTaskDate(b);

      // Calculate distance from now
      const distanceA = Math.abs(dateA.getTime() - now.getTime());
      const distanceB = Math.abs(dateB.getTime() - now.getTime());

      // Sort by distance (closest first)
      return distanceA - distanceB;
    });

    setFilteredTasks(filtered);
  }, [tasks, searchTerm, selectedTags]);

  // Generate recurring task occurrences for a given date range
  const generateRecurringOccurrences = (
    task: TaskData,
    startDate: Date,
    endDate: Date
  ): TaskData[] => {
    if (!task.isRecurring) return [];

    const occurrences: TaskData[] = [];
    // Use dueDate if available, otherwise use createdAt as starting point
    const taskDate = task.dueDate
      ? new Date(task.dueDate)
      : new Date(task.createdAt);
    const currentDate = new Date(
      Math.max(taskDate.getTime(), startDate.getTime())
    );

    // Limit to prevent infinite loops
    const maxOccurrences = 100;
    let occurrenceCount = 0;

    while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
      // Check if we should stop based on end conditions
      if (
        task.recurringEndDate &&
        currentDate > new Date(task.recurringEndDate)
      ) {
        break;
      }
      if (task.recurringEndCount && occurrenceCount >= task.recurringEndCount) {
        break;
      }

      // Check if current date should have an occurrence
      let shouldCreateOccurrence = false;

      switch (task.recurringType) {
        case "daily":
          shouldCreateOccurrence = true;
          break;
        case "weekly":
          if (task.recurringDays && task.recurringDays.length > 0) {
            // For weekly with specific days, check if current day matches
            const dayNames = [
              "sunday",
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
            ];
            const currentDayName = dayNames[currentDate.getDay()];
            shouldCreateOccurrence =
              task.recurringDays.includes(currentDayName);
          } else {
            // Default weekly (every 7 days from original date)
            const daysDiff = Math.floor(
              (currentDate.getTime() - taskDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );
            shouldCreateOccurrence =
              daysDiff % (7 * (task.recurringInterval || 1)) === 0;
          }
          break;
        case "monthly":
          // Check if it's the same day of month as original
          shouldCreateOccurrence = currentDate.getDate() === taskDate.getDate();
          break;
        case "yearly":
          // Check if it's the same day and month as original
          shouldCreateOccurrence =
            currentDate.getDate() === taskDate.getDate() &&
            currentDate.getMonth() === taskDate.getMonth();
          break;
        case "custom":
          const daysDiffCustom = Math.floor(
            (currentDate.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          shouldCreateOccurrence =
            daysDiffCustom % (task.recurringInterval || 1) === 0;
          break;
        default:
          shouldCreateOccurrence = true;
      }

      // Create occurrence if it should exist on this date
      if (shouldCreateOccurrence) {
        const occurrenceId = `${task.id}_occurrence_${
          currentDate.toISOString().split("T")[0]
        }`;
        const occurrenceDate = currentDate.toISOString().split("T")[0];

        // Check if this date is excluded
        const excludedDates = task.excludedDates || [];
        if (excludedDates.includes(occurrenceDate)) {
          // Skip this occurrence as it was deleted
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Check if this occurrence was completed
        const occurrenceKey = `${occurrenceId}_${occurrenceDate}`;
        const isCompleted = completedOccurrences.includes(occurrenceKey);

        const occurrence: TaskData = {
          ...task,
          id: occurrenceId,
          dueDate: occurrenceDate,
          status: isCompleted ? "concluida" : task.status,
          isRecurring: false, // Mark occurrences as non-recurring to avoid infinite loops
        };
        occurrences.push(occurrence);
        occurrenceCount++;
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return occurrences;
  };

  // Filter tasks based on current view
  const getTasksForCurrentView = () => {
    if (currentView === "kanban") {
      // Exclude recurring tasks from Kanban view
      return filteredTasks.filter((task) => !task.isRecurring);
    }

    if (currentView === "list") {
      // For list view, include recurring task occurrences for today and near future
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30); // Show occurrences for next 30 days

      const regularTasks = filteredTasks.filter((task) => !task.isRecurring);
      const recurringTasks = filteredTasks.filter((task) => task.isRecurring);

      const recurringOccurrences: TaskData[] = [];
      recurringTasks.forEach((task) => {
        const occurrences = generateRecurringOccurrences(task, today, endDate);
        recurringOccurrences.push(...occurrences);
      });

      return [...regularTasks, ...recurringOccurrences];
    }

    return filteredTasks;
  };

  // Format date for display
  // const formatDate = (dateString: string) => {
  //   const date = new Date(dateString);
  //   const now = new Date();
  //   const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  //   if (diffInHours < 24) {
  //     return date.toLocaleTimeString("pt-BR", {
  //       hour: "2-digit",
  //       minute: "2-digit",
  //     });
  //   } else if (diffInHours < 24 * 7) {
  //     return date.toLocaleDateString("pt-BR", {
  //       weekday: "short",
  //       hour: "2-digit",
  //       minute: "2-digit",
  //     });
  //   } else {
  //     return date.toLocaleDateString("pt-BR", {
  //       day: "2-digit",
  //       month: "2-digit",
  //       year: "numeric",
  //     });
  //   }
  // };

  // Format task due date and time for display
  const formatTaskDueDate = (dueDate: string, dueTime?: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dueDate.split("-").map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return dueTime ? `Hoje às ${dueTime}` : "Hoje";
    }

    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return dueTime ? `Amanhã às ${dueTime}` : "Amanhã";
    }

    // Check if it's yesterday (overdue)
    if (date.toDateString() === yesterday.toDateString()) {
      return dueTime ? `Ontem às ${dueTime}` : "Ontem";
    }

    // Check if it's within this week
    const diffInDays = Math.floor(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (Math.abs(diffInDays) <= 7) {
      const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
      const capitalizedWeekday =
        weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return dueTime
        ? `${capitalizedWeekday} às ${dueTime}`
        : capitalizedWeekday;
    }

    // Format as date for dates further away
    const formattedDate = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });

    return dueTime ? `${formattedDate} às ${dueTime}` : formattedDate;
  };

  // Get priority color
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

  // Get status color
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

  // Check if task is overdue
  const isOverdue = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return false;

    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dueDate.split("-").map(Number);
    const taskDate = new Date(year, month - 1, day); // month is 0-indexed
    const now = new Date();

    // If there's a specific time, combine date and time for comparison
    if (dueTime) {
      const [hours, minutes] = dueTime.split(":").map(Number);
      taskDate.setHours(hours, minutes, 0, 0);
    } else {
      // If no time specified, consider end of day (23:59)
      taskDate.setHours(23, 59, 59, 999);
    }

    return taskDate < now;
  };

  // Handle task deletion
  const handleDeleteTask = (taskId: string) => {
    // Find the task to check if it's recurring
    const task = tasks.find((t) => t.id === taskId);
    const isRecurringOccurrence = taskId.includes("_occurrence_");
    const originalTaskId = isRecurringOccurrence
      ? taskId.split("_occurrence_")[0]
      : taskId;
    const originalTask = tasks.find((t) => t.id === originalTaskId);

    // If it's a recurring task or occurrence, show special dialog
    if (
      (task && task.isRecurring) ||
      (originalTask && originalTask.isRecurring)
    ) {
      const taskToShow = isRecurringOccurrence ? originalTask : task;
      if (taskToShow) {
        setRecurringTaskToDelete({
          ...taskToShow,
          id: taskId, // Keep the original ID (might be occurrence ID)
          isOccurrence: isRecurringOccurrence,
        } as TaskData & { isOccurrence: boolean });
        setRecurringDeleteDialogOpen(true);
      }
    } else {
      // Regular task deletion
      setTaskToDelete(taskId);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      if (!user?.id) return;
      // Delete from Firestore
      deleteDoc(doc(db, "users", user.id, "tasks", taskToDelete));
      setTaskToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // Delete only this specific occurrence
  const deleteThisOccurrence = () => {
    if (recurringTaskToDelete) {
      const taskId = recurringTaskToDelete.id;
      const isOccurrence = taskId.includes("_occurrence_");

      if (isOccurrence) {
        // For occurrences, we need to add this date to the excluded dates of the original task
        const originalTaskId = taskId.split("_occurrence_")[0];
        const occurrenceDate = taskId.split("_occurrence_")[1];
        if (user?.id) {
          updateDoc(doc(db, "users", user.id, "tasks", originalTaskId), {
            excludedDates: arrayUnion(occurrenceDate),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // If it's the original recurring task, just delete it completely
        deleteAllOccurrences();
        return;
      }
      setRecurringTaskToDelete(null);
      setRecurringDeleteDialogOpen(false);
    }
  };

  // Delete all occurrences (entire series)
  const deleteAllOccurrences = () => {
    if (recurringTaskToDelete) {
      const taskId = recurringTaskToDelete.id;
      const isOccurrence = taskId.includes("_occurrence_");
      const originalTaskId = isOccurrence
        ? taskId.split("_occurrence_")[0]
        : taskId;
      if (user?.id) {
        deleteDoc(doc(db, "users", user.id, "tasks", originalTaskId));
      }
      setRecurringTaskToDelete(null);
      setRecurringDeleteDialogOpen(false);
    }
  };

  // Delete from this date forward
  const deleteFromThisDateForward = () => {
    if (recurringTaskToDelete) {
      const taskId = recurringTaskToDelete.id;
      const isOccurrence = taskId.includes("_occurrence_");

      if (isOccurrence) {
        // Set the end date to the day before this occurrence
        const originalTaskId = taskId.split("_occurrence_")[0];
        const occurrenceDate = taskId.split("_occurrence_")[1];
        const endDate = new Date(occurrenceDate);
        endDate.setDate(endDate.getDate() - 1);
        if (user?.id) {
          updateDoc(doc(db, "users", user.id, "tasks", originalTaskId), {
            recurringEndDate: endDate.toISOString().split("T")[0],
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // If it's the original task, delete it completely
        deleteAllOccurrences();
        return;
      }
      setRecurringTaskToDelete(null);
      setRecurringDeleteDialogOpen(false);
    }
  };

  // // Toggle task status
  // const toggleTaskStatus = (taskId: string) => {
  //   const task = tasks.find((t) => t.id === taskId);
  //   if (!task) return;
  //   // Ignore recurring occurrence IDs here; status updates are for regular tasks
  //   const isOccurrence = taskId.includes("_occurrence_");
  //   if (isOccurrence) return;
  //   let newStatus: TaskData["status"];
  //   switch (task.status) {
  //     case "pendente":
  //       newStatus = "em-progresso";
  //       break;
  //     case "em-progresso":
  //       newStatus = "concluida";
  //       break;
  //     case "concluida":
  //       newStatus = "pendente";
  //       break;
  //     default:
  //       newStatus = "pendente";
  //   }
  //   if (user?.id) {
  //     updateDoc(doc(db, "users", user.id, "tasks", taskId), {
  //       status: newStatus,
  //       updatedAt: new Date().toISOString(),
  //     });
  //   }
  // };

  // Mark task as completed (for checkbox)
  const markTaskCompleted = (taskId: string) => {
    if (user?.id) {
      updateDoc(doc(db, "users", user.id, "tasks", taskId), {
        status: "concluida",
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Mark specific recurring occurrence as completed
  const markRecurringOccurrenceCompleted = (
    occurrenceId: string,
    occurrenceDate: string
  ) => {
    if (!user?.id) return;
    const occurrenceKey = `${occurrenceId}_${occurrenceDate}`;
    // Add to meta doc array
    const metaRef = doc(db, "users", user.id, "meta", "tasks");
    setDoc(
      metaRef,
      { completedOccurrences: arrayUnion(occurrenceKey) },
      { merge: true }
    );
  };

  // Unmark specific recurring occurrence as completed (set back to pending)
  const unmarkRecurringOccurrenceCompleted = (
    occurrenceId: string,
    occurrenceDate: string
  ) => {
    if (!user?.id) return;
    const occurrenceKey = `${occurrenceId}_${occurrenceDate}`;
    const metaRef = doc(db, "users", user.id, "meta", "tasks");
    // Remove from meta doc array; use merge to avoid update errors when doc doesn't exist
    setDoc(
      metaRef,
      { completedOccurrences: arrayRemove(occurrenceKey) },
      { merge: true }
    );
  };

  // Update task status (for kanban)
  const updateTaskStatus = (taskId: string, newStatus: TaskData["status"]) => {
    // Protect against occurrence IDs; only regular tasks have documents
    if (taskId.includes("_occurrence_")) return;
    if (user?.id) {
      updateDoc(doc(db, "users", user.id, "tasks", taskId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Update task due date (for calendar)
  const updateTaskDueDate = (taskId: string, newDueDate: string) => {
    if (user?.id) {
      updateDoc(doc(db, "users", user.id, "tasks", taskId), {
        dueDate: newDueDate,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Toggle subtask status
  const toggleSubtaskStatus = (
    taskId: string,
    subtaskId: string,
    checked: boolean
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !user?.id) return;
    const newSubtasks = (task.subtasks || []).map((st) =>
      st.id === subtaskId
        ? {
            ...st,
            status: checked ? "concluida" : "pendente",
            updatedAt: new Date().toISOString(),
          }
        : st
    );
    updateDoc(doc(db, "users", user.id, "tasks", taskId), {
      subtasks: newSubtasks,
      updatedAt: new Date().toISOString(),
    });
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

    if (currentView === "kanban") {
      // Handle kanban column drops
      if (
        overId === "pendente" ||
        overId === "em-progresso" ||
        overId === "concluida"
      ) {
        updateTaskStatus(taskId, overId as TaskData["status"]);
      }
    } else if (currentView === "calendar") {
      // Handle calendar day drops
      if (overId.startsWith("day-")) {
        const dayIndex = parseInt(overId.split("-")[1]);
        const targetDate = new Date(currentWeekStart);
        targetDate.setDate(currentWeekStart.getDate() + dayIndex);
        const dateString = targetDate.toISOString().split("T")[0];
        updateTaskDueDate(taskId, dateString);
      }
    }
  };

  // Get week days based on current week start
  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getMonday(new Date()));
  };

  // Task List Item Component (for list view)
  const TaskListItem = ({ task }: { task: TaskData }) => {
    const dueDateInfo = task.dueDate
      ? formatTaskDueDate(task.dueDate, task.dueTime)
      : null;
    const isTaskOverdue = task.dueDate
      ? isOverdue(task.dueDate, task.dueTime)
      : false;

    // Check if this is a recurring task occurrence
    const isRecurringOccurrence = task.id.includes("_occurrence_");
    const originalTaskId = isRecurringOccurrence
      ? task.id.split("_occurrence_")[0]
      : task.id;

    return (
      <div className="flex flex-row items-center gap-2 px-2 py-1 border rounded-md hover:border-primary hover:border-1 duration-300 ease-in-out transition-all">
        {/* Checkbox */}
        <Checkbox
          checked={task.status === "concluida"}
          onCheckedChange={(checked) => {
            if (checked) {
              if (isRecurringOccurrence) {
                // For recurring occurrences, mark only this specific occurrence as completed
                markRecurringOccurrenceCompleted(task.id, task.dueDate!);
              } else {
                markTaskCompleted(task.id);
              }
            } else {
              // If unchecking, handle recurring occurrences via meta removal
              if (isRecurringOccurrence) {
                unmarkRecurringOccurrenceCompleted(task.id, task.dueDate!);
              } else {
                updateTaskStatus(task.id, "pendente");
              }
            }
          }}
          className="flex-shrink-0"
        />

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  title={task.title}
                  className={`font-medium text-sm ${
                    task.status === "concluida"
                      ? "line-through text-primary"
                      : "text-text"
                  } cursor-pointer hover:underline`}
                  onClick={() => {
                    const taskToEdit = isRecurringOccurrence
                      ? tasks.find((t) => t.id === originalTaskId) || task
                      : task;
                    setEditingTask(taskToEdit);
                    setTaskDrawerOpen(true);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    {/* Use base ID for occurrences */}
                    {(() => {
                      const baseId = task.id.includes("_occurrence_")
                        ? task.id.split("_occurrence_")[0]
                        : task.id;
                      return (
                        <SyncDot pending={taskPendingById[baseId]} size={8} />
                      );
                    })()}
                    {truncateWords(task.title, isMobile ? 4 : 12)}
                  </span>
                </h3>
                {/* Show recurring indicator and specific date */}
                {isRecurringOccurrence && (
                  <div className="flex items-center gap-1">
                    <Repeat className="h-3 w-3 text-primary" />
                    <span className="text-xs text-primary bg-indigo-50 px-2 py-1 rounded">
                      {new Date(task.dueDate!).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
              {task.description && (
                <p
                  className={`text-sm ${
                    task.status === "concluida"
                      ? "line-through text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  {task.description}
                </p>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Subtasks */}
              {!isRecurringOccurrence &&
                task.subtasks &&
                task.subtasks.length > 0 && (
                  <div className="hidden mt-2 space-y-1">
                    {task.subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={st.status === "concluida"}
                          onCheckedChange={(checked) =>
                            toggleSubtaskStatus(
                              task.id,
                              st.id,
                              Boolean(checked)
                            )
                          }
                          className="flex-shrink-0"
                        />
                        <span
                          className={`text-xs ${
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
                )}
            </div>

            {/* Right side info */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Due date */}
              {dueDateInfo && !isRecurringOccurrence && (
                <div
                  className={`flex items-center gap-1 text-xs ${
                    isTaskOverdue ? "text-red-600" : "text-gray-500"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>{dueDateInfo}</span>
                </div>
              )}

              {/* Priority indicator */}
              <div
                className={`hidden sm:block w-3 h-3 rounded-full ${getPriorityColor(
                  task.priority
                )}`}
              />

              {/* Status badge */}
              <Badge
                variant="outline"
                className={`hidden sm:block text-xs ${getStatusColor(
                  task.status
                )}`}
              >
                {task.status === "em-progresso"
                  ? "Em Progresso"
                  : task.status === "concluida"
                  ? "Concluída"
                  : "Pendente"}
              </Badge>

              {/* Actions */}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // For recurring occurrences, edit the original task
                    const taskToEdit = isRecurringOccurrence
                      ? tasks.find((t) => t.id === originalTaskId) || task
                      : task;
                    setEditingTask(taskToEdit);
                    setTaskDrawerOpen(true);
                  }}
                  className="hidden sm:block h-8 w-8 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Always pass the current task ID; for occurrences this includes '_occurrence_' and shows all options
                    handleDeleteTask(task.id);
                  }}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Sortable Task Component
  const SortableTask = ({
    task,
    showCheckbox = false,
    calendarDayIndex,
    calendarMoveLeftEnabled,
    calendarMoveRightEnabled,
  }: {
    task: TaskData;
    showCheckbox?: boolean;
    calendarDayIndex?: number;
    calendarMoveLeftEnabled?: boolean;
    calendarMoveRightEnabled?: boolean;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: task.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="py-1 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      >
        <CardHeader className="px-2">
          <div className="flex">
            <div className="flex items-center gap-2 flex-1">
              {showCheckbox && (
                <Checkbox
                  checked={task.status === "concluida"}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Check if this is a recurring task occurrence
                      const isRecurringOccurrence =
                        task.id.includes("_occurrence_");
                      if (isRecurringOccurrence) {
                        // For recurring occurrences, mark only this specific occurrence as completed
                        markRecurringOccurrenceCompleted(
                          task.id,
                          task.dueDate!
                        );
                      } else {
                        markTaskCompleted(task.id);
                      }
                    } else {
                      // If unchecking, handle recurring occurrences via meta removal
                      const isRecurringOccurrence =
                        task.id.includes("_occurrence_");
                      if (isRecurringOccurrence) {
                        unmarkRecurringOccurrenceCompleted(
                          task.id,
                          task.dueDate!
                        );
                      } else {
                        updateTaskStatus(task.id, "pendente");
                      }
                    }
                  }}
                />
              )}
              <CardTitle className="text-xs font-medium line-clamp-2 flex-1 flex items-center gap-2">
                {(() => {
                  const baseId = task.id.includes("_occurrence_")
                    ? task.id.split("_occurrence_")[0]
                    : task.id;
                  return (
                    <SyncDot
                      className={isMobile ? "hidden" : "block"}
                      pending={taskPendingById[baseId]}
                      size={8}
                    />
                  );
                })()}
                {task.title}
              </CardTitle>
            </div>
            <div className="flex gap-1 ml-2">
              {currentView === "kanban" && isMobile && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetStatus =
                        task.status === "em-progresso"
                          ? "pendente"
                          : task.status === "concluida"
                          ? "em-progresso"
                          : null;
                      if (targetStatus) updateTaskStatus(task.id, targetStatus);
                    }}
                    disabled={
                      !(
                        task.status === "em-progresso" ||
                        task.status === "concluida"
                      )
                    }
                    aria-label="Mover para cima"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetStatus =
                        task.status === "pendente"
                          ? "em-progresso"
                          : task.status === "em-progresso"
                          ? "concluida"
                          : null;
                      if (targetStatus) updateTaskStatus(task.id, targetStatus);
                    }}
                    disabled={
                      !(
                        task.status === "pendente" ||
                        task.status === "em-progresso"
                      )
                    }
                    aria-label="Mover para baixo"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {currentView === "kanban" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(task.id);
                  }}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={
            currentView === "kanban" && isMobile
              ? "px-2 mb-2"
              : "px-2 flex flex-col items-center space-y-2"
          }
        >
          {task.description && (
            <p className="text-sm text-gray-600 line-clamp-3">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
            {task.dueDate && currentView === "kanban" && (
              <Badge
                variant="outline"
                className={
                  isOverdue(task.dueDate, task.dueTime)
                    ? "border-red-500 text-red-600"
                    : ""
                }
              >
                <Calendar className="h-3 w-3 mr-1" />
                {formatTaskDueDate(task.dueDate, task.dueTime)}
                {isOverdue(task.dueDate, task.dueTime) && (
                  <AlertCircle className="h-3 w-3 ml-1" />
                )}
              </Badge>
            )}
          </div>

          {currentView === "calendar" &&
            isMobile &&
            typeof calendarDayIndex === "number" && (
              <div className="flex items-center text-xs text-gray-500 border-t">
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        typeof calendarDayIndex !== "number" ||
                        !(calendarMoveLeftEnabled ?? true)
                      )
                        return;
                      // Do not move recurring occurrences via quick arrows
                      if (task.id.includes("_occurrence_")) return;
                      const targetIndex = Math.max(0, calendarDayIndex - 1);
                      const targetDate = new Date(currentWeekStart);
                      targetDate.setDate(
                        currentWeekStart.getDate() + targetIndex
                      );
                      const dateString = targetDate.toISOString().split("T")[0];
                      updateTaskDueDate(task.id, dateString);
                    }}
                    disabled={
                      !(calendarMoveLeftEnabled ?? true) ||
                      task.id.includes("_occurrence_")
                    }
                    aria-label="Mover para dia anterior"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        typeof calendarDayIndex !== "number" ||
                        !(calendarMoveRightEnabled ?? true)
                      )
                        return;
                      // Do not move recurring occurrences via quick arrows
                      if (task.id.includes("_occurrence_")) return;
                      const targetIndex = Math.min(6, calendarDayIndex + 1);
                      const targetDate = new Date(currentWeekStart);
                      targetDate.setDate(
                        currentWeekStart.getDate() + targetIndex
                      );
                      const dateString = targetDate.toISOString().split("T")[0];
                      updateTaskDueDate(task.id, dateString);
                    }}
                    disabled={
                      !(calendarMoveRightEnabled ?? true) ||
                      task.id.includes("_occurrence_")
                    }
                    aria-label="Mover para próximo dia"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    );
  };

  // Droppable Area Component
  const DroppableArea = ({
    id,
    children,
    className,
  }: {
    id: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const { setNodeRef } = useSortable({ id });

    return (
      <div ref={setNodeRef} className={className}>
        {children}
      </div>
    );
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
                  if (e.key !== "Enter") return;
                  const title = searchTerm.trim();
                  if (!title) return;
                  if (!user?.id) {
                    console.warn(
                      "Usuário não autenticado; não é possível criar a tarefa."
                    );
                    return;
                  }
                  const taskRef = doc(
                    collection(db, "users", user.id, "tasks")
                  );
                  const now = new Date().toISOString();
                  const taskData = {
                    id: taskRef.id,
                    title,
                    description: "",
                    tags: [],
                    priority: "baixa",
                    status: "pendente",
                    createdAt: now,
                    updatedAt: now,
                  };
                  // Usa merge para permitir futuras atualizações sem sobrescrever campos externos
                  setDoc(taskRef, taskData, { merge: true });
                  // Limpa o input para remover possíveis filtros e permitir nova criação
                  setSearchTerm("");
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
        {getTasksForCurrentView().length === 0 ? (
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
              <div className="space-y-2">
                {getTasksForCurrentView().map((task) => (
                  <TaskListItem key={task.id} task={task} />
                ))}
              </div>
            )}

            {/* Kanban View */}
            {currentView === "kanban" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(["pendente", "em-progresso", "concluida"] as const).map(
                  (status) => (
                    <div
                      key={status}
                      className="space-y-4 pt-2 px-2 rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg capitalize">
                          {status === "em-progresso"
                            ? "Em Progresso"
                            : status === "concluida"
                            ? "Concluída"
                            : "Pendente"}
                        </h3>
                        <Badge variant="secondary">
                          {
                            getTasksForCurrentView().filter(
                              (t) => t.status === status
                            ).length
                          }
                        </Badge>
                      </div>

                      <DroppableArea
                        id={status}
                        className="min-h-[200px] space-y-3"
                      >
                        <SortableContext
                          items={getTasksForCurrentView()
                            .filter((t) => t.status === status)
                            .map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {getTasksForCurrentView()
                            .filter((task) => task.status === status)
                            .map((task) => (
                              <SortableTask key={task.id} task={task} />
                            ))}
                        </SortableContext>
                      </DroppableArea>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Calendar View */}
            {currentView === "calendar" && (
              <div className="space-y-1">
                {/* Week Navigation */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isMobile) {
                        if (visibleDayStart > 0) {
                          setVisibleDayStart((s) => s - 1);
                        } else {
                          goToPreviousWeek();
                          setVisibleDayStart(4);
                        }
                      } else {
                        goToPreviousWeek();
                      }
                    }}
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
                      onClick={() => {
                        goToCurrentWeek();
                        // visibleDayStart recalculated by effect
                      }}
                      className="text-xs mt-1"
                    >
                      Ir para hoje
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isMobile) {
                        if (visibleDayStart < 4) {
                          setVisibleDayStart((s) => s + 1);
                        } else {
                          goToNextWeek();
                          setVisibleDayStart(0);
                        }
                      } else {
                        goToNextWeek();
                      }
                    }}
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
                      const index = isMobile
                        ? visibleDayStart + sliceIndex
                        : sliceIndex;
                      // Get regular tasks for this day
                      const regularTasks = filteredTasks.filter((task) => {
                        // Exclude recurring tasks from regular display
                        if (task.isRecurring) return false;

                        if (task.dueDate) {
                          return (
                            task.dueDate === day.toISOString().split("T")[0]
                          );
                        } else {
                          // If no due date, show in the day it was created
                          const createdDate = new Date(task.createdAt)
                            .toISOString()
                            .split("T")[0];
                          return (
                            createdDate === day.toISOString().split("T")[0]
                          );
                        }
                      });

                      // Get recurring task occurrences for this day
                      const recurringOccurrences: TaskData[] = [];
                      const dayStart = new Date(day);
                      const dayEnd = new Date(day);
                      dayEnd.setHours(23, 59, 59, 999);

                      filteredTasks.forEach((task) => {
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
                      const dayTasks = [
                        ...regularTasks,
                        ...recurringOccurrences,
                      ];

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
                            className="min-h-[300px] space-y-2 p-2 border-1 border-dashed border-gray-200 rounded-lg"
                          >
                            <SortableContext
                              items={dayTasks.map((t) => t.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {dayTasks.map((task) => (
                                <SortableTask
                                  key={task.id}
                                  task={task}
                                  showCheckbox={true}
                                  calendarDayIndex={index}
                                  calendarMoveLeftEnabled={
                                    isMobile ? sliceIndex > 0 : false
                                  }
                                  calendarMoveRightEnabled={
                                    isMobile
                                      ? sliceIndex < days.length - 1
                                      : false
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

        {/* Recurring Task Delete Options Dialog */}
        <AlertDialog
          open={recurringDeleteDialogOpen}
          onOpenChange={setRecurringDeleteDialogOpen}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa repetitiva</AlertDialogTitle>
              <AlertDialogDescription>
                Esta é uma tarefa repetitiva. Como você gostaria de excluí-la?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-4">
              {recurringTaskToDelete?.id.includes("_occurrence_") && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-4"
                  onClick={deleteThisOccurrence}
                >
                  <div>
                    <div className="font-medium">Apenas esta ocorrência</div>
                    <div className="text-sm text-muted-foreground">
                      Exclui apenas esta data específica
                    </div>
                  </div>
                </Button>
              )}

              {recurringTaskToDelete?.id.includes("_occurrence_") && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-4"
                  onClick={deleteFromThisDateForward}
                >
                  <div>
                    <div className="font-medium">Desta data em diante</div>
                    <div className="text-sm text-muted-foreground">
                      Exclui esta e todas as próximas ocorrências
                    </div>
                  </div>
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto p-4 border-red-200 hover:bg-red-50"
                onClick={deleteAllOccurrences}
              >
                <div>
                  <div className="font-medium text-red-600">Toda a série</div>
                  <div className="text-sm text-muted-foreground">
                    Exclui todas as ocorrências desta tarefa repetitiva
                  </div>
                </div>
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndContext>
  );
}

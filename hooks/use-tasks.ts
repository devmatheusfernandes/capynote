import { useState, useEffect } from "react";
import { collection, doc, onSnapshot, deleteDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TaskData, TasksMeta } from "@/types/tasks";
import { generateRecurringOccurrences } from "@/lib/task-utils";

export const useTasks = (userId: string | undefined) => {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [taskPendingById, setTaskPendingById] = useState<Record<string, boolean>>({});
  const [completedOccurrences, setCompletedOccurrences] = useState<string[]>([]);

  // Subscribe to tasks from Firestore
  useEffect(() => {
    if (!userId) return;

    const tasksRef = collection(db, "users", userId, "tasks");
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
  }, [userId]);

  // Subscribe to completed recurring occurrences meta doc
  useEffect(() => {
    if (!userId) return;
    const metaRef = doc(db, "users", userId, "meta", "tasks");
    const unsub = onSnapshot(metaRef, (snap) => {
      const data = snap.data() as TasksMeta | undefined;
      const keys = Array.isArray(data?.completedOccurrences)
        ? data.completedOccurrences
        : [];
      setCompletedOccurrences(keys);
    });
    return () => unsub();
  }, [userId]);

  // Task management functions
  const handleDeleteTask = async (taskId: string) => {
    if (!userId) return;
    const taskRef = doc(db, "users", userId, "tasks", taskId);
    await deleteDoc(taskRef);
  };

  const updateTaskStatus = async (taskId: string, status: TaskData["status"]) => {
    if (!userId) return;
    const taskRef = doc(db, "users", userId, "tasks", taskId);
    await updateDoc(taskRef, {
      status,
      updatedAt: new Date().toISOString(),
    });
  };

  const markTaskCompleted = async (taskId: string) => {
    await updateTaskStatus(taskId, "concluida");
  };

  const markRecurringOccurrenceCompleted = async (taskId: string, dueDate: string) => {
    if (!userId) return;
    const metaRef = doc(db, "users", userId, "meta", "tasks");
    const occurrenceKey = `${taskId}_${dueDate}`;
    await setDoc(metaRef, {
      completedOccurrences: arrayUnion(occurrenceKey),
    }, { merge: true });
  };

  const unmarkRecurringOccurrenceCompleted = async (taskId: string, dueDate: string) => {
    if (!userId) return;
    const metaRef = doc(db, "users", userId, "meta", "tasks");
    const occurrenceKey = `${taskId}_${dueDate}`;
    await setDoc(metaRef, {
      completedOccurrences: arrayRemove(occurrenceKey),
    }, { merge: true });
  };

  const toggleSubtaskStatus = async (taskId: string, subtaskId: string, checked: boolean) => {
    if (!userId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.map(subtask =>
      subtask.id === subtaskId
        ? {
            ...subtask,
            status: checked ? "concluida" as const : "pendente" as const,
            updatedAt: new Date().toISOString(),
          }
        : subtask
    );

    const taskRef = doc(db, "users", userId, "tasks", taskId);
    await updateDoc(taskRef, {
      subtasks: updatedSubtasks,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    tasks,
    taskPendingById,
    completedOccurrences,
    handleDeleteTask,
    updateTaskStatus,
    markTaskCompleted,
    markRecurringOccurrenceCompleted,
    unmarkRecurringOccurrenceCompleted,
    toggleSubtaskStatus,
  };
};

export const useTaskFilters = (
  tasks: TaskData[],
  searchTerm: string,
  selectedTags: string[]
) => {
  const [filteredTasks, setFilteredTasks] = useState<TaskData[]>([]);

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

  return filteredTasks;
};

export const useTasksForView = (
  filteredTasks: TaskData[],
  currentView: "list" | "kanban" | "calendar",
  completedOccurrences: string[]
) => {
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
        const occurrences = generateRecurringOccurrences(task, today, endDate, completedOccurrences);
        recurringOccurrences.push(...occurrences);
      });

      return [...regularTasks, ...recurringOccurrences];
    }

    return filteredTasks;
  };

  return getTasksForCurrentView();
};
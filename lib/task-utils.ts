import { TaskData, TaskPriority, TaskStatus } from "@/types/tasks";

/**
 * Truncate text to a maximum number of words
 */
export const truncateWords = (text: string, max: number): string => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text;
  return words.slice(0, max).join(" ") + "…";
};

/**
 * Format task due date and time for display
 */
export const formatTaskDueDate = (dueDate: string, dueTime?: string): string => {
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

/**
 * Get priority color classes
 */
export const getPriorityColor = (priority: TaskPriority): string => {
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

/**
 * Get status color classes
 */
export const getStatusColor = (status: TaskStatus): string => {
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

/**
 * Check if task is overdue
 */
export const isOverdue = (dueDate?: string, dueTime?: string): boolean => {
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

/**
 * Get Monday of current week
 */
export const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

/**
 * Generate recurring task occurrences for a given date range
 */
export const generateRecurringOccurrences = (
  task: TaskData,
  startDate: Date,
  endDate: Date,
  completedOccurrences: string[] = []
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
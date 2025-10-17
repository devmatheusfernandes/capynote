import { useState, useEffect } from "react";
import { getMonday } from "@/lib/task-utils";

export const useCalendar = (isMobile: boolean, currentView: string) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    getMonday(new Date())
  );
  const [visibleDayStart, setVisibleDayStart] = useState(0);

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

  return {
    currentWeekStart,
    setCurrentWeekStart,
    visibleDayStart,
    setVisibleDayStart,
  };
};
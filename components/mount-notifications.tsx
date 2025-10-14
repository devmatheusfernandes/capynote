"use client";

import { useEffect, useState } from "react";
import NotificationsManager from "@/components/notifications-manager";

export default function MountNotifications() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <NotificationsManager />;
}
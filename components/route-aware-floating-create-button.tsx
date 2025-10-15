"use client";

import { usePathname } from "next/navigation";
import { FloatingCreateButton } from "@/components/create-button";

export function RouteAwareFloatingCreateButton() {
  const pathname = usePathname();
  const hideOnEdit = pathname?.startsWith("/dashboard/notas/editar/") ?? false;
  if (hideOnEdit) return null;
  return <FloatingCreateButton />;
}

export default RouteAwareFloatingCreateButton;
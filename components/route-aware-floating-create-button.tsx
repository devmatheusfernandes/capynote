"use client";

import { usePathname } from "next/navigation";
import { FloatingCreateButton } from "@/components/create-button";

export function RouteAwareFloatingCreateButton() {
  const hiddenRoutes = ["/dashboard/notas/editar/", "/dashboard/notas"];
  const pathname = usePathname();

  // Verifica se o pathname é exatamente uma das rotas ocultas
  const shouldHide = pathname ? hiddenRoutes.includes(pathname) : false;

  if (shouldHide) return null;

  return <FloatingCreateButton />;
}

export default RouteAwareFloatingCreateButton;

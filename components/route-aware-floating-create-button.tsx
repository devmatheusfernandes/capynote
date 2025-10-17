"use client";

import { usePathname } from "next/navigation";
import { FloatingCreateButton } from "@/components/create-button";

export function RouteAwareFloatingCreateButton() {
  const pathname = usePathname();

  const hiddenRoutes = [
    "/dashboard/notas/editar/",
    "/dashboard/notas",
    "/dashboard/tarefas",
    "/dashboard/tarefas/configuracoes",
    // Adicione mais rotas aqui
  ];

  const shouldHide = pathname
    ? hiddenRoutes.some((route) => pathname.startsWith(route))
    : false;

  if (shouldHide) return null;

  return <FloatingCreateButton />;
}

export default RouteAwareFloatingCreateButton;

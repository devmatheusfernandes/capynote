import { redirect } from "next/navigation";

export default function DashboardPage() {
  // Redireciona imediatamente para a listagem de notas
  redirect("/dashboard/notas");
}
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function NovaTarefaPage() {
  const router = useRouter()

  useEffect(() => {
    // Redireciona para a página principal de tarefas
    // O drawer será aberto através do create-button
    router.push("/dashboard/tarefas")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900 mb-2">
          Redirecionando...
        </h2>
        <p className="text-gray-500">
          Você será redirecionado para a página de tarefas.
        </p>
      </div>
    </div>
  )
}
"use client"

import { useState, useEffect } from 'react'
import { getLastUser, clearLastUser, type LastUser } from '@/lib/auth-service'

export function useLastUser() {
  const [lastUser, setLastUser] = useState<LastUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLastUser = () => {
      try {
        const user = getLastUser()
        setLastUser(user)
      } catch (error) {
        console.error('Erro ao carregar último usuário:', error)
        setLastUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadLastUser()
  }, [])

  const removeLastUser = () => {
    clearLastUser()
    setLastUser(null)
  }

  const refreshLastUser = () => {
    const user = getLastUser()
    setLastUser(user)
  }

  return {
    lastUser,
    isLoading,
    removeLastUser,
    refreshLastUser
  }
}
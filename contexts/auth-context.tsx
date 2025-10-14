"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  signInWithEmail, 
  signUpWithEmail, 
  signInWithGoogle,
  signOutUser, 
  onAuthStateChange,
  User 
} from '@/lib/auth-service'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const user = await signInWithEmail(email, password)
      setUser(user)
    } catch (error: any) {
      throw new Error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const user = await signUpWithEmail(name, email, password)
      setUser(user)
    } catch (error: any) {
      throw new Error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    setIsLoading(true)
    try {
      const user = await signInWithGoogle()
      setUser(user)
    } catch (error: any) {
      throw new Error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await signOutUser()
      setUser(null)
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    signInWithGoogle: handleSignInWithGoogle,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
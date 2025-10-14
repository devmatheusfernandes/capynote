import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export interface User {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
}

export interface LastUser {
  name: string;
  email: string;
  photoURL?: string;
  lastLoginAt: string;
}

// Convert Firebase User to our User interface
export const convertFirebaseUser = (firebaseUser: FirebaseUser): User => {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || "",
    name:
      firebaseUser.displayName ||
      firebaseUser.email?.split("@")[0] ||
      "Usuário",
    photoURL: firebaseUser.photoURL || undefined,
  };
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = convertFirebaseUser(result.user);
    saveLastUser(user);
    return user;
  } catch (error: unknown) {
    console.error("Erro ao fazer login com Google:", error);
    const message =
      error instanceof Error
        ? getAuthErrorMessage(error.message)
        : "Erro ao fazer login com Google";
    throw new Error(message);
  }
};

// Sign in with email and password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = convertFirebaseUser(result.user);
    saveLastUser(user);
    return user;
  } catch (error: unknown) {
    console.error("Erro ao fazer login:", error);
    const message =
      error instanceof Error
        ? getAuthErrorMessage(error.message)
        : "Erro ao fazer login";
    throw new Error(message);
  }
};

// Sign up with email and password
export const signUpWithEmail = async (
  name: string,
  email: string,
  password: string
): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Update the user's display name
    await updateProfile(result.user, {
      displayName: name,
    });

    const user = convertFirebaseUser(result.user);
    saveLastUser(user);
    return user;
  } catch (error: unknown) {
    console.error("Erro ao criar conta:", error);
    const message =
      error instanceof Error
        ? getAuthErrorMessage(error.message)
        : "Erro ao criar conta";
    throw new Error(message);
  }
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: unknown) {
    console.error("Erro ao fazer logout:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao fazer logout";
    throw new Error(message);
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      callback(convertFirebaseUser(firebaseUser));
    } else {
      callback(null);
    }
  });
};

// Get current user
export const getCurrentUser = (): User | null => {
  const firebaseUser = auth.currentUser;
  return firebaseUser ? convertFirebaseUser(firebaseUser) : null;
};

// Save last user info to localStorage
export const saveLastUser = (user: User): void => {
  try {
    const lastUser: LastUser = {
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
      lastLoginAt: new Date().toISOString(),
    };
    localStorage.setItem("lastUser", JSON.stringify(lastUser));
  } catch (error) {
    console.error("Erro ao salvar último usuário:", error);
  }
};

// Get last user info from localStorage
export const getLastUser = (): LastUser | null => {
  try {
    const lastUserData = localStorage.getItem("lastUser");
    return lastUserData ? JSON.parse(lastUserData) : null;
  } catch (error) {
    console.error("Erro ao recuperar último usuário:", error);
    return null;
  }
};

// Clear last user info from localStorage
export const clearLastUser = (): void => {
  try {
    localStorage.removeItem("lastUser");
  } catch (error) {
    console.error("Erro ao limpar último usuário:", error);
  }
};

// Helper function to get user-friendly error messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case "auth/user-disabled":
      return "Esta conta foi desabilitada.";
    case "auth/user-not-found":
      return "Usuário não encontrado.";
    case "auth/wrong-password":
      return "Senha incorreta.";
    case "auth/email-already-in-use":
      return "Este email já está sendo usado por outra conta.";
    case "auth/weak-password":
      return "A senha deve ter pelo menos 6 caracteres.";
    case "auth/invalid-email":
      return "Email inválido.";
    case "auth/operation-not-allowed":
      return "Operação não permitida.";
    case "auth/popup-closed-by-user":
      return "Login cancelado pelo usuário.";
    case "auth/popup-blocked":
      return "Popup bloqueado pelo navegador. Permita popups para este site.";
    case "auth/cancelled-popup-request":
      return "Solicitação de popup cancelada.";
    case "auth/network-request-failed":
      return "Erro de conexão. Verifique sua internet.";
    default:
      return "Erro inesperado. Tente novamente.";
  }
};

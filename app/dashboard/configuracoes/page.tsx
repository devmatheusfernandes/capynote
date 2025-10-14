"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trash2, Tag } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  query,
  where,
  getDocs,
  updateDoc,
  arrayRemove,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { TagData } from "@/types";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>("09:00");
  const [notificationsEnabled, setNotificationsEnabled] =
    useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Assinar tags do Firestore por usuário
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const tagsRef = collection(db, "users", userId, "tags");
    const unsubscribe = onSnapshot(tagsRef, (snapshot) => {
      const tags: TagData[] = snapshot.docs.map((d) => {
        const data = d.data() as TagData;
        return {
          id: d.id,
          name: data.name || d.id,
          createdAt: data.createdAt
            ? String(data.createdAt)
            : new Date().toISOString(),
          updatedAt: data.updatedAt
            ? String(data.updatedAt)
            : new Date().toISOString(),
          color: data.color,
        };
      });
      setAvailableTags(tags);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Ler configurações do usuário (horário padrão e notificações)
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const settingsRef = doc(db, "users", userId, "meta", "settings");
    const unsub = onSnapshot(settingsRef, (snap) => {
      const data = snap.data() as
        | { defaultTaskTime?: string; notificationsEnabled?: boolean }
        | undefined;
      if (data?.defaultTaskTime) setDefaultTaskTime(data.defaultTaskTime);
      if (typeof data?.notificationsEnabled === "boolean")
        setNotificationsEnabled(data.notificationsEnabled);
    });
    setPermission(
      typeof Notification !== "undefined" ? Notification.permission : "default"
    );
    return () => unsub();
  }, [user?.id]);

  const saveDefaultTaskTime = async (value: string) => {
    if (!user?.id) return;
    setDefaultTaskTime(value);
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    await setDoc(
      settingsRef,
      { defaultTaskTime: value, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  };

  const toggleNotifications = async () => {
    if (!user?.id) return;
    // Request permission if not granted
    let granted = permission === "granted";
    if (!granted && typeof Notification !== "undefined") {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        granted = result === "granted";
      } catch (error: unknown) {
        granted = false;
        const message = error;
        console.log(message);
      }
    }
    const nextEnabled = granted ? !notificationsEnabled : false;
    setNotificationsEnabled(nextEnabled);
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    await setDoc(
      settingsRef,
      {
        notificationsEnabled: nextEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const testNotification = async () => {
    // Solicitar permissão se necessário
    let currentPermission: NotificationPermission =
      typeof Notification !== "undefined" ? Notification.permission : "default";
    if (
      currentPermission === "default" &&
      typeof Notification !== "undefined"
    ) {
      try {
        const res = await Notification.requestPermission();
        setPermission(res);
        currentPermission = res;
      } catch (error: unknown) {
        const message = error;
        console.log(message);
      }
    }
    if (currentPermission !== "granted") {
      return;
    }
    console.log("currentPermission", currentPermission);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const title = "Testando notificação";
      const options: NotificationOptions = {
        body: "Esta é uma notificação de teste.",
        tag: "test-notification",
        data: { url: "/dashboard/tarefas" },
        requireInteraction: false,
        icon: "/adaptive-icon.png",
      };
      console.log("reg", reg);
      if (reg?.active) {
        reg.active.postMessage({
          type: "notify",
          payload: { title, options },
        });
      } else if (reg) {
        reg.showNotification(title, options);
      } else if (typeof Notification !== "undefined") {
        new Notification(title, options);
      }
      console.log("Notificação exibida com sucesso");
    } catch (error: unknown) {
      const message = error;
      console.log(message);
    }
  };

  // Delete tag
  const deleteTag = async (tagToDeleteId: string) => {
    const userId = user?.id;
    if (!userId) return;

    // Deletar documento da tag
    const tagRef = doc(db, "users", userId, "tags", tagToDeleteId);
    await deleteDoc(tagRef);

    // Remover tag de todas as notas que a possuem
    const notesRef = collection(db, "users", userId, "notes");
    const notesWithTagIdQuery = query(
      notesRef,
      where("tagIds", "array-contains", tagToDeleteId)
    );
    const notesWithTagIdSnapshot = await getDocs(notesWithTagIdQuery);
    const tagName = availableTags.find((t) => t.id === tagToDeleteId)?.name;
    const notesWithTagNameSnapshot = tagName
      ? await getDocs(query(notesRef, where("tags", "array-contains", tagName)))
      : { docs: [] as TagData[] };

    const updatePromises = [
      ...notesWithTagIdSnapshot.docs.map((noteDoc) => {
        const noteRef = doc(db, "users", userId, "notes", noteDoc.id);
        return updateDoc(noteRef, {
          tagIds: arrayRemove(tagToDeleteId),
          updatedAt: serverTimestamp(),
        });
      }),
      ...notesWithTagNameSnapshot.docs.map((noteDoc) => {
        const noteRef = doc(db, "users", userId, "notes", noteDoc.id);
        return updateDoc(noteRef, {
          tags: arrayRemove(tagName!),
          updatedAt: serverTimestamp(),
        });
      }),
    ];

    await Promise.all(updatePromises);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie suas preferências e configurações da aplicação."
      />

      <Separator />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Tags</CardTitle>
            <CardDescription>
              Visualize e gerencie todas as suas tags. Deletar uma tag a
              removerá de todas as notas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableTags.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma tag encontrada</p>
                <p className="text-sm text-muted-foreground">
                  Tags são criadas automaticamente quando você as adiciona às
                  suas notas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {availableTags.length} tag
                  {availableTags.length !== 1 ? "s" : ""} encontrada
                  {availableTags.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {tag.name}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar tag</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja deletar a tag {tag.name}?
                              Esta ação removerá a tag de todas as notas e não
                              pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTag(tag.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Deletar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>
              Personalize a aparência da aplicação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Tema</label>
                <p className="text-sm text-muted-foreground">
                  Escolha entre tema claro e escuro.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conta</CardTitle>
            <CardDescription>
              Informações da sua conta e preferências.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <p className="text-sm text-muted-foreground">
                Seu email está sendo usado para login e notificações.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>
              Configure como você quer receber notificações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notificações Push</label>
              <p className="text-sm text-muted-foreground">
                Ative para receber lembretes das tarefas na data e horário.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant={notificationsEnabled ? "default" : "outline"}
                  onClick={toggleNotifications}
                >
                  {notificationsEnabled ? "Desativar" : "Ativar"} notificações
                </Button>
                <Button variant="secondary" onClick={testNotification}>
                  Testar notificação
                </Button>
                <span className="text-xs text-muted-foreground">
                  Permissão: {permission}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Horário padrão para tarefas com apenas data
              </label>
              <p className="text-sm text-muted-foreground">
                Usado quando você define apenas a data da tarefa.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={defaultTaskTime}
                  onChange={(e) => saveDefaultTaskTime(e.target.value)}
                  className="max-w-[160px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

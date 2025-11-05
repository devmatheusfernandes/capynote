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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parseJSONFile,
  mergeNotes,
  mergeFolders,
  mergeTags,
  BackupPayload,
} from "@/lib/import-utils";
import { NoteData, FolderData } from "@/types";
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
import { driveBackupNow } from "@/lib/drive-backup";
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
import { toast } from "sonner";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>("09:00");
  const [notificationsEnabled, setNotificationsEnabled] =
    useState<boolean>(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>();
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupIntervalHours, setBackupIntervalHours] = useState<number>(24);
  const [backupPreferredTime, setBackupPreferredTime] = useState<string>("");
  const [showBibleOnDashboard, setShowBibleOnDashboard] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const restoreFileInputRef = React.useRef<HTMLInputElement>(null);

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
        | {
            defaultTaskTime?: string;
            notificationsEnabled?: boolean;
            autoBackupEnabled?: boolean;
            lastBackupAt?: string;
            backupIntervalHours?: number;
            backupPreferredTime?: string;
            showBibleOnDashboard?: boolean;
          }
        | undefined;
      if (data?.defaultTaskTime) setDefaultTaskTime(data.defaultTaskTime);
      if (typeof data?.notificationsEnabled === "boolean")
        setNotificationsEnabled(data.notificationsEnabled);
      if (typeof data?.autoBackupEnabled === "boolean")
        setAutoBackupEnabled(data.autoBackupEnabled);
      if (typeof data?.lastBackupAt === "string")
        setLastBackupAt(data.lastBackupAt);
      if (typeof data?.backupIntervalHours === "number")
        setBackupIntervalHours(data.backupIntervalHours);
      if (typeof data?.backupPreferredTime === "string")
        setBackupPreferredTime(data.backupPreferredTime);
      if (typeof data?.showBibleOnDashboard === "boolean")
        setShowBibleOnDashboard(data.showBibleOnDashboard);
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

  const toggleShowBibleOnDashboard = async (next: boolean) => {
    if (!user?.id) return;
    setShowBibleOnDashboard(next);
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    await setDoc(
      settingsRef,
      { showBibleOnDashboard: next, updatedAt: new Date().toISOString() },
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

  const toggleAutoBackup = async () => {
    if (!user?.id) return;
    const nextEnabled = !autoBackupEnabled;
    setAutoBackupEnabled(nextEnabled);
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    await setDoc(
      settingsRef,
      {
        autoBackupEnabled: nextEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const handleBackupNow = async () => {
    if (!user?.id) return;
    try {
      setIsBackingUp(true);
      toast.loading("Iniciando backup para o Google Drive...", {
        id: "drive-backup",
      });
      const res = await driveBackupNow(user.id);
      if (res.success && res.lastBackupAt) {
        setLastBackupAt(res.lastBackupAt);
        toast.success("Backup realizado com sucesso no Google Drive!", {
          id: "drive-backup",
        });
      } else {
        const msg = res.error || "Falha ao realizar backup no Google Drive.";
        toast.error(msg, { id: "drive-backup" });
      }
    } catch (error) {
      const msg = (error as unknown as Error)?.message || String(error);
      toast.error(msg, { id: "drive-backup" });
    } finally {
      setIsBackingUp(false);
    }
  };

  const triggerRestoreFile = () => {
    restoreFileInputRef.current?.click();
  };

  const onRestoreFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    try {
      const text = await file.text();
      const parsed = parseJSONFile(text) as BackupPayload;
      const incomingNotes: NoteData[] = parsed.notes || [];
      const incomingFolders: FolderData[] = parsed.folders || [];
      const incomingTags: TagData[] = parsed.tags || [];

      // Fetch current data to merge
      const [notesSnap, foldersSnap, tagsSnap] = await Promise.all([
        getDocs(collection(db, "users", user.id, "notes")),
        getDocs(collection(db, "users", user.id, "folders")),
        getDocs(collection(db, "users", user.id, "tags")),
      ]);
      const currentNotes: NoteData[] = notesSnap.docs.map(
        (d) => d.data() as NoteData
      );
      const currentFolders: FolderData[] = foldersSnap.docs.map(
        (d) => d.data() as FolderData
      );
      const currentTags: TagData[] = tagsSnap.docs.map((d) => {
        const t = d.data() as TagData;
        return {
          id: t.id || d.id,
          name: t.name || d.id,
          createdAt: t.createdAt
            ? String(t.createdAt)
            : new Date().toISOString(),
          updatedAt: t.updatedAt
            ? String(t.updatedAt)
            : new Date().toISOString(),
          color: t.color,
        };
      });

      const mergedNotes = mergeNotes(currentNotes, incomingNotes);
      const mergedFolders = mergeFolders(currentFolders, incomingFolders);
      const mergedTags = mergeTags(currentTags, incomingTags);

      await Promise.all(
        mergedFolders.map((f) => {
          const payload = Object.fromEntries(
            Object.entries(f).filter(([, v]) => v !== undefined)
          );
          return setDoc(doc(db, "users", user.id, "folders", f.id), payload, {
            merge: true,
          });
        })
      );
      await Promise.all(
        mergedTags.map((t) => {
          const payload = Object.fromEntries(
            Object.entries(t).filter(([, v]) => v !== undefined)
          );
          return setDoc(doc(db, "users", user.id, "tags", t.id), payload, {
            merge: true,
          });
        })
      );
      await Promise.all(
        mergedNotes.map((n) => {
          const payload = Object.fromEntries(
            Object.entries(n).filter(([, v]) => v !== undefined)
          );
          return setDoc(doc(db, "users", user.id, "notes", n.id), payload, {
            merge: true,
          });
        })
      );
      toast.success("Backup restaurado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao restaurar backup. Verifique o arquivo.");
    }
    e.target.value = "";
  };

  const changeBackupInterval = async (value: string) => {
    if (!user?.id) return;
    const hours = Number(value);
    if (Number.isNaN(hours) || hours <= 0) return;
    setBackupIntervalHours(hours);
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    await setDoc(
      settingsRef,
      { backupIntervalHours: hours, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    toast.success("Período de backup atualizado");
  };

  const saveBackupPreferredTime = async (value: string) => {
    if (!user?.id) return;
    setBackupPreferredTime(value);
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    await setDoc(
      settingsRef,
      { backupPreferredTime: value, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    toast.success("Horário preferido de backup atualizado");
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
    <div className="space-y-4 sm:space-y-6 container sm:p-6 p-4 sm:max-w-[80vw] max-w-[100vw]">
      <PageHeader
        title="Configurações"
        description="Gerencie suas preferências e configurações da aplicação."
      />

      <Separator />

      <div className="grid gap-4 sm:gap-6">
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
              <div className="text-center py-6 sm:py-8">
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
                      <Badge
                        variant="secondary"
                        className="px-2 py-1 text-xs sm:text-sm"
                      >
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
            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
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
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>Escolha o que aparece no dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Mostrar Bíblia no Dashboard</label>
                <p className="text-sm text-muted-foreground">
                  Exibe um card de acesso rápido à Bíblia na página inicial.
                </p>
              </div>
              <Checkbox
                checked={showBibleOnDashboard}
                onCheckedChange={(v) => toggleShowBibleOnDashboard(Boolean(v))}
              />
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  className="w-full sm:w-auto"
                  variant={notificationsEnabled ? "default" : "outline"}
                  onClick={toggleNotifications}
                >
                  {notificationsEnabled ? "Desativar" : "Ativar"} notificações
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={testNotification}
                >
                  Testar notificação
                </Button>
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Input
                  type="time"
                  value={defaultTaskTime}
                  onChange={(e) => saveDefaultTaskTime(e.target.value)}
                  className="w-full sm:max-w-[160px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup no Google Drive</CardTitle>
            <CardDescription>
              Faça backup manual ou habilite backup automático diário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status do backup</label>
              <div className="flex items-center gap-2">
                {lastBackupAt ? (
                  <Badge variant="secondary">
                    Último backup: {new Date(lastBackupAt).toLocaleString()}
                  </Badge>
                ) : (
                  <Badge variant="outline">Nunca realizado</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                className="w-full sm:w-auto"
                onClick={handleBackupNow}
                disabled={isBackingUp}
              >
                {isBackingUp ? "Realizando backup..." : "Fazer backup agora"}
              </Button>
              <Button
                className="w-full sm:w-auto"
                variant={autoBackupEnabled ? "default" : "outline"}
                onClick={toggleAutoBackup}
              >
                {autoBackupEnabled ? "Desativar" : "Ativar"} backup automático
              </Button>
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={triggerRestoreFile}
              >
                Restaurar backup
              </Button>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">
                Agendamento do backup
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Período</span>
                  <Select
                    value={String(backupIntervalHours)}
                    onValueChange={changeBackupInterval}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">A cada 12 horas</SelectItem>
                      <SelectItem value="24">A cada 24 horas</SelectItem>
                      <SelectItem value="48">A cada 48 horas</SelectItem>
                      <SelectItem value="168">Semanal (168 horas)</SelectItem>
                      <SelectItem value="336">Quinzenal (336 horas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">
                    Horário preferido
                  </span>
                  <Input
                    type="time"
                    value={backupPreferredTime || ""}
                    onChange={(e) => saveBackupPreferredTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O backup automático será tentado próximo ao horário preferido,
                dentro de uma janela de 30 minutos. Se o app estiver fechado,
                será realizado na próxima execução.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <input
        ref={restoreFileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onRestoreFileChange}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Maximize2,
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  Flag,
  Save,
  Repeat,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateSuggestion } from "@/components/highlighted-text";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useDateDetection } from "@/hooks/use-date-detection";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask?: TaskData | null;
}

interface Subtask {
  id: string;
  title: string;
  status: "pendente" | "concluida";
  createdAt: string;
  updatedAt: string;
}

interface TaskData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em-progresso" | "concluida";
  dueDate?: string;
  dueTime?: string;
  createdAt: string;
  updatedAt: string;
  // Campos de repetição
  isRecurring?: boolean;
  recurringType?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  recurringInterval?: number; // Para intervalos customizados (ex: a cada 2 dias)
  recurringDays?: string[]; // Para repetições semanais (ex: ["monday", "wednesday", "friday"])
  recurringEndDate?: string; // Data final da repetição
  recurringEndCount?: number; // Número de ocorrências
  excludedDates?: string[]; // Datas excluídas da repetição
  subtasks?: Subtask[]; // Subtarefas vinculadas
}

export function TaskDrawer({
  open,
  onOpenChange,
  editingTask,
}: TaskDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<"baixa" | "media" | "alta">("baixa");
  const [status, setStatus] = useState<
    "pendente" | "em-progresso" | "concluida"
  >("pendente");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [taskId, setTaskId] = useState(
    () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [defaultTaskTime, setDefaultTaskTime] = useState<string>("09:00");

  // Estados para repetição
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<
    "daily" | "weekly" | "monthly" | "yearly" | "custom"
  >("daily");
  const [recurringInterval, setRecurringInterval] = useState(1);
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [recurringEndCount, setRecurringEndCount] = useState<
    number | undefined
  >();

  // Subtarefas
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  // Estado do timepicker
  const [timeHour, setTimeHour] = useState<string>("");
  const [timeMinute, setTimeMinute] = useState<string>("");
  useEffect(() => {
    const base = dueTime || defaultTaskTime || "09:00";
    const [h, m] = base.split(":");
    setTimeHour(h?.padStart(2, "0") || "09");
    setTimeMinute(m?.padStart(2, "0") || "00");
  }, [dueTime, defaultTaskTime]);

  // Ler horário padrão do usuário nas configurações
  useEffect(() => {
    if (!user?.id) return;
    const settingsRef = doc(db, "users", user.id, "meta", "settings");
    const unsub = onSnapshot(settingsRef, (snap) => {
      const data = snap.data() as { defaultTaskTime?: string } | undefined;
      if (data?.defaultTaskTime) setDefaultTaskTime(data.defaultTaskTime);
    });
    return () => unsub();
  }, [user?.id]);

  // Effect to populate fields when editing a task
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setTags(editingTask.tags);
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setDueDate(editingTask.dueDate || "");
      setDueTime(editingTask.dueTime || "");
      setTaskId(editingTask.id);
      setIsRecurring(editingTask.isRecurring || false);
      setRecurringType(editingTask.recurringType || "daily");
      setRecurringInterval(editingTask.recurringInterval || 1);
      setRecurringDays(editingTask.recurringDays || []);
      setRecurringEndDate(editingTask.recurringEndDate || "");
      setRecurringEndCount(editingTask.recurringEndCount);
      setSubtasks(
        Array.isArray(editingTask.subtasks) ? editingTask.subtasks : []
      );
      setHasChanges(false);
    } else {
      // Reset form when not editing
      setTitle("");
      setDescription("");
      setTags([]);
      setPriority("media");
      setStatus("pendente");
      setDueDate("");
      setDueTime("");
      setTaskId(
        `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );
      setIsRecurring(false);
      setRecurringType("daily");
      setRecurringInterval(1);
      setRecurringDays([]);
      setRecurringEndDate("");
      setRecurringEndCount(undefined);
      setSubtasks([]);
      setHasChanges(false);
    }
  }, [editingTask]);

  // Date detection for title and description
  const titleDateDetection = useDateDetection(
    title,
    (date) => {
      const dateString = date.toISOString().split("T")[0];
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      setDueDate(dateString);
      // Only set time if it's not the default 00:00
      if (timeString !== "00:00") {
        setDueTime(timeString);
      }
      setHasChanges(true);
    },
    { minConfidence: 0.8 }
  );

  const descriptionDateDetection = useDateDetection(
    description,
    (date) => {
      const dateString = date.toISOString().split("T")[0];
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      setDueDate(dateString);
      // Only set time if it's not the default 00:00
      if (timeString !== "00:00") {
        setDueTime(timeString);
      }
      setHasChanges(true);
    },
    { minConfidence: 0.7 }
  );

  // Manual save functionality
  const saveTask = useCallback(() => {
    if (!title.trim()) return;

    // Validações para repetição
    if (isRecurring) {
      // Se é semanal, deve ter pelo menos um dia selecionado
      if (recurringType === "weekly" && recurringDays.length === 0) {
        alert("Para repetição semanal, selecione pelo menos um dia da semana.");
        return;
      }

      // Se tem data de fim e contagem, priorizar data de fim
      if (recurringEndDate && recurringEndCount) {
        setRecurringEndCount(undefined);
      }
    }

    const effectiveDueTime = (() => {
      if (dueDate && !dueTime) return defaultTaskTime || "09:00";
      return dueTime || undefined;
    })();

    const taskData: TaskData = {
      id: taskId,
      title: title.trim(),
      description: description.trim(),
      tags,
      priority,
      status,
      dueDate: dueDate || undefined,
      dueTime: effectiveDueTime,
      // Preserva createdAt quando editando uma tarefa existente
      createdAt: editingTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Dados de repetição
      isRecurring,
      recurringType: isRecurring ? recurringType : undefined,
      recurringInterval:
        isRecurring && recurringType === "custom"
          ? recurringInterval
          : undefined,
      recurringDays:
        isRecurring && recurringType === "weekly" ? recurringDays : undefined,
      recurringEndDate:
        isRecurring && recurringEndDate ? recurringEndDate : undefined,
      recurringEndCount:
        isRecurring && recurringEndCount && !recurringEndDate
          ? recurringEndCount
          : undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    };

    // Save to Firestore: users/{userId}/tasks/{taskId}
    if (!user?.id) {
      console.warn("Usuário não autenticado; não é possível salvar a tarefa.");
      return;
    }
    const taskRef = doc(db, "users", user.id, "tasks", taskId);
    // Remove campos undefined para evitar erro do Firestore
    const payload = Object.fromEntries(
      Object.entries(taskData).filter(([, v]) => v !== undefined)
    );
    // Usa merge para preservar campos existentes (ex.: excludedDates)
    setDoc(taskRef, payload, { merge: true });

    setHasChanges(false);
  }, [
    title,
    description,
    tags,
    priority,
    status,
    dueDate,
    dueTime,
    taskId,
    isRecurring,
    recurringType,
    recurringInterval,
    recurringDays,
    recurringEndDate,
    recurringEndCount,
    user?.id,
    editingTask?.createdAt,
    subtasks,
    defaultTaskTime,
  ]);

  // Generate new task ID when drawer opens
  useEffect(() => {
    // Só gera novo ID quando criando uma tarefa nova
    if (open && !editingTask) {
      setTaskId(
        `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );
    }
  }, [open, editingTask]);

  // Handle content changes
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      setHasChanges(true);
    },
    []
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
      setHasChanges(true);
    },
    []
  );

  const handlePriorityChange = useCallback(
    (newPriority: "baixa" | "media" | "alta") => {
      setPriority(newPriority);
      setHasChanges(true);
    },
    []
  );

  const handleStatusChange = useCallback(
    (newStatus: "pendente" | "em-progresso" | "concluida") => {
      setStatus(newStatus);
      setHasChanges(true);
    },
    []
  );

  // const handleDueDateChange = useCallback(
  //   (e: React.ChangeEvent<HTMLInputElement>) => {
  //     setDueDate(e.target.value);
  //     setHasChanges(true);
  //   },
  //   []
  // );

  // const handleDueTimeChange = useCallback(
  //   (e: React.ChangeEvent<HTMLInputElement>) => {
  //     setDueTime(e.target.value);
  //     setHasChanges(true);
  //   },
  //   []
  // );

  // Handlers para repetição
  const handleRecurringToggle = useCallback((checked: boolean) => {
    setIsRecurring(checked);
    setHasChanges(true);
  }, []);

  const handleRecurringTypeChange = useCallback(
    (type: "daily" | "weekly" | "monthly" | "yearly" | "custom") => {
      setRecurringType(type);
      // Reset related fields when type changes
      if (type !== "weekly") {
        setRecurringDays([]);
      }
      if (type !== "custom") {
        setRecurringInterval(1);
      }
      setHasChanges(true);
    },
    []
  );

  const handleRecurringIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 1;
      setRecurringInterval(Math.max(1, value));
      setHasChanges(true);
    },
    []
  );

  const handleRecurringDaysChange = useCallback((days: string[]) => {
    setRecurringDays(days);
    setHasChanges(true);
  }, []);

  const handleRecurringEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRecurringEndDate(e.target.value);
      setHasChanges(true);
    },
    []
  );

  const handleRecurringEndCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value ? parseInt(e.target.value) : undefined;
      setRecurringEndCount(value);
      setHasChanges(true);
    },
    []
  );

  // Subtasks handlers
  const addSubtask = useCallback(() => {
    const now = new Date().toISOString();
    const newSubtask: Subtask = {
      id: `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: "",
      status: "pendente",
      createdAt: now,
      updatedAt: now,
    };
    setSubtasks((prev) => [...prev, newSubtask]);
    setHasChanges(true);
  }, []);

  const updateSubtaskTitle = useCallback((id: string, title: string) => {
    setSubtasks((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s
      )
    );
    setHasChanges(true);
  }, []);

  // const toggleSubtask = useCallback((id: string, checked: boolean) => {
  //   setSubtasks((prev) =>
  //     prev.map((s) =>
  //       s.id === id
  //         ? {
  //             ...s,
  //             status: checked ? "concluida" : "pendente",
  //             updatedAt: new Date().toISOString(),
  //           }
  //         : s
  //     )
  //   );
  //   setHasChanges(true);
  // }, []);

  const removeSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    setHasChanges(true);
  }, []);

  // Handle drawer close
  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state after a delay to allow drawer animation
    setTimeout(() => {
      setTitle("");
      setDescription("");
      setTags([]);
      setPriority("media");
      setStatus("pendente");
      setDueDate("");
      setDueTime("");
      setHasChanges(false);
      // Reset repetição
      setIsRecurring(false);
      setRecurringType("daily");
      setRecurringInterval(1);
      setRecurringDays([]);
      setRecurringEndDate("");
      setRecurringEndCount(undefined);
      setSubtasks([]);
    }, 300);
  }, [onOpenChange]);

  // Handle discard - show confirmation dialog
  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(true);
  }, []);

  // Confirm discard
  const confirmDiscard = useCallback(() => {
    // Remove from Firestore if it exists
    if (user?.id) {
      const taskRef = doc(db, "users", user.id, "tasks", taskId);
      deleteDoc(taskRef);
    }

    setShowDiscardDialog(false);
    onOpenChange(false);
    // Reset state
    setTimeout(() => {
      setTitle("");
      setDescription("");
      setTags([]);
      setPriority("media");
      setStatus("pendente");
      setDueDate("");
      setDueTime("");
      setHasChanges(false);
      // Reset repetição
      setIsRecurring(false);
      setRecurringType("daily");
      setRecurringInterval(1);
      setRecurringDays([]);
      setRecurringEndDate("");
      setRecurringEndCount(undefined);
      setSubtasks([]);
    }, 300);
  }, [taskId, onOpenChange, user?.id]);

  // Handle manual save
  const handleManualSave = useCallback(() => {
    saveTask();
  }, [saveTask]);

  // Handle expand to fullscreen
  const handleExpand = useCallback(() => {
    // Navigate to fullscreen editor with the task ID
    router.push(`/dashboard/tarefas/editar/${taskId}`);
    onOpenChange(false);
  }, [router, taskId, onOpenChange]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta":
        return "text-red-600";
      case "media":
        return "text-yellow-600";
      case "baixa":
        return "text-teal-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluida":
        return "text-teal-600";
      case "em-progresso":
        return "text-primary";
      case "pendente":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  // Função para gerar resumo da repetição
  const getRecurringSummary = () => {
    if (!isRecurring) return "";

    let summary = "";

    switch (recurringType) {
      case "daily":
        summary = "Todos os dias";
        break;
      case "weekly":
        if (recurringDays.length > 0) {
          const dayNames = {
            sunday: "Dom",
            monday: "Seg",
            tuesday: "Ter",
            wednesday: "Qua",
            thursday: "Qui",
            friday: "Sex",
            saturday: "Sáb",
          };
          const selectedDays = recurringDays
            .map((day) => dayNames[day as keyof typeof dayNames])
            .join(", ");
          summary = `Toda semana: ${selectedDays}`;
        } else {
          summary = "Semanalmente";
        }
        break;
      case "monthly":
        summary = "Mensalmente";
        break;
      case "yearly":
        summary = "Anualmente";
        break;
      case "custom":
        summary = `A cada ${recurringInterval} dia${
          recurringInterval > 1 ? "s" : ""
        }`;
        break;
    }

    if (recurringEndDate) {
      summary += ` até ${new Date(recurringEndDate).toLocaleDateString(
        "pt-BR"
      )}`;
    } else if (recurringEndCount) {
      summary += ` por ${recurringEndCount} vezes`;
    }

    return summary;
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="h-[85vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-left">Nova Tarefa</DrawerTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpand}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualSave}
                className="h-8 w-8 p-0 text-teal-600 hover:text-teal-700"
                disabled={!hasChanges}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 flex flex-col p-4 overflow-auto">
          {/* Title Input */}
          <div className="flex-shrink-0 mb-4">
            <div className="relative flex flex-row gap-2">
              <Input
                placeholder="Eu preciso..."
                value={title}
                onChange={handleTitleChange}
                className="text-md font-regular border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {titleDateDetection.hasSuggestion &&
                titleDateDetection.suggestion &&
                !dueDate && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-background border rounded-md shadow-md z-10">
                    <DateSuggestion
                      suggestion={titleDateDetection.suggestion}
                      onApply={(date) => {
                        if (date) {
                          const dateString = date.toISOString().split("T")[0];
                          setDueDate(dateString);
                          setHasChanges(true);
                        }
                        titleDateDetection.applySuggestion();
                      }}
                      onDismiss={titleDateDetection.dismissSuggestion}
                    />
                  </div>
                )}
              <Button variant="outline" onClick={addSubtask}>
                Adicionar subtarefa
              </Button>
            </div>
            {/* Subtarefas */}
            <div className="flex-shrink-0 mb-2">
              <div className="space-y-2">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex flex-col items-start gap-2 mt-2"
                  >
                    <label className="text-sm font-medium text-muted-foreground block">
                      Subtarefas
                    </label>
                    <div className="flex flex-row gap-2 w-full">
                      <Input
                        value={st.title}
                        onChange={(e) =>
                          updateSubtaskTitle(st.id, e.target.value)
                        }
                        placeholder="Subtarefa aqui..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubtask(st.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Controles rápidos (como botões) — exibidos quando não é recorrente */}
          {!isRecurring && (
            <div className="flex flex-row flex-wrap gap-2 mb-4">
              {/* DatePicker (shadcn) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dueDate
                      ? new Date(dueDate).toLocaleDateString("pt-BR")
                      : "Adicionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePickerCalendar
                    mode="single"
                    selected={
                      dueDate ? new Date(`${dueDate}T00:00:00`) : undefined
                    }
                    onSelect={(date) => {
                      if (date) {
                        const iso = date.toISOString();
                        const dateStr = iso.split("T")[0];
                        setDueDate(dateStr);
                        setHasChanges(true);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* TimePicker (Popover + Select) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start gap-2">
                    <Clock className="h-4 w-4" />
                    {dueTime ? dueTime : "Horário"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-3" align="start">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Selecionar horário
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={timeHour}
                        onValueChange={(v) => {
                          setTimeHour(v);
                          const newTime = `${v}:${timeMinute || "00"}`;
                          setDueTime(newTime);
                          setHasChanges(true);
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Hora" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {Array.from({ length: 24 }, (_, i) => i)
                            .map((h) => h.toString().padStart(2, "0"))
                            .map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">:</span>
                      <Select
                        value={timeMinute}
                        onValueChange={(v) => {
                          setTimeMinute(v);
                          const newTime = `${timeHour || "09"}:${v}`;
                          setDueTime(newTime);
                          setHasChanges(true);
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Minuto" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {[
                            "00",
                            "05",
                            "10",
                            "15",
                            "20",
                            "25",
                            "30",
                            "35",
                            "40",
                            "45",
                            "50",
                            "55",
                          ].map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-between pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDueTime("");
                          setHasChanges(true);
                        }}
                      >
                        Limpar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const finalTime = `${timeHour || "09"}:${
                            timeMinute || "00"
                          }`;
                          setDueTime(finalTime);
                          setHasChanges(true);
                        }}
                      >
                        Definir
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Botão Repetitiva */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleRecurringToggle(true)}
              >
                <Repeat className="h-4 w-4" />
                Repetitiva
              </Button>
            </div>
          )}

          {/* Repetição */}
          <div className="flex-shrink-0 mb-4">
            {/* Resumo da repetição */}
            {isRecurring && getRecurringSummary() && (
              <div className="mb-3 p-2 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  <strong>Repetição:</strong> {getRecurringSummary()}
                </p>
              </div>
            )}

            {isRecurring && (
              <div className="space-y-4 pl-6 border-l-2 border-muted">
                <div className="flex items-center space-x-2 mb-3">
                  <Checkbox
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={handleRecurringToggle}
                  />
                  <label
                    htmlFor="recurring"
                    className="text-sm font-medium text-muted-foreground flex items-center gap-2"
                  >
                    <Repeat className="h-4 w-4" />
                    Tarefa repetitiva
                  </label>
                </div>
                {/* Tipo de repetição */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Tipo de repetição
                  </label>
                  <Select
                    value={recurringType}
                    onValueChange={handleRecurringTypeChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diariamente</SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                      <SelectItem value="monthly">Mensalmente</SelectItem>
                      <SelectItem value="yearly">Anualmente</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Intervalo personalizado */}
                {recurringType === "custom" && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Repetir a cada (dias)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={recurringInterval}
                      onChange={handleRecurringIntervalChange}
                      placeholder="1"
                    />
                  </div>
                )}

                {/* Dias da semana para repetição semanal */}
                {recurringType === "weekly" && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Dias da semana
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { key: "sunday", label: "Dom" },
                        { key: "monday", label: "Seg" },
                        { key: "tuesday", label: "Ter" },
                        { key: "wednesday", label: "Qua" },
                        { key: "thursday", label: "Qui" },
                        { key: "friday", label: "Sex" },
                        { key: "saturday", label: "Sáb" },
                      ].map((day) => (
                        <div
                          key={day.key}
                          className="flex items-center space-x-1"
                        >
                          <Checkbox
                            id={day.key}
                            checked={recurringDays.includes(day.key)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleRecurringDaysChange([
                                  ...recurringDays,
                                  day.key,
                                ]);
                              } else {
                                handleRecurringDaysChange(
                                  recurringDays.filter((d) => d !== day.key)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={day.key}
                            className="text-xs font-medium cursor-pointer"
                          >
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fim da repetição */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Terminar em (data)
                    </label>
                    <Input
                      type="date"
                      value={recurringEndDate}
                      onChange={handleRecurringEndDateChange}
                      min={dueDate || new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Ou após (ocorrências)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={recurringEndCount || ""}
                      onChange={handleRecurringEndCountChange}
                      placeholder="Ex: 10"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Priority and Status */}
          <div className="flex-shrink-0 mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Prioridade
              </label>
              <Select value={priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <Flag
                        className={cn("h-4 w-4", getPriorityColor(priority))}
                      />
                      <span className="capitalize">{priority}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-teal-600" />
                      <span>Baixa</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="media">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-yellow-600" />
                      <span>Média</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="alta">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-red-600" />
                      <span>Alta</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Status
              </label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span className={cn("capitalize", getStatusColor(status))}>
                      {status.replace("_", " ")}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">
                    <span className="text-gray-600">Pendente</span>
                  </SelectItem>
                  <SelectItem value="em-progresso">
                    <span className="text-primary">Em Progresso</span>
                  </SelectItem>
                  <SelectItem value="concluida">
                    <span className="text-teal-600">Concluída</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="flex-1">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Descrição
            </label>
            <div className="relative">
              <Textarea
                placeholder="Descreva os detalhes da tarefa..."
                value={description}
                onChange={handleDescriptionChange}
                className="min-h-[200px] resize-none"
              />
              {descriptionDateDetection.hasSuggestion &&
                descriptionDateDetection.suggestion &&
                !dueDate && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-background border rounded-md shadow-md z-10">
                    <DateSuggestion
                      suggestion={descriptionDateDetection.suggestion}
                      onApply={(date) => {
                        if (date) {
                          const dateString = date.toISOString().split("T")[0];
                          setDueDate(dateString);
                          setHasChanges(true);
                        }
                        descriptionDateDetection.applySuggestion();
                      }}
                      onDismiss={descriptionDateDetection.dismissSuggestion}
                    />
                  </div>
                )}
            </div>
          </div>
        </div>
      </DrawerContent>

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa será permanentemente
              excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}

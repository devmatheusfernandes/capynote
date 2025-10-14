export interface DateParseResult {
  text: string;
  date: Date;
  startIndex: number;
  endIndex: number;
  confidence: number;
  hasTime?: boolean;
  timeText?: string;
}

// Padrões de data em português
const DATE_PATTERNS = [
  // Datas específicas
  {
    pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    parse: (match: RegExpMatchArray) => {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
      const year = parseInt(match[3]);
      return new Date(year, month, day);
    },
    confidence: 0.9,
  },
  {
    pattern: /(\d{1,2})\/(\d{1,2})/g,
    parse: (match: RegExpMatchArray) => {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, day);
    },
    confidence: 0.8,
  },

  // Padrões para horários com datas relativas (devem vir antes dos padrões gerais)
  {
    pattern: /hoje\s+(às|as)\s+(\d{1,2}):?(\d{2})?/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[2]);
      const minute = match[3] ? parseInt(match[3]) : 0;
      const today = new Date();
      today.setHours(hour, minute, 0, 0);
      return today;
    },
    confidence: 1.1,
    hasTime: true,
  },
  {
    pattern: /hoje\s+(\d{1,2}):(\d{2})/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      const today = new Date();
      today.setHours(hour, minute, 0, 0);
      return today;
    },
    confidence: 1.1,
    hasTime: true,
  },
  {
    pattern: /hoje\s+(\d{1,2})h(\d{2})?/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      const today = new Date();
      today.setHours(hour, minute, 0, 0);
      return today;
    },
    confidence: 1.1,
    hasTime: true,
  },
  {
    pattern: /(amanhã|amanha)\s+(às|as)\s+(\d{1,2}):?(\d{2})?/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[3]);
      const minute = match[4] ? parseInt(match[4]) : 0;

      // Validar horário válido
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error("Horário inválido");
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);
      return tomorrow;
    },
    confidence: 1.5,
    hasTime: true,
  },
  {
    pattern: /(amanhã|amanha)\s+(\d{1,2}):(\d{2})/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[2]);
      const minute = parseInt(match[3]);

      // Validar horário válido
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error("Horário inválido");
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);
      return tomorrow;
    },
    confidence: 1.5,
    hasTime: true,
  },
  {
    pattern: /(amanhã|amanha)\s+(\d{1,2})h(\d{2})?/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[2]);
      const minute = match[3] ? parseInt(match[3]) : 0;

      // Validar horário válido
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error("Horário inválido");
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);
      return tomorrow;
    },
    confidence: 1.5,
    hasTime: true,
  },

  // Datas relativas (padrões gerais)
  {
    pattern: /hoje/gi,
    parse: () => new Date(),
    confidence: 1.0,
  },
  {
    pattern: /amanhã/gi,
    parse: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    },
    confidence: 1.0,
  },
  {
    pattern: /depois de amanhã/gi,
    parse: () => {
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      return dayAfterTomorrow;
    },
    confidence: 1.0,
  },

  // Dias da semana
  {
    pattern: /próxima?\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[1].toLowerCase() as keyof typeof weekdays];
      return getNextWeekday(targetDay);
    },
    confidence: 0.9,
  },
  {
    pattern: /(segunda|terça|quarta|quinta|sexta|sábado|domingo)/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[1].toLowerCase() as keyof typeof weekdays];
      return getNextWeekday(targetDay);
    },
    confidence: 0.7,
  },

  // Períodos relativos
  {
    pattern: /em\s+(\d+)\s+dias?/gi,
    parse: (match: RegExpMatchArray) => {
      const days = parseInt(match[1]);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return futureDate;
    },
    confidence: 0.9,
  },
  {
    pattern: /em\s+(\d+)\s+semanas?/gi,
    parse: (match: RegExpMatchArray) => {
      const weeks = parseInt(match[1]);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + weeks * 7);
      return futureDate;
    },
    confidence: 0.9,
  },

  // Expressões específicas adicionais
  {
    pattern: /semana\s+que\s+vem/gi,
    parse: () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    },
    confidence: 1.0,
  },
  {
    pattern: /(na\s+)?próxima\s+semana/gi,
    parse: () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    },
    confidence: 1.0,
  },
  {
    pattern: /depois\s+de\s+amanhã/gi,
    parse: () => {
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      return dayAfterTomorrow;
    },
    confidence: 1.0,
  },
  {
    pattern: /em\s+quinze\s+dias/gi,
    parse: () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      return futureDate;
    },
    confidence: 1.0,
  },
  {
    pattern:
      /(na\s+)?próxima\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[2].toLowerCase() as keyof typeof weekdays];
      const today = new Date();
      const currentDay = today.getDay();

      // Calcular dias até a próxima semana + dia específico
      let daysToAdd = 7 - currentDay + targetDay;
      if (daysToAdd <= 7) daysToAdd += 7; // Garantir que seja na próxima semana

      const nextWeekDay = new Date();
      nextWeekDay.setDate(nextWeekDay.getDate() + daysToAdd);
      return nextWeekDay;
    },
    confidence: 0.95,
  },
  {
    pattern: /em\s+(\d+)\s+meses?/gi,
    parse: (match: RegExpMatchArray) => {
      const months = parseInt(match[1]);
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + months);
      return futureDate;
    },
    confidence: 0.9,
  },

  // Meses específicos
  {
    pattern:
      /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/gi,
    parse: (match: RegExpMatchArray) => {
      const day = parseInt(match[1]);
      const months = {
        janeiro: 0,
        fevereiro: 1,
        março: 2,
        abril: 3,
        maio: 4,
        junho: 5,
        julho: 6,
        agosto: 7,
        setembro: 8,
        outubro: 9,
        novembro: 10,
        dezembro: 11,
      };
      const month = months[match[2].toLowerCase() as keyof typeof months];
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, day);
    },
    confidence: 0.9,
  },

  // Horários
  {
    pattern: /(\d{1,2}):(\d{2})/g,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      const minute = parseInt(match[2]);

      // Validar horário válido
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error("Horário inválido");
      }

      const today = new Date();
      today.setHours(hour, minute, 0, 0);
      return today;
    },
    confidence: 0.6,
    hasTime: true,
  },
  {
    pattern: /(\d{1,2})h(\d{2})?/g,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;

      // Validar horário válido
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error("Horário inválido");
      }

      const today = new Date();
      today.setHours(hour, minute, 0, 0);
      return today;
    },
    confidence: 0.6,
    hasTime: true,
  },

  // Padrões com tolerância a erros de digitação e acentuação

  {
    pattern: /(proxima|próxima)\s+(semana)/gi,
    parse: () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    },
    confidence: 1.0,
  },
  {
    pattern:
      /(proxima|próxima)\s+(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terca: 2,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[2].toLowerCase() as keyof typeof weekdays];
      return getNextWeekday(targetDay);
    },
    confidence: 0.95,
  },
  {
    pattern: /(\d{1,2})\s*(da|de)\s*(manha|manhã|tarde|noite)/gi,
    parse: (match: RegExpMatchArray) => {
      const hour = parseInt(match[1]);
      const period = match[3].toLowerCase();
      const today = new Date();

      let adjustedHour = hour;
      if (period.includes("tarde") && hour < 12) {
        adjustedHour += 12;
      } else if (period.includes("noite") && hour < 12) {
        adjustedHour += 12;
      }

      today.setHours(adjustedHour, 0, 0, 0);
      return today;
    },
    confidence: 0.8,
    hasTime: true,
  },

  // Padrões inteligentes para horários com dias da semana
  {
    pattern:
      /(proxima|próxima)\s+(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\s+(\d{1,2}):?(\d{2})?/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terca: 2,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[2].toLowerCase() as keyof typeof weekdays];
      const hour = parseInt(match[3]);
      const minute = match[4] ? parseInt(match[4]) : 0;

      const nextWeekDay = getNextWeekday(targetDay);
      nextWeekDay.setHours(hour, minute, 0, 0);
      return nextWeekDay;
    },
    confidence: 0.95,
    hasTime: true,
  },
  {
    pattern:
      /(proxima|próxima)\s+(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\s+(as|às)\s+(\d{1,2}):?(\d{2})?/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terca: 2,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[2].toLowerCase() as keyof typeof weekdays];
      const hour = parseInt(match[4]);
      const minute = match[5] ? parseInt(match[5]) : 0;

      const nextWeekDay = getNextWeekday(targetDay);
      nextWeekDay.setHours(hour, minute, 0, 0);
      return nextWeekDay;
    },
    confidence: 0.95,
    hasTime: true,
  },
  {
    pattern:
      /(proxima|próxima)\s+(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\s+(as|às)\s+(\d{1,2})\s+(da|de)\s+(manha|manhã|tarde|noite)/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terca: 2,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[2].toLowerCase() as keyof typeof weekdays];
      const hour = parseInt(match[4]);
      const period = match[6].toLowerCase();

      let adjustedHour = hour;
      if (period.includes("tarde") && hour < 12) {
        adjustedHour += 12;
      } else if (period.includes("noite") && hour < 12) {
        adjustedHour += 12;
      }

      const nextWeekDay = getNextWeekday(targetDay);
      nextWeekDay.setHours(adjustedHour, 0, 0, 0);
      return nextWeekDay;
    },
    confidence: 0.95,
    hasTime: true,
  },
  {
    pattern:
      /(proxima|próxima)\s+(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\s+(\d{1,2})\s+(da|de)\s+(manha|manhã|tarde|noite)/gi,
    parse: (match: RegExpMatchArray) => {
      const weekdays = {
        segunda: 1,
        terca: 2,
        terça: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
        sábado: 6,
        domingo: 0,
      };
      const targetDay =
        weekdays[match[2].toLowerCase() as keyof typeof weekdays];
      const hour = parseInt(match[3]);
      const period = match[5].toLowerCase();

      let adjustedHour = hour;
      if (period.includes("tarde") && hour < 12) {
        adjustedHour += 12;
      } else if (period.includes("noite") && hour < 12) {
        adjustedHour += 12;
      }

      const nextWeekDay = getNextWeekday(targetDay);
      nextWeekDay.setHours(adjustedHour, 0, 0, 0);
      return nextWeekDay;
    },
    confidence: 0.95,
    hasTime: true,
  },
];

function getNextWeekday(targetDay: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilTarget);
  return nextDate;
}

export function extractDatesFromText(text: string): DateParseResult[] {
  const results: DateParseResult[] = [];

  for (const pattern of DATE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      try {
        const date = pattern.parse(match);

        // Validar se a data é válida
        if (date && !isNaN(date.getTime())) {
          results.push({
            text: match[0],
            date,
            startIndex: match.index!,
            endIndex: match.index! + match[0].length,
            confidence: pattern.confidence,
            hasTime: pattern.hasTime || false,
            timeText: pattern.hasTime ? match[0] : undefined,
          });
        }
      } catch (error) {
        // Ignorar erros de parsing
        console.warn("Erro ao fazer parsing da data:", match[0], error);
      }
    }
  }

  // Remover duplicatas e ordenar por confiança
  const uniqueResults = results.filter((result, index, array) => {
    return !array
      .slice(0, index)
      .some(
        (prev) =>
          prev.startIndex === result.startIndex &&
          prev.endIndex === result.endIndex
      );
  });

  return uniqueResults.sort((a, b) => b.confidence - a.confidence);
}

export function getBestDateMatch(text: string): DateParseResult | null {
  const matches = extractDatesFromText(text);
  return matches.length > 0 ? matches[0] : null;
}

export function formatDateForDisplay(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Verificar se é hoje
  if (date.toDateString() === today.toDateString()) {
    return "Hoje";
  }

  // Verificar se é amanhã
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Amanhã";
  }

  // Verificar se é esta semana
  const daysDiff = Math.ceil(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff >= 0 && daysDiff <= 7) {
    const weekdays = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ];
    return weekdays[date.getDay()];
  }

  // Data completa
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function combineDateAndTime(dateText: string, timeText?: string): Date {
  const dateMatch = getBestDateMatch(dateText);
  const timeMatch = timeText ? getBestDateMatch(timeText) : null;

  if (!dateMatch) {
    return new Date();
  }

  const combinedDate = new Date(dateMatch.date);

  if (timeMatch) {
    combinedDate.setHours(
      timeMatch.date.getHours(),
      timeMatch.date.getMinutes()
    );
  }

  return combinedDate;
}

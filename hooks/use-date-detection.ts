import {
  DateParseResult,
  extractDatesFromText,
  getBestDateMatch,
} from "@/lib/data-parser";
import { useState, useEffect, useCallback } from "react";

interface UseDateDetectionOptions {
  debounceMs?: number;
  minConfidence?: number;
  autoApply?: boolean;
}

interface DateSuggestion {
  date: Date;
  text: string;
  confidence: number;
  applied: boolean;
  hasTime?: boolean;
  timeText?: string;
}

export function useDateDetection(
  text: string,
  onDateDetected?: (date: Date) => void,
  options: UseDateDetectionOptions = {}
) {
  const { debounceMs = 500, minConfidence = 0.7, autoApply = false } = options;

  const [detectedDates, setDetectedDates] = useState<DateParseResult[]>([]);
  const [suggestion, setSuggestion] = useState<DateSuggestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [lastProcessedText, setLastProcessedText] = useState<string>("");

  // Função para processar o texto e detectar datas
  const processText = useCallback(
    (inputText: string) => {
      if (!inputText.trim()) {
        setDetectedDates([]);
        setSuggestion(null);
        return;
      }

      setIsProcessing(true);

      try {
        const dates = extractDatesFromText(inputText);
        const filteredDates = dates.filter(
          (d) => d.confidence >= minConfidence
        );

        setDetectedDates(filteredDates);

        // Obter a melhor sugestão
        const bestMatch = getBestDateMatch(inputText);
        if (bestMatch && bestMatch.confidence >= minConfidence) {
          const suggestionKey = `${inputText}_${
            bestMatch.text
          }_${bestMatch.date.toISOString()}`;

          // Verificar se esta sugestão já foi aplicada para este texto específico
          if (!appliedSuggestions.has(suggestionKey)) {
            const newSuggestion: DateSuggestion = {
              date: bestMatch.date,
              text: bestMatch.text,
              confidence: bestMatch.confidence,
              applied: false,
              hasTime: bestMatch.hasTime,
              timeText: bestMatch.timeText,
            };

            setSuggestion(newSuggestion);

            // Auto-aplicar se configurado
            if (autoApply && onDateDetected) {
              onDateDetected(bestMatch.date);
              setAppliedSuggestions((prev) => new Set(prev).add(suggestionKey));
              setSuggestion(null);
            }
          } else {
            setSuggestion(null);
          }
        } else {
          setSuggestion(null);
        }

        setLastProcessedText(inputText);
      } catch (error) {
        console.error("Erro na detecção de datas:", error);
        setDetectedDates([]);
        setSuggestion(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [minConfidence, autoApply, onDateDetected]
  );

  // Debounce para evitar processamento excessivo
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      processText(text);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [text, processText, debounceMs]);

  // Limpar sugestões aplicadas quando o texto muda significativamente
  useEffect(() => {
    if (text !== lastProcessedText && text.length > 0) {
      // Se o texto mudou significativamente, limpar algumas sugestões antigas
      setAppliedSuggestions((prev) => {
        const newSet = new Set<string>();
        // Manter apenas sugestões que ainda são relevantes para o texto atual
        prev.forEach((key) => {
          const [originalText] = key.split("_");
          // Se o texto original ainda está presente no texto atual, manter a sugestão
          if (text.includes(originalText)) {
            newSet.add(key);
          }
        });
        return newSet;
      });
    }
  }, [text, lastProcessedText]);

  // Função para aplicar uma sugestão manualmente
  const applySuggestion = useCallback(
    (suggestionToApply?: DateSuggestion) => {
      const targetSuggestion = suggestionToApply || suggestion;

      if (targetSuggestion && !targetSuggestion.applied && onDateDetected) {
        const suggestionKey = `${lastProcessedText}_${
          targetSuggestion.text
        }_${targetSuggestion.date.toISOString()}`;
        onDateDetected(targetSuggestion.date);
        setAppliedSuggestions((prev) => new Set(prev).add(suggestionKey));
        setSuggestion(null); // Remove a sugestão após aplicar
        return true;
      }

      return false;
    },
    [suggestion, onDateDetected, lastProcessedText]
  );

  // Função para descartar uma sugestão
  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  // Função para obter texto destacado com as datas detectadas
  const getHighlightedText = useCallback(() => {
    if (!text || detectedDates.length === 0) {
      return [{ text, isDate: false }];
    }

    const parts: Array<{
      text: string;
      isDate: boolean;
      dateInfo?: DateParseResult;
    }> = [];
    let lastIndex = 0;

    // Ordenar por posição no texto
    const sortedDates = [...detectedDates].sort(
      (a, b) => a.startIndex - b.startIndex
    );

    for (const dateInfo of sortedDates) {
      // Adicionar texto antes da data
      if (dateInfo.startIndex > lastIndex) {
        parts.push({
          text: text.slice(lastIndex, dateInfo.startIndex),
          isDate: false,
        });
      }

      // Adicionar a data detectada
      parts.push({
        text: dateInfo.text,
        isDate: true,
        dateInfo,
      });

      lastIndex = dateInfo.endIndex;
    }

    // Adicionar texto restante
    if (lastIndex < text.length) {
      parts.push({
        text: text.slice(lastIndex),
        isDate: false,
      });
    }

    return parts;
  }, [text, detectedDates]);

  return {
    detectedDates,
    suggestion,
    isProcessing,
    applySuggestion,
    dismissSuggestion,
    getHighlightedText,
    hasDetectedDates: detectedDates.length > 0,
    hasSuggestion: suggestion !== null && !suggestion.applied,
  };
}

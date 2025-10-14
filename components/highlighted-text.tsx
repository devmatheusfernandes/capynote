import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateParseResult, formatDateForDisplay } from "@/lib/data-parser";

interface HighlightedTextProps {
  parts: Array<{
    text: string;
    isDate: boolean;
    dateInfo?: DateParseResult;
  }>;
  onDateClick?: (date: Date, text: string) => void;
  onDateApply?: (date: Date, text: string) => void;
  onDateDismiss?: (text: string) => void;
  showActions?: boolean;
  className?: string;
}

export function HighlightedText({
  parts,
  onDateClick,
  onDateApply,
  onDateDismiss,
  showActions = false,
  className,
}: HighlightedTextProps) {
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);

  return (
    <div className={cn("relative", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {parts.map((part, index) => {
          if (!part.isDate) {
            return (
              <span key={index} className="text-sm">
                {part.text}
              </span>
            );
          }

          const dateInfo = part.dateInfo!;
          const isHovered = hoveredDate === part.text;
          const formattedDate = formatDateForDisplay(dateInfo.date);

          return (
            <div
              key={index}
              className="relative inline-block"
              onMouseEnter={() => setHoveredDate(part.text)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                  "font-medium",
                  isHovered && "ring-2 ring-blue-300"
                )}
                onClick={() => onDateClick?.(dateInfo.date, part.text)}
              >
                <Calendar className="h-3 w-3 mr-1" />
                {part.text}
              </Badge>

              {/* Tooltip com informações da data */}
              {isHovered && (
                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    <div className="font-medium">{formattedDate}</div>
                    <div className="text-gray-300">
                      Confiança: {Math.round(dateInfo.confidence * 100)}%
                    </div>

                    {/* Seta do tooltip */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ações (aplicar/descartar) */}
              {showActions && isHovered && (
                <div className="absolute z-40 top-full left-1/2 transform -translate-x-1/2 mt-1">
                  <div className="flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateApply?.(dateInfo.date, part.text);
                      }}
                      title="Aplicar data"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateDismiss?.(part.text);
                      }}
                      title="Descartar sugestão"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DateSuggestionProps {
  suggestion: {
    date: Date;
    text: string;
    confidence: number;
    applied: boolean;
    hasTime?: boolean;
    timeText?: string;
  };
  onApply: (date?: Date) => void;
  onDismiss: () => void;
  className?: string;
}

export function DateSuggestion({
  suggestion,
  onApply,
  onDismiss,
  className,
}: DateSuggestionProps) {
  if (suggestion.applied) {
    return null;
  }

  const formattedDate = formatDateForDisplay(suggestion.date);
  const numericDate = suggestion.date.toLocaleDateString("pt-BR");

  const handleApply = () => {
    onApply(suggestion.date);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg",
        "animate-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1">
        <Calendar className="h-4 w-4 text-blue-600" />
        <div className="text-sm">
          <span className="text-gray-700">Data detectada: </span>
          <span className="font-medium text-blue-700">{suggestion.text}</span>
          <span className="text-gray-700"> → </span>
          <span className="font-medium text-gray-900">{formattedDate}</span>
          <span className="text-gray-500 ml-1">({numericDate})</span>
          {suggestion.hasTime && (
            <span className="text-green-600 ml-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Horário detectado
            </span>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {Math.round(suggestion.confidence * 100)}%
        </Badge>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleApply}
          className="h-8 text-blue-600 border-blue-300 hover:bg-blue-100"
        >
          <Check className="h-3 w-3 mr-1" />
          Aplicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-8 text-gray-500 hover:text-gray-700"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

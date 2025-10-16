"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SyncDotProps = {
  pending?: boolean;
  className?: string;
  size?: number; // size in pixels
};

export default function SyncDot({ pending, className, size = 8 }: SyncDotProps) {
  const baseClasses = "inline-block rounded-full flex-shrink-0";
  const colorClass = pending ? "bg-amber-500" : "bg-emerald-500";
  const style = {
    width: size,
    height: size,
  } as React.CSSProperties;

  return (
    <span
      className={cn(baseClasses, colorClass, className)}
      style={style}
      aria-label={pending ? "Alterações pendentes (offline)" : "Sincronizado"}
      title={pending ? "Somente offline, aguardando upload" : "Sincronizado com o banco"}
    />
  );
}
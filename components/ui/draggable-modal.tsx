"use client";
import React, { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function DraggableModal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPos({ x: e.clientX - start.x, y: e.clientY - start.y });
  };
  const onMouseUp = () => setDragging(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <div
          ref={ref}
          onMouseDown={onMouseDown}
          style={{
            cursor: "move",
            userSelect: "none",
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          Arraste aqui
        </div>
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreadcrumbItem } from "@/types";

interface FolderBreadcrumbsProps {
  path: BreadcrumbItem[];
  onNavigate: (folderId?: string) => void;
}

export function FolderBreadcrumbs({
  path,
  onNavigate,
}: FolderBreadcrumbsProps) {
  return (
    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => onNavigate()}
      >
        <Home className="h-3 w-3 mr-1" />
        Início
      </Button>

      {path.map((item) => (
        <div key={item.id} className="flex items-center">
          <ChevronRight className="h-3 w-3 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onNavigate(item.id)}
          >
            {item.name}
          </Button>
        </div>
      ))}
    </div>
  );
}

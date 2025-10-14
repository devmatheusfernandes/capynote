import * as React from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  };
  otherButton?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  otherButton,
}: PageHeaderProps) {
  return (
    <div className="flex flex-row justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-primary tracking-tight">
          {title}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick} className="w-full sm:w-auto">
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
      {otherButton && <div>{otherButton}</div>}
    </div>
  );
}

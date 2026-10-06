import React from "react";
import { Inbox } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode | { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const renderedAction =
    action && typeof action === "object" && "label" in action && "onClick" in action ? (
      <Button variant="primary" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    ) : (
      (action as React.ReactNode)
    );

  return (
    <div
      className={`p-8 sm:p-12 text-center rounded-2xl bg-[#0d111a] border border-[#1e283d] flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[#131926] border border-[#2e3d5c]/60 flex items-center justify-center text-slate-400">
        {icon || <Inbox className="w-6 h-6 opacity-60" />}
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      {renderedAction && <div className="pt-2">{renderedAction}</div>}
    </div>
  );
}

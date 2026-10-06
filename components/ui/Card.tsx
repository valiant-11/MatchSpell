import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "panel" | "raised" | "overlay" | "interactive";
}

export function Card({ variant = "panel", className = "", children, ...props }: CardProps) {
  const variantStyles = {
    panel: "bg-[#12151a] border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    raised: "bg-[#1a1e25] border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    overlay: "bg-[#222731] border-[#d8b57a]/30 shadow-2xl shadow-black/80",
    interactive:
      "bg-[#12151a] border-white/10 hover:border-[#d8b57a]/40 hover:bg-[#1a1e25] transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md",
  }[variant];

  return (
    <div
      className={`rounded-xl border ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 sm:p-5 flex flex-col space-y-1.5 border-b border-white/5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-base font-bold text-white tracking-wide font-dota flex items-center gap-2 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-slate-400 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 sm:p-5 flex items-center border-t border-white/5 ${className}`} {...props}>
      {children}
    </div>
  );
}

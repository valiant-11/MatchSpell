import React from "react";

export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#131926] border border-[#1e283d]/40 ${className}`}
      {...props}
    />
  );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";

export interface HeroPortraitProps {
  src?: string;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  aspectRatio?: "video" | "square" | "portrait";
  className?: string;
  glow?: boolean;
}

export function HeroPortrait({
  src,
  alt,
  size = "md",
  aspectRatio = "video",
  className = "",
  glow = false,
}: HeroPortraitProps) {
  const [hasError, setHasError] = useState(false);

  const sizeStyles = {
    xs: "w-8",
    sm: "w-10",
    md: "w-14",
    lg: "w-20",
    xl: "w-28",
  }[size];

  const aspectStyles = {
    video: "aspect-[16/9]",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
  }[aspectRatio];

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg border border-[#1e283d] bg-[#070a0f] ${sizeStyles} ${aspectStyles} ${
        glow ? "shadow-md shadow-sky-500/20" : ""
      } ${className}`}
    >
      {src && !hasError ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 64px, 120px"
          className="object-cover transition-transform duration-200 group-hover:scale-105"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#131926] text-slate-600">
          <User className="w-1/2 h-1/2 opacity-50" />
        </div>
      )}
    </div>
  );
}

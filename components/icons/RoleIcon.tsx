import React from "react";
import { RolePosition } from "@/lib/types";

export interface RoleIconProps extends Omit<React.SVGProps<SVGSVGElement>, "role"> {
  role: RolePosition;
  size?: number;
  active?: boolean;
  className?: string;
}

export function RoleIcon({ role, size = 18, active, className = "", ...props }: RoleIconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    ...props,
  };

  switch (role) {
    case 1:
      // Pos 1: Safe Lane Carry - Sharp Broadsword / Executioner Blade
      return (
        <svg {...commonProps}>
          <path d="M14.5 4.5l5 5L8 21l-5-1 1-5L14.5 4.5z" />
          <path d="M13 6l5 5" />
          <path d="M5 19l2-2" />
          <path d="M19 3l2 2" />
        </svg>
      );

    case 2:
      // Pos 2: Mid Lane - High-Voltage Lightning Crosshair
      return (
        <svg {...commonProps}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );

    case 3:
      // Pos 3: Offlane - Reinforced Aegis Shield
      return (
        <svg {...commonProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 2v20" />
        </svg>
      );

    case 4:
      // Pos 4: Soft Support - Roamer Winged Boot / Swift Compass
      return (
        <svg {...commonProps}>
          <path d="M4 16v-2a4 4 0 0 1 4-4h4" />
          <path d="M4 16c0 1.5 1 3 3 3h10a3 3 0 0 0 3-3v-2l-3-4H8" />
          <path d="M16 10l-2-4-4 2" />
          <circle cx="17.5" cy="16.5" r="1.5" />
        </svg>
      );

    case 5:
      // Pos 5: Hard Support - Sentinel Ward / Eye of Vision
      return (
        <svg {...commonProps}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
        </svg>
      );

    default:
      return null;
  }
}

/**
 * Standard Role Accent Metadata
 */
export const ROLE_THEME: Record<
  RolePosition,
  {
    name: string;
    shortName: string;
    laneName: string;
    color: string;
    bgColor: string;
    borderColor: string;
    glowClass: string;
  }
> = {
  1: {
    name: "Safe Lane Carry",
    shortName: "Carry",
    laneName: "Safe Lane",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/40",
    glowClass: "glow-role-1",
  },
  2: {
    name: "Mid Lane",
    shortName: "Mid",
    laneName: "Mid Lane",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
    borderColor: "border-cyan-500/40",
    glowClass: "glow-role-2",
  },
  3: {
    name: "Offlane Core",
    shortName: "Off",
    laneName: "Offlane",
    color: "text-pink-400",
    bgColor: "bg-pink-500/15",
    borderColor: "border-pink-500/40",
    glowClass: "glow-role-3",
  },
  4: {
    name: "Soft Support",
    shortName: "Soft",
    laneName: "Support Duo",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    borderColor: "border-purple-500/40",
    glowClass: "glow-role-4",
  },
  5: {
    name: "Hard Support",
    shortName: "Hard",
    laneName: "Safe Duo",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    borderColor: "border-emerald-500/40",
    glowClass: "glow-role-5",
  },
};

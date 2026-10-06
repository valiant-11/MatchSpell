import React from "react";
import { PrimaryAttr } from "@/lib/types";

export interface AttributeIconProps extends React.SVGProps<SVGSVGElement> {
  attr: PrimaryAttr | "all_attrs";
  size?: number;
  className?: string;
}

export function AttributeIcon({ attr, size = 18, className = "", ...props }: AttributeIconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className,
    ...props,
  };

  switch (attr) {
    case "str":
      // Strength - Gauntlet / Brawn Fist
      return (
        <svg {...commonProps} className={`text-[#ec3d06] ${className}`}>
          <path d="M12 2L4 7v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 3.2l5 3.12v4.68c0 3.73-2.58 7.23-5 8.19-2.42-.96-5-4.46-5-8.19V8.32l5-3.12z" />
          <path d="M10 9h4v6h-4z" />
        </svg>
      );

    case "agi":
      // Agility - Swift Boot / Wing Blade
      return (
        <svg {...commonProps} className={`text-[#26e030] ${className}`}>
          <path d="M12 2L2 12l3.5 3.5L12 9l6.5 6.5L22 12 12 2zm0 10.5L6.5 18 12 23.5 17.5 18 12 12.5z" />
        </svg>
      );

    case "int":
      // Intelligence - Arcane Staff / Mystic Eye
      return (
        <svg {...commonProps} className={`text-[#00d9ff] ${className}`}>
          <path d="M12 2a6 6 0 0 0-6 6c0 2.22 1.2 4.15 3 5.19V17a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3.81c1.8-1.04 3-2.97 3-5.19a6 6 0 0 0-6-6zm-1 18h2v2h-2v-2z" />
        </svg>
      );

    case "all":
      // Universal - Tri-Orb Harmony / Cosmic Prism
      return (
        <svg {...commonProps} className={`text-[#e0a82e] ${className}`}>
          <circle cx="12" cy="7" r="3.5" fill="#ec3d06" />
          <circle cx="7" cy="16" r="3.5" fill="#26e030" />
          <circle cx="17" cy="16" r="3.5" fill="#00d9ff" />
        </svg>
      );

    default:
      return null;
  }
}

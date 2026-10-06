"use client";

import React, { forwardRef } from "react";
import { Button, ButtonProps } from "./Button";
import { Tooltip, TooltipProps } from "./Tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "iconOnly" | "leftIcon" | "rightIcon"> {
  icon: React.ReactNode;
  label: string; // Mandatory for accessibility
  tooltipContent?: React.ReactNode;
  tooltipPosition?: TooltipProps["position"];
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      tooltipContent,
      tooltipPosition = "top",
      variant = "secondary",
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    const button = (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        iconOnly
        aria-label={label}
        className={className}
        {...props}
      >
        {icon}
      </Button>
    );

    const tooltip = tooltipContent ?? label;

    return (
      <Tooltip content={tooltip} position={tooltipPosition}>
        {button}
      </Tooltip>
    );
  }
);

IconButton.displayName = "IconButton";

"use client";

import React, { createContext, useContext, useCallback } from "react";
import { Toaster, toast as sonnerToast } from "sonner";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "info";
  duration?: number;
}

interface ToastContextType {
  toast: (
    optionsOrMessage: string | ToastOptions,
    type?: "success" | "error" | "info",
    duration?: number
  ) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useCallback(
    (
      optionsOrMessage: string | ToastOptions,
      type: "success" | "error" | "info" = "info",
      duration = 3500
    ) => {
      let message = "";
      let desc: string | undefined;
      let toastType: "success" | "error" | "info" = type;
      let toastDuration = duration;

      if (typeof optionsOrMessage === "object") {
        message = optionsOrMessage.title || "";
        desc = optionsOrMessage.description;
        if (optionsOrMessage.variant === "success") toastType = "success";
        else if (optionsOrMessage.variant === "error") toastType = "error";
        else if (optionsOrMessage.variant === "info") toastType = "info";
        if (optionsOrMessage.duration) toastDuration = optionsOrMessage.duration;
      } else {
        message = optionsOrMessage;
      }

      if (toastType === "success") {
        sonnerToast.success(message, { description: desc, duration: toastDuration });
      } else if (toastType === "error") {
        sonnerToast.error(message, { description: desc, duration: toastDuration });
      } else {
        sonnerToast.info(message, { description: desc, duration: toastDuration });
      }
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#12151a",
            color: "#f8fafc",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.7)",
            fontSize: "12px",
            fontFamily: "var(--font-sans)",
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (msg: string | ToastOptions) => {
        if (typeof msg === "string") sonnerToast(msg);
        else sonnerToast(msg.title || "", { description: msg.description });
      },
    };
  }
  return ctx;
}

export { sonnerToast };

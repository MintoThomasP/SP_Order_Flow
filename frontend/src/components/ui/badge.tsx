import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "danger" | "info" | "neutral" | "custom";
  size?: "sm" | "md";
  dot?: boolean;
  bgHex?: string;
  textHex?: string;
  className?: string;
}

const variantStyles: Record<string, { bg: string; text: string; dotColor: string }> = {
  primary: { bg: "bg-blue-50", text: "text-[#0073EA] border-blue-200/60", dotColor: "bg-[#0073EA]" },
  success: { bg: "bg-emerald-50", text: "text-emerald-700 border-emerald-200/60", dotColor: "bg-emerald-600" },
  warning: { bg: "bg-amber-50", text: "text-amber-700 border-amber-200/60", dotColor: "bg-amber-600" },
  danger: { bg: "bg-rose-50", text: "text-rose-700 border-rose-200/60", dotColor: "bg-rose-600" },
  info: { bg: "bg-sky-50", text: "text-sky-700 border-sky-200/60", dotColor: "bg-sky-600" },
  neutral: { bg: "bg-slate-100", text: "text-slate-700 border-slate-200/80", dotColor: "bg-slate-500" },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  size = "md",
  dot = false,
  bgHex,
  textHex,
  className = "",
}) => {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1 font-medium";

  if (variant === "custom" && bgHex && textHex) {
    return (
      <span
        style={{ backgroundColor: bgHex, color: textHex, borderColor: `${textHex}30` }}
        className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-all ${sizeClasses} ${className}`}
      >
        {dot && (
          <span
            style={{ backgroundColor: textHex }}
            className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
          />
        )}
        {children}
      </span>
    );
  }

  const currentVariant = variantStyles[variant] || variantStyles.primary;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-all ${currentVariant.bg} ${currentVariant.text} ${sizeClasses} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${currentVariant.dotColor}`} />
      )}
      {children}
    </span>
  );
};

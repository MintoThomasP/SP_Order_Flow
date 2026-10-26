import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary:
    "bg-[#0073EA] hover:bg-[#0060B9] text-white shadow-xs focus-visible:ring-[#0073EA]/30 font-semibold active:scale-[0.99]",
  secondary:
    "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/60 font-medium active:scale-[0.99]",
  outline:
    "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300/80 shadow-xs font-medium active:scale-[0.99]",
  ghost:
    "bg-transparent hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 font-medium",
  danger:
    "bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus-visible:ring-rose-500/30 font-medium active:scale-[0.99]",
};

const sizeStyles: Record<string, string> = {
  sm: "text-xs px-2.5 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-3.5 py-2 rounded-lg gap-2",
  lg: "text-base px-4 py-2.5 rounded-xl gap-2.5",
  icon: "p-2 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

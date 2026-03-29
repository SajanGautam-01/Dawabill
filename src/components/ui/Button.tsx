import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5": variant === "default",
            "bg-red-500 text-white shadow-xl shadow-red-500/20 hover:bg-red-600 hover:-translate-y-0.5": variant === "destructive",
            "border-2 border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:-translate-y-0.5 text-slate-800": variant === "outline",
            "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 hover:-translate-y-0.5": variant === "secondary",
            "hover:bg-slate-100 text-slate-600 hover:text-slate-900": variant === "ghost",
            "text-blue-600 underline-offset-4 hover:underline": variant === "link",
            "h-12 px-6": size === "default",
            "h-10 rounded-xl px-4 text-sm": size === "sm",
            "h-14 rounded-2xl px-8 text-lg": size === "lg",
            "h-12 w-12": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

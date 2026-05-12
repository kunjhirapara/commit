"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative text-muted-foreground w-9 h-9 rounded-full">
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full w-9 h-9 transition-colors focus-visible:ring-offset-0 focus-visible:ring-0"
    >
      <div className="relative flex items-center justify-center w-full h-full">
        {/* Sun Icon */}
        <Sun 
          className={`absolute h-[1.2rem] w-[1.2rem] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isDark ? "opacity-0 scale-50 -rotate-90" : "opacity-100 scale-100 rotate-0"
          }`} 
        />
        {/* Moon Icon */}
        <Moon 
          className={`absolute h-[1.2rem] w-[1.2rem] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isDark ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"
          }`} 
        />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

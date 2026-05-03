"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
      className="w-9 h-9"
    >
      {theme === "light" ? (
        <Moon className="h-[1.2rem] w-[1.2rem] stroke-[1.5px]" />
      ) : (
        <Sun className="h-[1.2rem] w-[1.2rem] stroke-[1.5px]" />
      )}
    </Button>
  );
}

export default ThemeToggle;

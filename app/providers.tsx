'use client';

import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const raw = savedTheme || (prefersDark ? "dark" : "light");
    const theme: "light" | "dark" = raw === "dark" ? "dark" : "light";
    applyTheme(theme);
  }, []);

  return <>{children}</>;
}

export function applyTheme(theme: 'light' | 'dark') {
  const html = document.documentElement;
  
  if (theme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.add('light');
    html.classList.remove('dark');
  }
  
  localStorage.setItem('theme', theme);
}

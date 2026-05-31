"use client";

const THEME_INIT = `(function(){try{var savedTheme=localStorage.getItem('theme');var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var theme=savedTheme|| (prefersDark ? 'dark':'light');var html=document.documentElement;html.classList.toggle('dark', theme==='dark');html.classList.toggle('light', theme==='light');}catch(e){}})();`;

/** SSR-only inline script — avoids React 19 script-in-component warning on the client. */
export function ThemeInitScript() {
  if (typeof window !== "undefined") return null;

  return (
    <script
      id="theme-init"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_INIT }}
    />
  );
}

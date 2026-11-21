import { useLayoutEffect, type ReactNode } from 'react';

// The application uses a single white theme, regardless of saved or system preferences.
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    try {
      localStorage.removeItem('certiflow_theme');
    } catch {
      // The theme does not depend on browser storage access.
    }
  }, []);
  return <>{children}</>;
}

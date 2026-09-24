import { createContext, useContext } from 'react';

export type Tema = 'claro' | 'escuro';

export interface ThemeState {
  tema: Tema;
  alternarTema: () => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return context;
}

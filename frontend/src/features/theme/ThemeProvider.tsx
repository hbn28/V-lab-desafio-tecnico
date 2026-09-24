import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './context';
import type { Tema } from './context';

const CHAVE_ARMAZENAMENTO = 'vlab:tema';

function temaPreferidoDoSistema(): Tema {
  if (typeof window === 'undefined' || !window.matchMedia) return 'claro';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

function lerTemaSalvo(): Tema | null {
  try {
    const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return salvo === 'claro' || salvo === 'escuro' ? salvo : null;
  } catch {
    return null;
  }
}

/**
 * Aplica o tema (claro/escuro) via atributo data-theme no <html>, com
 * preferência salva pelo usuário (persistida em localStorage) ou, na
 * ausência dela, a preferência do sistema operacional — inclusive
 * acompanhando mudanças dela em tempo real. index.html já aplica o
 * atributo antes da primeira renderização para não piscar claro→escuro.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => lerTemaSalvo() ?? temaPreferidoDoSistema());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light');
  }, [tema]);

  useEffect(() => {
    if (lerTemaSalvo()) return; // usuário já escolheu um tema explicitamente
    if (typeof window === 'undefined' || !window.matchMedia) return; // ambiente sem suporte (ex.: testes)
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const ouvir = (event: MediaQueryListEvent) => setTema(event.matches ? 'escuro' : 'claro');
    media.addEventListener('change', ouvir);
    return () => media.removeEventListener('change', ouvir);
  }, []);

  const alternarTema = () => {
    setTema(anterior => {
      const proximo: Tema = anterior === 'escuro' ? 'claro' : 'escuro';
      try {
        window.localStorage.setItem(CHAVE_ARMAZENAMENTO, proximo);
      } catch {
        // armazenamento indisponível: o tema ainda muda nesta sessão, só não persiste
      }
      return proximo;
    });
  };

  const value = useMemo(() => ({ tema, alternarTema }), [tema]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

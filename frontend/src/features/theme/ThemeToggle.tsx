import { useTheme } from './context';

export function ThemeToggle() {
  const { tema, alternarTema } = useTheme();
  const escuro = tema === 'escuro';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={alternarTema}
      aria-pressed={escuro}
      aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {escuro ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>
        ) : (
          <path d="M20.3 15.4A8.5 8.5 0 0 1 8.6 3.7 8.5 8.5 0 1 0 20.3 15.4Z" />
        )}
      </svg>
    </button>
  );
}

import { useNavigate } from 'react-router-dom';

export type VisaoTab = 'fila' | 'agenda' | 'historico' | 'faltas';

interface ViewSwitcherProps {
  ativo: VisaoTab;
}

const ROTA: Record<VisaoTab, string> = {
  fila: '/',
  agenda: '/?visao=agenda',
  // Histórico encerrado é uma página própria (rota separada), não mais uma visão da
  // página principal — mantém o painel só com o que está em aberto, mais fácil de ler.
  historico: '/solicitacoes/historico',
  faltas: '/?visao=faltas',
};

const LABEL: Record<VisaoTab, string> = {
  fila: 'Fila atual',
  agenda: 'Agenda',
  historico: 'Histórico encerrado',
  faltas: 'Faltas',
};

const ORDEM: VisaoTab[] = ['fila', 'agenda', 'historico', 'faltas'];

/**
 * Alterna entre as visões operacionais da fila. Usado tanto na página principal
 * (fila/agenda/faltas) quanto na página de Histórico, para as quatro abas ficarem sempre
 * em sincronia visual não importa de onde o clique parte.
 */
export function ViewSwitcher({ ativo }: ViewSwitcherProps) {
  const navigate = useNavigate();
  return (
    <div className="view-switcher__group" role="group" aria-label="Escopo da listagem">
      {ORDEM.map(item => (
        <button
          key={item}
          type="button"
          className={`button button--outline ${ativo === item ? 'is-active' : ''}`}
          aria-pressed={ativo === item}
          onClick={() => navigate(ROTA[item])}
        >
          {LABEL[item]}
        </button>
      ))}
    </div>
  );
}

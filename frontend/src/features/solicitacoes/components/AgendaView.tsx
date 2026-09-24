import { Link } from 'react-router-dom';
import { PrioridadeBadge, StatusBadge } from '../../../components/Badge';
import { formatarAgendamento } from '../config/agendamento';
import { LABEL_CATEGORIA, LABEL_TURNO } from '../types';
import type { AgendaDiaEstado } from '../hooks/useAgendaSemanal';

interface AgendaViewProps {
  dias: string[];
  grupos: Record<string, AgendaDiaEstado>;
  paginas: Record<string, number>;
  returnContext: { state: { from: string } };
  onReload: () => void;
  onPageChange: (dia: string, pagina: number) => void;
}

function formatDiaAgenda(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    .format(new Date(`${value}T12:00:00Z`));
}

export function AgendaView({ dias, grupos, paginas, returnContext, onReload, onPageChange }: AgendaViewProps) {
  return (
    <div className="agenda-week" aria-label="Filas de solicitações por dia">
      {dias.map(dia => {
        const grupo = grupos[dia];
        const paginaDia = paginas[dia] ?? 1;
        return (
          <section className="agenda-day" key={dia} aria-labelledby={`agenda-dia-${dia}`}>
            <header className="agenda-day__header">
              <h3 id={`agenda-dia-${dia}`}>{formatDiaAgenda(dia)}</h3>
              {!grupo?.loading && !grupo?.error && <span className="record-count">{grupo?.total ?? 0} solicitações</span>}
            </header>
            {grupo?.loading && <p className="state-view state-view--compact" role="status">Carregando este dia</p>}
            {grupo?.error && <div className="alert alert--error" role="alert"><p>{grupo.error}</p><button type="button" className="button button--outline" onClick={onReload}>Tentar novamente</button></div>}
            {!grupo?.loading && !grupo?.error && grupo?.data.length === 0 && <p className="agenda-day__empty">Nenhuma solicitação agendada.</p>}
            {!grupo?.loading && !grupo?.error && grupo && grupo.data.length > 0 && <>
              <ul className="agenda-day__list">
                {grupo.data.map(item => (
                  <li key={item.id}>
                    <Link to={`/solicitacoes/${item.id}`} {...returnContext} className="agenda-day__item">
                      <span className="agenda-day__time">{item.agendado_para ? formatarAgendamento(item.agendado_para) : item.agendamento_ativo?.turno ? LABEL_TURNO[item.agendamento_ativo.turno] : 'Horário não informado'}</span>
                      <span className="agenda-day__request"><strong>{item.protocolo}</strong><span>{item.nome_solicitante}</span></span>
                      <PrioridadeBadge prioridade={item.prioridade} />
                      <StatusBadge status={item.status} />
                      <span>{LABEL_CATEGORIA[item.categoria]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {grupo.last_page > 1 && <nav className="pagination" aria-label={`Paginação de ${formatDiaAgenda(dia)}`}>
                <p>Página <strong>{paginaDia}</strong> de <strong>{grupo.last_page}</strong></p>
                <div className="pagination__actions">
                  <button className="button button--outline" disabled={paginaDia <= 1} onClick={() => onPageChange(dia, paginaDia - 1)} type="button">Anterior</button>
                  <button className="button button--outline" disabled={paginaDia >= grupo.last_page} onClick={() => onPageChange(dia, paginaDia + 1)} type="button">Próxima</button>
                </div>
              </nav>}
            </>}
          </section>
        );
      })}
    </div>
  );
}
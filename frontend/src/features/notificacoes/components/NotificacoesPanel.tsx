import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificacoesApi } from '../api/client';
import type { ListaNotificacoes } from '../types';

export function NotificacoesPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ListaNotificacoes | null>(null);
  const [page, setPage] = useState(1);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const load = async (requestedPage = 1, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await notificacoesApi.listar(requestedPage);
      setList(current => append && current
        ? { ...result, data: [...current.data, ...result.data] }
        : result);
      setPage(result.meta.current_page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const toggle = () => {
    if (!open) { setPage(1); void load(1); }
    setOpen(!open);
  };

  const markRead = async (id: number) => {
    try {
      const updated = await notificacoesApi.marcarLida(id);
      setList(current => current ? {
        ...current,
        unread_count: Math.max(0, current.unread_count - (current.data.some(item => item.id === id && item.read_at === null) ? 1 : 0)),
        data: current.data.map(item => item.id === id ? updated : item),
      } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível marcar como lida.');
    }
  };

  return (
    <div className="notifications">
      <button ref={triggerRef} type="button" className="button button--outline button--small" aria-expanded={open} aria-controls="notifications-panel" onClick={toggle}>Notificações</button>
      {open && <section id="notifications-panel" className="notifications__panel panel" aria-label="Notificações operacionais">
        <h2>Notificações</h2>
        {loading && <p role="status">Carregando notificações…</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => void load(page)}>Tentar novamente</button></div>}
        {!loading && !error && list && <>
          <p aria-live="polite">{list.unread_count} {list.unread_count === 1 ? 'notificação não lida' : 'notificações não lidas'}</p>
          {list.data.length === 0 ? <p>Nenhuma notificação no momento.</p> : <ul>
            {list.data.map(item => <li key={item.id}>
              <Link to={`/solicitacoes/${item.solicitacao_id}`} onClick={() => setOpen(false)}>{item.protocolo}: {item.status_anterior} → {item.status_novo}</Link>
              {!item.read_at && <button type="button" onClick={() => void markRead(item.id)}>Marcar como lida</button>}
            </li>)}
          </ul>}
          {page < list.meta.last_page && <button type="button" onClick={() => void load(page + 1, true)}>Carregar mais notificações</button>}
        </>}
      </section>}
    </div>
  );
}

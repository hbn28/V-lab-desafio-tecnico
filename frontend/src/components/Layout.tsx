import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/context';
import { NotificacoesPanel } from '../features/notificacoes/components/NotificacoesPanel';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get('visao') ?? 'fila';
  const viewLink = (view: string) => `main-nav__link${currentView === view ? ' is-active' : ''}`;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand" aria-label="Solicitações de Atendimento — página inicial">
            <span className="brand__mark" aria-hidden="true">VL</span>
            <span className="brand__text">
              <strong>Solicitações</strong>
              <small>Atendimento público</small>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Navegação principal">
          <Link to="/" className={viewLink('fila')} aria-current={currentView === 'fila' ? 'page' : undefined}>Fila</Link>
          <Link to="/?visao=agenda" className={viewLink('agenda')} aria-current={currentView === 'agenda' ? 'page' : undefined}>Solicitações agendadas</Link>
          <Link to="/?visao=historico" className={viewLink('historico')} aria-current={currentView === 'historico' ? 'page' : undefined}>Histórico</Link>
          <Link to="/?visao=faltas" className={viewLink('faltas')} aria-current={currentView === 'faltas' ? 'page' : undefined}>Faltas</Link>
          <NavLink
            to="/solicitacoes/nova"
            className={({ isActive }) => `main-nav__link${isActive ? ' is-active' : ''}`}
          >
            Nova solicitação
          </NavLink>
          </nav>
          <div className="operator-actions">
            <NotificacoesPanel />
            <span>{user?.name} · {user?.role === 'ADMINISTRADOR' ? 'Administrador' : 'Atendente'}</span>
            <button className="button button--outline button--small" type="button" onClick={() => void logout()}>Sair</button>
          </div>
        </div>
      </header>
      <main id="conteudo-principal" className="page-container" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

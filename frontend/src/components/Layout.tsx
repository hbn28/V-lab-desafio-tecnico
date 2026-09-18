import { Link, NavLink, Outlet } from 'react-router-dom';

export function Layout() {
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
          <NavLink
            to="/"
            end
            className={({ isActive }) => `main-nav__link${isActive ? ' is-active' : ''}`}
          >
            Painel
          </NavLink>
          <NavLink
            to="/solicitacoes/nova"
            className={({ isActive }) => `main-nav__link${isActive ? ' is-active' : ''}`}
          >
            Nova solicitação
          </NavLink>
          </nav>
        </div>
      </header>
      <main id="conteudo-principal" className="page-container" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

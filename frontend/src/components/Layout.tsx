import { Link, NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#1a1a2e', color: '#fff', padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', gap: '2rem', height: '56px'
      }}>
        <Link to="/solicitacoes" style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.5px' }}>
          V-Lab Solicitações
        </Link>
        <nav style={{ display: 'flex', gap: '1.2rem', fontSize: '0.9rem' }}>
          <NavLink
            to="/solicitacoes"
            style={({ isActive }) => ({ color: isActive ? '#7dd3fc' : '#cbd5e1', fontWeight: isActive ? 600 : 400 })}
          >
            Listagem
          </NavLink>
          <NavLink
            to="/solicitacoes/nova"
            style={({ isActive }) => ({ color: isActive ? '#7dd3fc' : '#cbd5e1', fontWeight: isActive ? 600 : 400 })}
          >
            + Nova
          </NavLink>
        </nav>
      </header>
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}

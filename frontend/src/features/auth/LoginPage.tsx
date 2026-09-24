import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './context';
import { authApi } from './api/client';
import { CadastroForm } from './CadastroForm';
import { ThemeToggle } from '../theme/ThemeToggle';

export function LoginPage() {
  const { login, error } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [cadastroHabilitado, setCadastroHabilitado] = useState(false);

  useEffect(() => {
    let ativo = true;
    // Sem resposta do backend, a opção simplesmente não aparece: o login continua funcionando.
    authApi.cadastroHabilitado().then(habilitado => { if (ativo) setCadastroHabilitado(habilitado); }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(identifier, password);
    } catch {
      // O provedor apresenta o erro sem expor detalhes de credenciais.
    } finally {
      setSubmitting(false);
    }
  };

  if (modo === 'cadastrar') {
    return (
      <main className="login-page">
        <div className="login-page__theme"><ThemeToggle /></div>
        <CadastroForm onVoltar={() => setModo('entrar')} />
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-page__theme"><ThemeToggle /></div>
      <form className="login-card panel" onSubmit={submit}>
        <p className="eyebrow">Solicitações de Atendimento</p>
        <h1>Entrar no sistema</h1>
        <p>Use sua conta de operador para acessar os atendimentos.</p>
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        <label htmlFor="login-identifier">Usuário ou e-mail</label>
        <input id="login-identifier" type="text" autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} required />
        <label htmlFor="login-password">Senha</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        {cadastroHabilitado && (
          <p className="login-card__switch">
            Não tem conta?{' '}
            <button type="button" className="link-button" onClick={() => setModo('cadastrar')}>Criar conta</button>
          </p>
        )}
      </form>
    </main>
  );
}

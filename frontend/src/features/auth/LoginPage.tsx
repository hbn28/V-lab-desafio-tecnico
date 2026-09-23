import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './context';

export function LoginPage() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // O provedor apresenta o erro sem expor detalhes de credenciais.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card panel" onSubmit={submit}>
        <p className="eyebrow">Solicitações de Atendimento</p>
        <h1>Entrar no sistema</h1>
        <p>Use sua conta de operador para acessar os atendimentos.</p>
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        <label htmlFor="login-email">E-mail</label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
        <label htmlFor="login-password">Senha</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from './context';
import type { ApiError, CadastroPayload } from './types';

type Campo = keyof CadastroPayload;
type Erros = Partial<Record<Campo, string>>;

const VAZIO: CadastroPayload = { name: '', username: '', email: '', password: '', password_confirmation: '' };

function validarLocalmente(dados: CadastroPayload): Erros {
  const erros: Erros = {};
  if (!dados.name.trim()) erros.name = 'Informe seu nome.';
  if (dados.username.trim().length < 3) erros.username = 'O usuário precisa ter pelo menos 3 caracteres.';
  else if (!/^[a-zA-Z0-9._-]+$/.test(dados.username.trim())) erros.username = 'Use apenas letras, números, ponto, hífen ou sublinhado no usuário, sem espaços.';
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) erros.email = 'Informe um e-mail válido.';
  if (dados.password.length < 8) erros.password = 'A senha precisa ter pelo menos 8 caracteres.';
  else if (dados.password !== dados.password_confirmation) erros.password_confirmation = 'A confirmação da senha não confere.';
  return erros;
}

interface CadastroFormProps {
  onVoltar: () => void;
}

/** Criação de conta pela tela de login. A conta nasce sempre com o perfil ATENDENTE. */
export function CadastroForm({ onVoltar }: CadastroFormProps) {
  const { cadastrar } = useAuth();
  const [dados, setDados] = useState<CadastroPayload>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo: Campo, valor: string) => {
    setDados(atual => ({ ...atual, [campo]: valor }));
    setErros(atual => ({ ...atual, [campo]: undefined }));
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErroGeral(null);
    const locais = validarLocalmente(dados);
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      return;
    }
    setEnviando(true);
    try {
      await cadastrar({ ...dados, username: dados.username.trim(), email: dados.email?.trim() || null });
    } catch (caught) {
      const erro = caught as ApiError;
      const doServidor = Object.fromEntries(
        Object.entries(erro.errors ?? {}).map(([campo, mensagens]) => [campo, mensagens[0]])
      ) as Erros;
      if (Object.keys(doServidor).length > 0) setErros(doServidor);
      else setErroGeral(erro.message ?? 'Não foi possível criar a conta.');
      setEnviando(false);
    }
  };

  const erroDe = (campo: Campo) => erros[campo];
  const descrito = (campo: Campo, ajuda?: string) => [ajuda, erroDe(campo) ? `cadastro-${campo}-erro` : null].filter(Boolean).join(' ') || undefined;

  const campo = (id: Campo, rotulo: string, props: { type?: string; autoComplete: string; ajuda?: string; opcional?: boolean }) => (
    <div className="login-field">
      <label htmlFor={`cadastro-${id}`}>{rotulo}{props.opcional && <span className="login-field__optional"> (opcional)</span>}</label>
      <input
        id={`cadastro-${id}`}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
        value={dados[id] ?? ''}
        onChange={event => alterar(id, event.target.value)}
        aria-invalid={Boolean(erroDe(id))}
        aria-describedby={descrito(id, props.ajuda ? `cadastro-${id}-ajuda` : undefined)}
        required={!props.opcional}
      />
      {props.ajuda && <p id={`cadastro-${id}-ajuda`} className="login-field__help">{props.ajuda}</p>}
      {erroDe(id) && <p id={`cadastro-${id}-erro`} className="field-error">{erroDe(id)}</p>}
    </div>
  );

  return (
    <form className="login-card panel" onSubmit={enviar} noValidate>
      <p className="eyebrow">Solicitações de Atendimento</p>
      <h1>Criar conta</h1>
      <p>A conta é criada com o perfil de atendente e você entra no sistema em seguida.</p>
      {erroGeral && <p className="alert alert--error" role="alert">{erroGeral}</p>}
      {campo('name', 'Nome', { autoComplete: 'name' })}
      {campo('username', 'Usuário', { autoComplete: 'username', ajuda: 'Pelo menos 3 caracteres: letras, números, ponto, hífen ou sublinhado.' })}
      {campo('email', 'E-mail', { type: 'email', autoComplete: 'email', opcional: true })}
      {campo('password', 'Senha', { type: 'password', autoComplete: 'new-password', ajuda: 'Pelo menos 8 caracteres.' })}
      {campo('password_confirmation', 'Confirmar senha', { type: 'password', autoComplete: 'new-password' })}
      <button className="button button--primary" type="submit" disabled={enviando}>
        {enviando ? 'Criando conta…' : 'Criar conta'}
      </button>
      <button className="button button--ghost" type="button" onClick={onVoltar}>
        Já tenho conta — entrar
      </button>
    </form>
  );
}

export type Categoria = 'CONSULTA' | 'EXAME' | 'VACINACAO' | 'OUTRO';
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type Status = 'RECEBIDA' | 'EM_ANALISE' | 'AGENDADA' | 'CONCLUIDA' | 'CANCELADA';

export interface Solicitacao {
  id: number;
  protocolo: string;
  nome_solicitante: string;
  cpf_solicitante: string;
  data_nascimento: string;
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
  descricao: string;
  justificativa_prioridade: string | null;
  data_criacao: string;
  data_atualizacao: string;
}

export interface PaginaMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface PaginaLinks {
  first: string | null;
  last: string | null;
  next: string | null;
  prev: string | null;
}

export interface ListaSolicitacoes {
  data: Solicitacao[];
  meta: PaginaMeta;
  links: PaginaLinks;
}

export interface CriarSolicitacaoPayload {
  nome_solicitante: string;
  cpf_solicitante: string;
  data_nascimento: string;
  categoria: Categoria;
  prioridade: Prioridade;
  descricao: string;
  justificativa_prioridade?: string | null;
}

export interface AtualizarStatusPayload {
  status: Status;
}

export type AtualizarSolicitacaoPayload = CriarSolicitacaoPayload;

export interface FiltrosSolicitacoes {
  status?: Status;
  categoria?: Categoria;
  prioridade?: Prioridade;
  page?: number;
  per_page?: number;
}

export interface ApiErro {
  message: string;
  errors: Record<string, string[]>;
}

export const TRANSICOES_PERMITIDAS: Record<Status, Status[]> = {
  RECEBIDA:   ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['AGENDADA', 'CANCELADA'],
  AGENDADA:   ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA:  [],
  CANCELADA:  [],
};

export const LABEL_STATUS: Record<Status, string> = {
  RECEBIDA:   'Recebida',
  EM_ANALISE: 'Em análise',
  AGENDADA:   'Agendada',
  CONCLUIDA:  'Concluída',
  CANCELADA:  'Cancelada',
};

export const LABEL_CATEGORIA: Record<Categoria, string> = {
  CONSULTA:  'Consulta',
  EXAME:     'Exame',
  VACINACAO: 'Vacinação',
  OUTRO:     'Outro',
};

export const LABEL_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA:   'Baixa',
  MEDIA:   'Média',
  ALTA:    'Alta',
  URGENTE: 'Urgente',
};

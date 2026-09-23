export type Categoria = 'CONSULTA' | 'EXAME' | 'VACINACAO' | 'OUTRO';
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type Status = 'RECEBIDA' | 'EM_ANALISE' | 'AGENDADA' | 'CONCLUIDA' | 'CANCELADA';

export type Turno = 'MANHA' | 'TARDE' | 'NOITE';
export type ModalidadeAgendamento = 'HORARIO' | 'TURNO';
export type StatusAgendamento = 'AGENDADO' | 'REALIZADO' | 'FALTA' | 'CANCELADO';
export type ResultadoContato = 'SEM_RESPOSTA' | 'RECADO' | 'CONFIRMOU_RETORNO' | 'NUMERO_INVALIDO';

export interface PacienteResumo {
  id: number;
  nome: string;
  celular_mascarado: string | null;
}

export interface TentativaContato {
  id: number;
  resultado: ResultadoContato;
  realizada_em: string;
}

export interface Agendamento {
  id: number;
  modalidade: ModalidadeAgendamento;
  data_agendada: string;
  hora_agendada: string | null;
  turno: Turno | null;
  status: StatusAgendamento;
  falta_registrada_em: string | null;
  falta_corrigida_em: string | null;
  resultado_em: string | null;
  solicitacao?: {
    id: number;
    protocolo: string;
    nome_solicitante: string;
    prioridade?: Prioridade;
    status?: Status;
    agendamento_ativo?: Agendamento | null;
    paciente?: PacienteResumo | null;
  };
  ultima_tentativa_contato?: TentativaContato | null;
}

export type FaltaListItem = Agendamento;

export interface EntradaFilaItem {
  id: number;
  entrou_em: string;
  solicitacao: Solicitacao;
}

export interface Solicitacao {
  id: number;
  protocolo: string;
  nome_solicitante: string;
  cpf_solicitante: string;
  data_nascimento: string;
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
  /** Instante UTC (ISO 8601). Obrigatório em AGENDADA; pode ser histórico em CONCLUIDA/CANCELADA. */
  agendado_para: string | null;
  descricao: string;
  justificativa_prioridade: string | null;
  data_criacao: string;
  data_atualizacao: string;
  paciente?: PacienteResumo | null;
  agendamento_ativo?: Agendamento | null;
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

export interface ListaFaltas {
  data: FaltaListItem[];
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
  celular?: string | null;
}

/** Data e horário local (fuso operacional) de um agendamento — por horário exato ou por turno. */
export type AgendamentoPayload =
  | { data_agendada: string; hora_agendada: string; turno?: never }
  | { data_agendada: string; turno: Turno; hora_agendada?: never };

export type StatusSemAgendamento = Exclude<Status, 'AGENDADA'>;

export type AtualizarStatusPayload =
  | ({ status: 'AGENDADA' } & AgendamentoPayload)
  | {
      status: StatusSemAgendamento;
      data_agendada?: never;
      hora_agendada?: never;
      turno?: never;
    };

export type AtualizarSolicitacaoPayload = CriarSolicitacaoPayload;

export interface FiltrosSolicitacoes {
  q?: string;
  status?: Status;
  /** Agrupamento operacional: aberto ou histórico encerrado. */
  status_grupo?: 'aberto' | 'encerrado';
  categoria?: Categoria;
  prioridade?: Prioridade;
  /** Dia operacional (YYYY-MM-DD) da agenda; implica status AGENDADA. */
  data_agendada?: string;
  data_de?: string;
  data_ate?: string;
  ordenar_por?: OrdenarPor;
  direcao?: Direcao;
  page?: number;
  per_page?: number;
}

export interface FiltrosFila {
  page?: number;
  per_page?: number;
}

export interface FiltrosFaltas {
  q?: string;
  prioridade?: Prioridade;
  data?: string;
  data_de?: string;
  data_ate?: string;
  resultado_contato?: ResultadoContato;
  ordenar_por?: OrdenarPor;
  direcao?: Direcao;
  page?: number;
  per_page?: number;
}

export type OrdenarPor = 'prioridade' | 'data' | 'horario';
export type Direcao = 'asc' | 'desc';
export type SolicitacoesConsulta = FiltrosSolicitacoes & {
  visao?: 'fila' | 'agenda' | 'historico' | 'faltas';
  data?: string;
  inicio?: string;
  agendaPages?: Record<string, number>;
  resultado_contato?: ResultadoContato;
};

export interface RegistrarContatoPayload {
  resultado: ResultadoContato;
}

export interface ResumoSolicitacoes {
  status: Record<Status, number>;
  prioridade_aberta: Record<Prioridade, number>;
  /** ISO 8601 da solicitação em aberto mais antiga de cada prioridade, ou null se não houver nenhuma. */
  mais_antiga_aberta: Record<Prioridade, string | null>;
  total: number;
  filtros_aplicados: { categoria: Categoria | null; prioridade: Prioridade | null };
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

export const LABEL_TURNO: Record<Turno, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
};

export const LABEL_RESULTADO_CONTATO: Record<ResultadoContato, string> = {
  SEM_RESPOSTA:      'Sem resposta',
  RECADO:            'Recado deixado',
  CONFIRMOU_RETORNO: 'Confirmou retorno',
  NUMERO_INVALIDO:   'Número inválido',
};

export interface Notificacao {
  id: number;
  solicitacao_id: number;
  protocolo: string;
  status_anterior: string;
  status_novo: string;
  created_at: string;
  read_at: string | null;
}

export interface ListaNotificacoes {
  data: Notificacao[];
  unread_count: number;
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

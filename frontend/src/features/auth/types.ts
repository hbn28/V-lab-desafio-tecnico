export interface Operator {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  role: 'ADMINISTRADOR' | 'ATENDENTE';
}

export interface ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
}

export interface Operator {
  id: number;
  name: string;
  email: string;
  role: 'ADMINISTRADOR' | 'ATENDENTE';
}

export interface ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
}

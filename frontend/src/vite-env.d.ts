/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENDAMENTO_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

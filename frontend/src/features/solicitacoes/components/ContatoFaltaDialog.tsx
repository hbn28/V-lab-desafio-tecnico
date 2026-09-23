import { useState } from 'react';
import type { ResultadoContato } from '../types';
import { LABEL_RESULTADO_CONTATO } from '../types';
import { DialogOverlay } from './DialogOverlay';

const OPCOES: ResultadoContato[] = ['SEM_RESPOSTA', 'RECADO', 'CONFIRMOU_RETORNO', 'NUMERO_INVALIDO'];

interface ContatoFaltaDialogProps {
  submitting?: boolean;
  error?: string | null;
  onSalvar: (resultado: ResultadoContato) => void;
  onCancelar: () => void;
}

/** Diálogo de registro de tentativa de contato: apenas resultado fechado, sem texto livre. */
export function ContatoFaltaDialog({ submitting = false, error, onSalvar, onCancelar }: ContatoFaltaDialogProps) {
  const [resultado, setResultado] = useState<ResultadoContato | ''>('');

  return (
    <DialogOverlay labelledBy="contato-falta-heading" onClose={onCancelar}>
      <h2 id="contato-falta-heading">Registrar contato</h2>
      {error && <div className="alert alert--error alert--compact" role="alert"><p>{error}</p></div>}
      <fieldset disabled={submitting}>
        <legend>Resultado do contato</legend>
        {OPCOES.map(item => (
          <label key={item}>
            <input
              type="radio"
              name="contato-resultado"
              value={item}
              checked={resultado === item}
              onChange={() => setResultado(item)}
            />
            {LABEL_RESULTADO_CONTATO[item]}
          </label>
        ))}
      </fieldset>
      <div className="dialog__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={submitting || resultado === ''}
          onClick={() => resultado && onSalvar(resultado)}
        >
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className="button button--outline" onClick={onCancelar}>Cancelar</button>
      </div>
    </DialogOverlay>
  );
}

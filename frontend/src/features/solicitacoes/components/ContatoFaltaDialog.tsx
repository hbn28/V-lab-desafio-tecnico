import { useState } from 'react';
import type { ResultadoContato } from '../types';
import { LABEL_RESULTADO_CONTATO } from '../types';

const OPCOES: ResultadoContato[] = ['SEM_RESPOSTA', 'RECADO', 'CONFIRMOU_RETORNO', 'NUMERO_INVALIDO'];

interface ContatoFaltaDialogProps {
  submitting?: boolean;
  onSalvar: (resultado: ResultadoContato) => void;
  onCancelar: () => void;
}

/** Diálogo de registro de tentativa de contato: apenas resultado fechado, sem texto livre. */
export function ContatoFaltaDialog({ submitting = false, onSalvar, onCancelar }: ContatoFaltaDialogProps) {
  const [resultado, setResultado] = useState<ResultadoContato | ''>('');

  return (
    <div className="dialog" role="dialog" aria-labelledby="contato-falta-heading">
      <h2 id="contato-falta-heading">Registrar contato</h2>
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
    </div>
  );
}

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { Categoria, Direcao, OrdenarPor, Prioridade, SolicitacoesConsulta, Status } from '../types';
import { LABEL_CATEGORIA, LABEL_PRIORIDADE, LABEL_STATUS } from '../types';

interface SolicitacoesToolbarProps {
  consulta: SolicitacoesConsulta;
  opcoesOrdenacao: OrdenarPor[];
  total: number;
  mostrarStatus?: boolean;
  mostrarCategoria?: boolean;
  mostrarPrioridade?: boolean;
  mostrarPeriodo?: boolean;
  mostrarResultadoContato?: boolean;
  filtrosFixos?: Array<keyof SolicitacoesConsulta>;
  statusDisponiveis?: Status[];
  ordenacaoPadrao?: OrdenarPor;
  direcaoPadrao?: 'asc' | 'desc';
  onApply: (patch: Partial<SolicitacoesConsulta>) => void;
  onClear?: () => void;
}

interface ToolbarDraft {
  q: string;
  status: Status | '';
  categoria: Categoria | '';
  prioridade: Prioridade | '';
  data_de: string;
  data_ate: string;
  ordenar_por: OrdenarPor;
  direcao: Direcao;
  resultado_contato?: SolicitacoesConsulta['resultado_contato'];
}

export function SolicitacoesToolbar({
  consulta,
  opcoesOrdenacao,
  total,
  mostrarStatus = false,
  mostrarCategoria = false,
  mostrarPrioridade = false,
  mostrarPeriodo = false,
  mostrarResultadoContato = false,
  filtrosFixos = [],
  statusDisponiveis,
  ordenacaoPadrao,
  direcaoPadrao = 'asc',
  onApply,
  onClear,
}: SolicitacoesToolbarProps) {
  const prefix = useId().replace(/:/g, '');
  const primeiraOpcaoOrdenacao = opcoesOrdenacao[0];
  const [rascunho, setRascunho] = useState<ToolbarDraft>({
    q: '', status: '', categoria: '', prioridade: '', data_de: '', data_ate: '',
    ordenar_por: ordenacaoPadrao ?? primeiraOpcaoOrdenacao ?? 'prioridade', direcao: direcaoPadrao,
    resultado_contato: undefined,
  });

  useEffect(() => {
    setRascunho({
      q: consulta.q ?? '',
      status: consulta.status ?? '',
      categoria: consulta.categoria ?? '',
      prioridade: consulta.prioridade ?? '',
      data_de: consulta.data_de ?? '',
      data_ate: consulta.data_ate ?? '',
      ordenar_por: consulta.ordenar_por ?? ordenacaoPadrao ?? primeiraOpcaoOrdenacao ?? 'prioridade',
      direcao: consulta.direcao ?? direcaoPadrao,
      resultado_contato: consulta.resultado_contato,
    });
  }, [consulta, direcaoPadrao, primeiraOpcaoOrdenacao, ordenacaoPadrao]);

  const patch = <K extends keyof ToolbarDraft>(chave: K, valor: ToolbarDraft[K]) => {
    setRascunho(current => ({ ...current, [chave]: valor }));
  };
  const aplicar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply({
      ...rascunho,
      q: rascunho.q.trim() || undefined,
      status: rascunho.status || undefined,
      categoria: rascunho.categoria || undefined,
      prioridade: rascunho.prioridade || undefined,
      data_de: rascunho.data_de || undefined,
      data_ate: rascunho.data_ate || undefined,
      resultado_contato: rascunho.resultado_contato,
    });
  };

  const ativos: { key: keyof SolicitacoesConsulta; label: string }[] = [];
  if (consulta.q) ativos.push({ key: 'q', label: `Busca: ${consulta.q}` });
  if (consulta.status && !filtrosFixos.includes('status')) ativos.push({ key: 'status', label: `Status: ${LABEL_STATUS[consulta.status]}` });
  if (consulta.categoria && !filtrosFixos.includes('categoria')) ativos.push({ key: 'categoria', label: `Categoria: ${LABEL_CATEGORIA[consulta.categoria]}` });
  if (consulta.prioridade && !filtrosFixos.includes('prioridade')) ativos.push({ key: 'prioridade', label: `Prioridade: ${LABEL_PRIORIDADE[consulta.prioridade]}` });
  if (consulta.data_de) ativos.push({ key: 'data_de', label: `De: ${consulta.data_de}` });
  if (consulta.data_ate) ativos.push({ key: 'data_ate', label: `Até: ${consulta.data_ate}` });
  if (consulta.resultado_contato) ativos.push({ key: 'resultado_contato', label: `Contato: ${consulta.resultado_contato.replace(/_/g, ' ').toLowerCase()}` });

  const remover = (key: keyof SolicitacoesConsulta) => {
    onApply({ [key]: undefined, ...(key === 'status' && consulta.ordenar_por === 'horario' ? { ordenar_por: 'prioridade' } : {}) });
  };

  return (
    <section className="collection-controls" aria-label="Buscar e filtrar solicitações">
      <form className="collection-toolbar" onSubmit={aplicar}>
        <div className="filter-field collection-toolbar__search">
          <label htmlFor={`${prefix}-busca`}>Buscar solicitações</label>
          <input
            id={`${prefix}-busca`}
            type="search"
            value={String(rascunho.q ?? '')}
            onChange={event => patch('q', event.target.value)}
            placeholder="Protocolo ou nome"
          />
        </div>
        {mostrarStatus && (
          <div className="filter-field">
            <label htmlFor={`${prefix}-status`}>Status</label>
            <select id={`${prefix}-status`} value={rascunho.status} onChange={event => {
              const novoStatus = event.target.value as Status | '';
              setRascunho(current => ({
                ...current,
                status: novoStatus,
                ordenar_por: novoStatus === 'AGENDADA' ? 'horario' : novoStatus === 'CONCLUIDA' || novoStatus === 'CANCELADA' ? 'data' : 'prioridade',
                direcao: novoStatus === 'CONCLUIDA' || novoStatus === 'CANCELADA' ? 'desc' : current.direcao,
              }));
            }}>
              <option value="">Todos</option>
              {(statusDisponiveis ?? Object.keys(LABEL_STATUS) as Status[]).map((item: Status) => <option value={item} key={item}>{LABEL_STATUS[item]}</option>)}
            </select>
          </div>
        )}
        {mostrarCategoria && (
          <div className="filter-field">
            <label htmlFor={`${prefix}-categoria`}>Categoria</label>
            <select id={`${prefix}-categoria`} value={rascunho.categoria} onChange={event => patch('categoria', event.target.value as Categoria | '')}>
              <option value="">Todas</option>
              {(Object.keys(LABEL_CATEGORIA) as Categoria[]).map(item => <option value={item} key={item}>{LABEL_CATEGORIA[item]}</option>)}
            </select>
          </div>
        )}
        {mostrarPrioridade && (
          <div className="filter-field">
            <label htmlFor={`${prefix}-prioridade`}>Prioridade</label>
            <select id={`${prefix}-prioridade`} value={rascunho.prioridade} onChange={event => patch('prioridade', event.target.value as Prioridade | '')}>
              <option value="">Todas</option>
              {(['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'] satisfies Prioridade[]).map(item => <option value={item} key={item}>{LABEL_PRIORIDADE[item]}</option>)}
            </select>
          </div>
        )}
        {mostrarPeriodo && <>
          <div className="filter-field">
            <label htmlFor={`${prefix}-data-de`}>Data inicial</label>
            <input id={`${prefix}-data-de`} type="date" value={rascunho.data_de} onChange={event => patch('data_de', event.target.value)} />
          </div>
          <div className="filter-field">
            <label htmlFor={`${prefix}-data-ate`}>Data final</label>
            <input id={`${prefix}-data-ate`} type="date" value={rascunho.data_ate} onChange={event => patch('data_ate', event.target.value)} />
          </div>
        </>}
        {opcoesOrdenacao.length > 0 && (
          <div className="filter-field">
            <label htmlFor={`${prefix}-ordenar`}>Ordenar por</label>
            <select id={`${prefix}-ordenar`} value={rascunho.ordenar_por} onChange={event => patch('ordenar_por', event.target.value as OrdenarPor)}>
              {opcoesOrdenacao.map(item => <option value={item} key={item}>{item === 'prioridade' ? 'Prioridade' : item === 'data' ? 'Data' : 'Horário'}</option>)}
            </select>
          </div>
        )}
        {rascunho.ordenar_por !== 'prioridade' && (
          <div className="filter-field">
            <label htmlFor={`${prefix}-direcao`}>Ordem</label>
            <select id={`${prefix}-direcao`} value={rascunho.direcao} onChange={event => patch('direcao', event.target.value as Direcao)}>
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </div>
        )}
        {mostrarResultadoContato && (
          <div className="filter-field">
            <label htmlFor={`${prefix}-resultado-contato`}>Resultado do contato</label>
            <select id={`${prefix}-resultado-contato`} value={rascunho.resultado_contato ?? ''} onChange={event => patch('resultado_contato', (event.target.value || undefined) as ToolbarDraft['resultado_contato'])}>
              <option value="">Todos</option>
              <option value="SEM_RESPOSTA">Sem resposta</option>
              <option value="RECADO">Recado</option>
              <option value="CONFIRMOU_RETORNO">Confirmou retorno</option>
              <option value="NUMERO_INVALIDO">Número inválido</option>
            </select>
          </div>
        )}
        <div className="collection-toolbar__actions">
          <button className="button button--primary" type="submit">Aplicar filtros</button>
        </div>
      </form>
      <div className="collection-controls__footer">
        <p className="record-count" aria-live="polite">{total} {total === 1 ? 'resultado' : 'resultados'}</p>
        {ativos.length > 0 && <div className="active-filters" aria-label="Filtros ativos">
          {ativos.map(({ key, label }) => <button type="button" key={key} className="filter-chip" aria-label={`Remover filtro ${label.toLowerCase().replace(': ', ' ')}`} onClick={() => remover(key)}>{label} <span aria-hidden="true">×</span></button>)}
          <button type="button" className="button button--ghost" onClick={onClear ?? (() => onApply({ q: undefined, status: undefined, categoria: undefined, prioridade: undefined, data_de: undefined, data_ate: undefined }))}>Limpar filtros</button>
        </div>}
      </div>
    </section>
  );
}

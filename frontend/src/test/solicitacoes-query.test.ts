import { describe, expect, it } from 'vitest';
import { parseSolicitacoesQuery, serializeSolicitacoesQuery } from '../features/solicitacoes/hooks/useSolicitacoesQuery';

describe('estado de consulta de solicitações na URL', () => {
  it('preserva valores válidos e descarta ordenação inválida', () => {
    const query = parseSolicitacoesQuery('?visao=historico&prioridade=URGENTE&ordenar_por=sql&page=2');
    expect(query.visao).toBe('historico');
    expect(query.prioridade).toBe('URGENTE');
    expect(query.ordenar_por).toBeUndefined();
    expect(query.page).toBe(2);
  });

  it('serializa somente valores preenchidos e guarda paginação independente da agenda', () => {
    const query = parseSolicitacoesQuery('?visao=agenda&inicio=2026-09-22&agenda_page_2026-09-23=2');
    query.q = '';
    query.ordenar_por = 'horario';
    const params = serializeSolicitacoesQuery(query);

    expect(params.get('visao')).toBe('agenda');
    expect(params.get('inicio')).toBe('2026-09-22');
    expect(params.get('agenda_page_2026-09-23')).toBe('2');
    expect(params.get('ordenar_por')).toBe('horario');
    expect(params.has('q')).toBe(false);
  });
});

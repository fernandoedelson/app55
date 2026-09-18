# -*- coding: utf-8 -*-
"""A barra do relatório: onde estou, para onde vou. Monta a lista de seções que o leitor enxerga,
na ordem do relatório, para o seletor de seção e para "anterior / próxima"."""
from . import catalogo as C
from .seguranca import usuarios as U


def secoes_visiveis(ctx):
    vistos = {b['secao'] for b in U.blocos_visiveis(ctx) if not b.get('so_apresentacao')}
    return [s for s in C.SECOES if s['id'] in vistos]


def barra(ctx, secao_atual=None):
    secoes = secoes_visiveis(ctx)
    grupos = []
    for s in secoes:
        if not grupos or grupos[-1]['grupo'] != s['grupo']:
            grupos.append({'grupo': s['grupo'], 'secoes': []})
        grupos[-1]['secoes'].append(s)
    ids = [s['id'] for s in secoes]
    anterior = proxima = None
    if secao_atual in ids:
        i = ids.index(secao_atual)
        anterior = secoes[i - 1] if i > 0 else None
        proxima = secoes[i + 1] if i + 1 < len(secoes) else None
    atual = C.SECAO.get(secao_atual)
    return {'grupos': grupos, 'anterior': anterior, 'proxima': proxima, 'atual': atual}

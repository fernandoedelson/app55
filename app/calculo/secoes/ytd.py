# -*- coding: utf-8 -*-
"""Comparativo YTD — porte do cálculo de renderYTD() (app.js).

Devolve um payload por bloco, só com números e nomes; a formatação é do navegador."""
from ..datas import MES, ym_list
from ..vendas import PSEUDO_VEND, agregar


def calcular(C, params=None):
    DATA = C.blob('DATA')
    fim = C.maxym_vendas
    m_fim = fim % 100
    y1, y0 = C.ano_v, C.ano_v - 1
    i1, i0 = y1 * 100 + 1, y0 * 100 + 1
    a = agregar(DATA, i0, fim - 100)
    b = agregar(DATA, i1, fim)

    va = {}
    for x in a['vend']:
        va[x['name']] = x['v']
    vb = {}
    for x in b['vend']:
        vb[x['name']] = x['v']
    nomes = list(dict.fromkeys([x['name'] for x in a['vend']] + [x['name'] for x in b['vend']]))
    nomes = [n for n in nomes if n not in PSEUDO_VEND]
    linhas = [{'n': n, 'a': va.get(n, 0), 'b': vb.get(n, 0)} for n in nomes]
    linhas = [x for x in linhas if x['a'] + x['b'] > 0]
    linhas.sort(key=lambda x: -x['b'])

    resumo = lambda g: {'total': g['total'], 'peds': g['peds'], 'qnt': g['qnt'], 'ticket': g['ticket']}
    return {
        'ytd.abertura': {'Y0': y0, 'Y1': y1, 'mLab': MES[m_fim - 1]},
        'ytd-kpi': {'Y0': y0, 'Y1': y1, 'mLab': MES[m_fim - 1], 'a': resumo(a), 'b': resumo(b)},
        'ytd-linha': {'Y0': y0, 'Y1': y1, 'labels': MES[:m_fim],
                      'serieA': [a['monthly'].get(y, 0) for y in ym_list(i0, fim - 100)],
                      'serieB': [b['monthly'].get(y, 0) for y in ym_list(i1, fim)]},
        'ytd-ind': {'Y0': y0, 'Y1': y1, 'a': resumo(a), 'b': resumo(b)},
        'ytd-vendedor': {'Y0': y0, 'Y1': y1, 'linhas': [[x['n'], x['a'], x['b']] for x in linhas]},
    }

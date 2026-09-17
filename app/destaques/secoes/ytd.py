# -*- coding: utf-8 -*-
"""Destaques do Comparativo YTD — as duas chamadas de ins() de renderYTD (app.js):
oscilação da série do ano corrente (bloco ytd-linha) e rotatividade entre os dois anos (ytd-vendedor)."""
from ...calculo.datas import ym_lab, ym_list
from ...calculo.vendas import agregar
from ..genericas import rotatividade, serie_oscilacao


def montar(C, params=None):
    DATA = C.blob('DATA')
    fim = C.maxym_vendas
    y1, y0 = C.ano_v, C.ano_v - 1
    i1, i0 = y1 * 100 + 1, y0 * 100 + 1
    a = agregar(DATA, i0, fim - 100)
    b = agregar(DATA, i1, fim)
    yms = ym_list(i1, fim)
    yield ('ytd-linha', [], serie_oscilacao({
        'labels': [ym_lab(y) for y in yms],
        'vals': [b['monthly'].get(y, 0) for y in yms],
        'id': 'ytd'}))
    yield ('ytd-vendedor', [], rotatividade({
        'a': a['vend'], 'b': b['vend'], 'labelA': str(y0), 'labelB': str(y1),
        'escopo': 'vendedor(a)', 'escopoPl': 'vendedores', 'id': 'vendedor-ytd', 'tabela': True}))

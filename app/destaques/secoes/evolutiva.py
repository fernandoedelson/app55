# -*- coding: utf-8 -*-
"""Destaques da Evolutiva histórica — as três chamadas de ins() de renderEvolutiva (app.js)."""
from ...calculo.datas import ym_list
from ...calculo.vendas import agregar
from ..regras_vendas import efeito_preco_volume, partes_relacionadas, venda_vs_faturamento


def montar(C, params=None):
    yield ('evolutiva.abertura', [], partes_relacionadas(C))
    yield ('ev-anual', [], efeito_preco_volume(C))
    DATA = C.blob('DATA')
    A = agregar(DATA, 200001, 300000)
    yv = {}
    for ym in ym_list(C.minym_vendas, C.maxym_vendas):
        yv[ym // 100] = yv.get(ym // 100, 0) + A['monthly'].get(ym, 0)
    yield ('ev-anual', [], venda_vs_faturamento(C, {'vendaAnual': yv, 'id': None}))

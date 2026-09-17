# -*- coding: utf-8 -*-
"""Destaques da Performance Comercial — as três chamadas de ins() de renderPerformance (app.js)."""
from ...calculo.metas import metas_calc
from ..regras_meta import meta_dispersao, meta_ritmo, projecao_distancia


def montar(C, params=None):
    M = metas_calc(C)
    if not M:
        return
    ctx = {'metas': M}
    yield ('perf-acum', [], meta_ritmo(C, ctx))
    yield ('perf-mes', [], projecao_distancia(C, ctx))
    yield ('perf-mes', [], meta_dispersao(C, ctx))

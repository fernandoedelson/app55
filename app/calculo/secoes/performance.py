# -*- coding: utf-8 -*-
"""Performance Comercial — porte do cálculo de renderPerformance(): o metasCalc inteiro vai no
payload e o desenho monta KPIs, gráficos e tabelas a partir dele."""
from ..metas import metas_calc


def calcular(C, params=None):
    M = metas_calc(C)
    anos = C.anos_fechados(C.ano_v)
    base = {'M': M, 'anoV': C.ano_v, 'anosSaz0': anos[0] if anos else None}
    # cada bloco leva a SUA cópia: o bloco é a unidade de permissão e não pode dividir o objeto
    return {'performance.abertura': dict(base), 'perf-acum': dict(base), 'perf-mes': dict(base)}

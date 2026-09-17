# -*- coding: utf-8 -*-
"""Performance Comercial — porte do cálculo de renderPerformance(): o metasCalc inteiro vai no
payload e o desenho monta KPIs, gráficos e tabelas a partir dele."""
from ..metas import metas_calc


def calcular(C, params=None):
    M = metas_calc(C)
    anos = C.anos_fechados(C.ano_v)
    base = {'M': M, 'anoV': C.ano_v, 'anosSaz0': anos[0] if anos else None}
    return {'performance.abertura': base, 'perf-acum': base, 'perf-mes': base}

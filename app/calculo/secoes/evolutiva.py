# -*- coding: utf-8 -*-
"""Evolutiva histórica — porte do cálculo de renderEvolutiva() (app.js)."""
from ..datas import MES, ym_list
from ..numeros import cagr, soma
from ..sazonalidade import fracao_decorrida, lead_pico_anual, peso_mensal
from ..vendas import agregar


def calcular(C, params=None):
    DATA, DRE = C.blob('DATA'), C.blob('DRE')
    A = agregar(DATA, 200001, 300000)
    yms = ym_list(C.minym_vendas, C.maxym_vendas)
    vals = [A['monthly'].get(y, 0) for y in yms]

    yv, v_month = {}, {}
    for ym, v in zip(yms, vals):
        yr, mo = ym // 100, ym % 100 - 1
        yv[yr] = yv.get(yr, 0) + v
        v_month.setdefault(yr, [0] * 12)[mo] = v

    ano_v, ano_d = C.ano_v, C.ano_d
    years = C.anos_fechados(ano_v)
    a0, ai, na = ano_v - 1, C.ano_ini_serie, ano_v - C.ano_ini_serie
    dre = lambda y: DRE.get(str(y))
    dre_month = {y: dre(y)['months'] for y in years}
    peso_v, peso_f = peso_mensal(v_month, years), peso_mensal(dre_month, years)
    mo_v = C.maxym_vendas % 100 - 1
    mo_f = C.maxym_dre % 100 - 1 if ano_d == ano_v else -1
    cp_v, cp_f = fracao_decorrida(peso_v, mo_v), fracao_decorrida(peso_f, mo_f)
    v26 = yv.get(ano_v, 0)
    f26 = (dre(ano_v) or {'annual': 0})['annual']
    v26proj = v26 / cp_v if cp_v > 0 else None
    f26proj = f26 / cp_f if cp_f > 0 else None
    v25mesmo = soma((v_month.get(a0) or [0] * 12)[:mo_v + 1])
    f25mesmo = soma(((dre(a0) or {}).get('months') or [0] * 12)[:mo_f + 1])

    linhas = []
    for i, y in enumerate(years):
        linhas.append({'ano': y, 'venda': yv.get(y, 0), 'fat': dre(y)['annual'],
                       'var_v': yv[y] / yv[years[i - 1]] - 1 if i > 0 else None,
                       'var_f': dre(y)['annual'] / dre(years[i - 1])['annual'] - 1 if i > 0 else None,
                       'cagr_v': cagr(yv.get(y), yv.get(ai), y - ai), 'cagr_f': cagr(dre(y)['annual'], dre(ai)['annual'], y - ai)})
    realizado = {'venda': v26, 'fat': f26,
                 'var_v': v26 / v25mesmo - 1 if v25mesmo else None, 'var_f': f26 / f25mesmo - 1 if f25mesmo else None}
    projetado = {'venda': v26proj, 'fat': f26proj,
                 'var_v': v26proj / yv[a0] - 1 if v26proj is not None and yv.get(a0) else None,
                 'var_f': f26proj / dre(a0)['annual'] - 1 if f26proj is not None and dre(a0) and dre(a0)['annual'] else None,
                 'cagr_v': cagr(v26proj, yv.get(ai), na) if v26proj is not None else None,
                 'cagr_f': cagr(f26proj, dre(ai)['annual'], na) if f26proj is not None else None}
    parcial = C.ano_ini_serie > C.minym_vendas // 100
    return {
        'evolutiva.abertura': {'minym': C.minym_vendas, 'maxym': C.maxym_vendas, 'n_linhas': len(DATA['rows']),
                               'lead_pico': lead_pico_anual(C), 'labels': yms, 'serie': vals},
        'ev-anual': {'anos': years, 'ano_v': ano_v, 'a0': a0, 'ai': ai, 'maxym': C.maxym_vendas,
                     'linhas': linhas, 'realizado': realizado, 'projetado': projetado,
                     'parcial': {'ano': C.minym_vendas // 100, 'mes': MES[C.minym_vendas % 100 - 1].lower()} if parcial else None},
    }

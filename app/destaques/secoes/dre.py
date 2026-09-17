# -*- coding: utf-8 -*-
"""Destaques da DRE — as chamadas de ins() de renderDreBody() e drawDreSnap() (app.js).
O contexto `_dctx` do Kit é {dre: agregado do período, drePrev: janela anterior de mesmo tamanho}."""
from ...calculo.datas import ym_shift
from ...calculo.datas import ym_lab
from ...calculo.dre import DRE_LINES, dre_agg, dre_monthly, dre_years
from ...calculo.secoes.dre import _filtro, _meses, _minidre, _snap
from ..genericas import auto
from ..regras_dre import (comparativo_motor, custo_fixo_nivel, custo_fixo_rol, equilibrio_alavanca,
                          equilibrio_bruta, fabrica_loja, juros_ebitda, linha_que_mudou, margem_volume)


def montar(C, params=None):
    params = params or {}
    DPNL = C.blob('DPNL')
    ent, a, b = _filtro(C, params)
    g = dre_agg(DPNL, ent, a, b)
    n = _meses(a, b)
    p_b = ym_shift(a, -1)
    p_a = ym_shift(p_b, -(n - 1))
    g_prev = dre_agg(DPNL, ent, p_a, p_b)
    ctx = {'dre': g, 'drePrev': g_prev if g_prev['receita_liquida'] else None}
    yield ('dre-ponte', [], custo_fixo_nivel(ctx))
    yield ('dre-tabela', [], linha_que_mudou(ctx))
    # ponto de equilíbrio: a leitura em receita bruta acompanha o gráfico; a alavanca, a mini-DRE
    rolv, mc, cf, vol = g['receita_liquida'], g['margem_contrib'], -g['despesas_op'], g['volume']
    mc_pct = mc / rolv if rolv > 0 else 0
    mc_unit = mc / vol if vol > 0 else 0
    if mc_pct > 0 and cf > 0:
        pe_v = cf / mc_pct
        pe_q = cf / mc_unit if mc_unit > 0 else 0
        fixo_res = cf + (-g['deprec']) + (-g['financeiro']) - g['ajuste']
        pe_vr = fixo_res / mc_pct
        ded = (1 + g['deducoes'] / g['receita_bruta']) if g['receita_bruta'] and g['deducoes'] else None
        yield ('dre-breakeven', [], equilibrio_bruta({
            'rob': g['receita_bruta'], 'robEB': pe_v / ded if ded else pe_v,
            'robRZ': pe_vr / ded if ded else pe_vr, 'meses': n, 'vol': vol, 'peQ': pe_q}))
        md = _minidre(C, ent, a, b)
        if md.get('aplicavel'):
            g26 = dre_agg(DPNL, ent, md['ini'], md['fim'])
            yield ('dre-minidre', [], equilibrio_alavanca({
                'rol': g26['receita_liquida'], 'mc': g26['margem_contrib'], 'cf': md['cf'],
                'deprec': g26['deprec'], 'financeiro': g26['financeiro']}))
    yield ('dre-evol', [], juros_ebitda(ctx))
    vol_m = dre_monthly(DPNL, ent, a, b, 'volume')
    rb_m = dre_monthly(DPNL, ent, a, b, 'receita_bruta')
    yield ('dre-produto', [], margem_volume(ctx) or (auto({
        'itens': [{'name': ym_lab(x[0]), 'v': (rb_m[i][1] / x[1] if x[1] > 0 else 0), 'q': x[1]}
                  for i, x in enumerate(vol_m)],
        'escopo': 'mês', 'escopoPl': 'meses', 'universo': 'do ticket por produto', 'id': 'dre-ticket',
        'preferir': ['relacao', 'cauda']}) if len(vol_m) > 1 else None))
    anos = []
    for y in dre_years(DPNL, ent):
        gg = dre_agg(DPNL, ent, y * 100 + 1, y * 100 + 12)
        if gg['volume'] > 0:
            anos.append({'name': str(y), 'v': gg['ticket_prod'], 'q': gg['volume'], 'extra': -gg['custo_prod']})
    yield ('dre-produto-ano', [], auto({'itens': anos, 'escopo': 'ano', 'escopoPl': 'anos',
                                        'universo': 'do preço por produto', 'rotuloExtra': 'custo',
                                        'id': 'dre-hist-prod', 'tabela': True,
                                        'preferir': ['relacao', 'divergencia']}))
    if ent == 'CONSOLIDADO':
        f, d = dre_agg(DPNL, 'FABRICA', a, b), dre_agg(DPNL, 'DESIGN', a, b)
        yield ('dre-fabloja', [], fabrica_loja({'f': f, 'd': d, 'g': g}))
        yield ('dre-fabloja', [], auto({
            'itens': [{'name': 'Fábrica', 'v': f['receita_liquida'], 'q': f['volume'], 'extra': f['margem_contrib']},
                      {'name': 'Loja', 'v': d['receita_liquida'], 'q': d['volume'], 'extra': d['margem_contrib']}],
            'escopo': 'unidade', 'escopoPl': 'unidades', 'universo': 'da receita do período',
            'rotuloExtra': 'margem', 'id': 'dre-fabloja', 'tabela': True,
            'preferir': ['taxa', 'divergencia']}))
        yield ('dre-fabloja', [], custo_fixo_rol(ctx))
    s = _snap(C, params)
    cols = [[None, {k: s['linhas'][i][2][j] for i, (k, _, _) in enumerate(DRE_LINES)}] for j in range(4)]
    # no Kit há um fallback para dreLinhaQueMudou, que nunca dispara aqui: o ctx do comparativo
    # não tem os agregados que aquela regra exige
    yield ('dre-snap', [], comparativo_motor({'cols': cols, 'linhas': DRE_LINES}))

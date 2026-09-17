# -*- coding: utf-8 -*-
"""DRE — porte de renderDreBody(), buildDreFilter() e drawDreSnap() (app.js).

Parâmetros: ent (CONSOLIDADO|FABRICA|DESIGN), de/ate (AAAAMM; 200001/300000 = histórico) para o corpo;
emp e ym para o comparativo mensal, que é independente do filtro de cima."""
from ..datas import ym_shift
from ..dre import DRE_LINES, dre_agg, dre_monthly, dre_years

ENTS = ('CONSOLIDADO', 'FABRICA', 'DESIGN')
ENT_NOME = {'CONSOLIDADO': 'Consolidado', 'FABRICA': 'Fábrica (+55 Fábrica)', 'DESIGN': 'Loja (+55 Design)'}
ENT_CURTO = {'CONSOLIDADO': 'Consolidado', 'FABRICA': 'Fábrica', 'DESIGN': 'Loja'}


def _int(v, padrao):
    try:
        return int(v)
    except (TypeError, ValueError):
        return padrao


def _meses(a, b):
    return (b // 100 - a // 100) * 12 + (b % 100) - (a % 100) + 1


def presets(C):
    D, M = C.ano_d, C.maxym_dre
    return ([[str(y), y * 100 + 1, y * 100 + 12] for y in C.anos_fechados(D)]
            + [[None, D * 100 + 1, M], ['Últimos 12m', ym_shift(M, -11), M], ['Histórico', 200001, 300000]])


def _filtro(C, params):
    ent = params.get('ent') if params.get('ent') in ENTS else 'CONSOLIDADO'
    valido = lambda v: v in (200001, 300000) or (200001 <= v <= 300000 and 1 <= v % 100 <= 12)
    a = _int(params.get('de'), C.ano_d * 100 + 1)
    b = _int(params.get('ate'), C.maxym_dre)
    if not valido(a):
        a = C.ano_d * 100 + 1
    if not valido(b):
        b = C.maxym_dre
    if a > b:
        a, b = b, a
    return ent, a, b


def _breakeven(g):
    rolv, mc, cf, vol = g['receita_liquida'], g['margem_contrib'], -g['despesas_op'], g['volume']
    mc_pct = mc / rolv if rolv > 0 else 0
    mc_unit = mc / vol if vol > 0 else 0
    if not (mc_pct > 0 and cf > 0):
        return None
    pe_v = cf / mc_pct
    pe_q = cf / mc_unit if mc_unit > 0 else 0
    marg_seg = (rolv - pe_v) / rolv if rolv > 0 else 0
    preco_u = rolv / vol if vol > 0 else 0
    cv_u = (rolv - mc) / vol if vol > 0 else 0
    q_max = max(vol, pe_q) * 1.35
    qs = [q_max * i / 8 for i in range(9)]
    return {'mc_pct': mc_pct, 'pe_v': pe_v, 'pe_q': pe_q, 'marg_seg': marg_seg, 'qs': qs,
            'receita': [preco_u * q for q in qs], 'custo': [cf + cv_u * q for q in qs],
            'vol': vol, 'rolv': rolv, 'preco_u': preco_u, 'cv_u': cv_u, 'cf': cf}


def _minidre(C, ent, a, b):
    y26a, y26b = max(a, C.minym_dre), min(b, C.maxym_dre)
    g = dre_agg(C.blob('DPNL'), ent, y26a, y26b)
    meses = max(1, _meses(y26a, y26b))
    mc_pct = g['margem_contrib'] / g['receita_liquida'] if g['receita_liquida'] else 0
    vol = g['volume']
    mc_unit = g['margem_contrib'] / vol if vol > 0 else 0
    cf = -g['despesas_op']
    out = {'ini': y26a, 'fim': y26b, 'meses': meses}
    if not (mc_pct > 0 and cf > 0):
        out['aplicavel'] = False
        return out
    pe_v = cf / mc_pct
    pe_q = cf / mc_unit if mc_unit > 0 else 0
    ded_pct = g['deducoes'] / g['receita_bruta'] if g['receita_bruta'] else 0
    rob_eb = pe_v / (1 + ded_pct) if (1 + ded_pct) else pe_v
    ded_eb = pe_v - rob_eb
    mc_eb = pe_v * mc_pct
    ebitda_eb = mc_eb - cf

    def m6(lab, real, eq, bold=False):
        rm, em = real / meses, eq / meses
        return {'lab': lab, 'q': False, 'bold': bold, 'v': [real, eq, real - eq, rm, em, rm - em]}

    def q6(lab, r, e):
        rm, em = r / meses, e / meses
        return {'lab': lab, 'q': True, 'bold': False, 'v': [r, e, r - e, rm, em, rm - em]}

    out.update({
        'aplicavel': True,
        'linhas': [m6('Receita Operacional Bruta', g['receita_bruta'], rob_eb),
                   m6('(−) Deduções de Receita', g['deducoes'], ded_eb),
                   m6('Receita Líquida', g['receita_liquida'], pe_v, True),
                   q6('Quantidade (produtos)', vol, pe_q),
                   m6('(−) Custos Variáveis', g['custos_var'], -pe_v * (1 - mc_pct)),
                   m6('= Margem de Contribuição', g['margem_contrib'], mc_eb, True),
                   m6('(−) Custo Fixo', -cf, -cf),
                   m6('= EBITDA', g['ebitda'], ebitda_eb, True)],
        'cf': cf, 'pe_v': pe_v, 'pe_q': pe_q, 'rob_eb': rob_eb, 'rl': g['receita_liquida'], 'rb': g['receita_bruta'],
        'pe_v_mes': pe_v / meses, 'rl_mes': g['receita_liquida'] / meses, 'ded_pct': ded_pct,
        'marg_seg': (g['receita_liquida'] - pe_v) / g['receita_liquida'] if g['receita_liquida'] > 0 else 0,
    })
    return out


def _snap(C, params):
    DPNL = C.blob('DPNL')
    maxym = C.maxym_dre
    ano_atual, mes_atual = maxym // 100, maxym % 100
    meses = [ano_atual * 100 + m for m in range(1, mes_atual + 1)]
    emp = params.get('emp') if params.get('emp') in ENTS else 'CONSOLIDADO'
    ym = _int(params.get('ym'), maxym)
    if ym not in meses:
        ym = maxym
    prev, ano = ym_shift(ym, -1), ym // 100
    aggs = [dre_agg(DPNL, emp, ym, ym), dre_agg(DPNL, emp, prev, prev),
            dre_agg(DPNL, emp, ano * 100 + 1, ym), dre_agg(DPNL, emp, (ano - 1) * 100 + 1, ym - 100)]
    return {'emp': emp, 'ym': ym, 'prev': prev, 'ano': ano, 'meses': meses,
            'linhas': [[lab, tipo, [g[k] for g in aggs]] for k, lab, tipo in DRE_LINES]}


def calcular(C, params=None):
    params = params or {}
    DPNL = C.blob('DPNL')
    ent, a, b = _filtro(C, params)
    g = dre_agg(DPNL, ent, a, b)
    chaves = ['receita_bruta', 'deducoes', 'receita_liquida', 'custos_var', 'margem_contrib', 'despesas_op', 'ebitda',
              'deprec', 'financeiro', 'ajuste', 'result_liq', 'mc_pct', 'eb_pct', 'rl_pct', 'cf_pct']
    sub = lambda x: {k: x[k] for k in chaves}
    out = {
        'dre.abertura': {'ent': ent, 'a': a, 'b': b, 'minym': C.minym_dre, 'maxym': C.maxym_dre, 'ano': C.ano_d,
                         'presets': presets(C), 'minym_vendas': C.minym_vendas, 'maxym_vendas': C.maxym_vendas,
                         'nome': ENT_NOME[ent], 'g': sub(g)},
        'dre-ponte': {'g': sub(g)},
        'dre-tabela': {'linhas': [[lab, tipo, g[k], g[k] / (g['receita_liquida'] or 1)] for k, lab, tipo in DRE_LINES]},
    }
    be = _breakeven(g)
    out['dre-breakeven'] = {'nome': ENT_NOME[ent], 'pe': be}
    if be:
        out['dre-minidre'] = _minidre(C, ent, a, b)
    rl_m = dre_monthly(DPNL, ent, a, b, 'receita_liquida')
    if len(rl_m) > 1:
        out['dre-evol'] = {'yms': [x[0] for x in rl_m], 'rl': [x[1] for x in rl_m],
                           'eb': [x[1] for x in dre_monthly(DPNL, ent, a, b, 'ebitda')]}
    vol_m = dre_monthly(DPNL, ent, a, b, 'volume')
    rb_m = dre_monthly(DPNL, ent, a, b, 'receita_bruta')
    cpv_m = dre_monthly(DPNL, ent, a, b, 'cpv')
    rl2_m = dre_monthly(DPNL, ent, a, b, 'receita_liquida')
    prod = {'nome': ENT_NOME[ent], 'volume': g['volume'], 'ticket': g['ticket_prod'], 'rol': g['rol_prod'],
            'custo': g['custo_prod'], 'gvv': g['gvv_prod'], 'mc': g['mc_prod'],
            'mc_rol': g['mc_prod'] / g['rol_prod'] if g['rol_prod'] else None}
    if len(vol_m) > 1:
        prod['serie'] = {'yms': [x[0] for x in vol_m],
                         'ticket': [rb_m[i][1] / x[1] if x[1] > 0 else None for i, x in enumerate(vol_m)],
                         'rol': [rl2_m[i][1] / x[1] if x[1] > 0 else None for i, x in enumerate(vol_m)],
                         'custo': [abs(cpv_m[i][1]) / x[1] if x[1] > 0 else None for i, x in enumerate(vol_m)]}
    out['dre-produto'] = prod
    anos = []
    for y in dre_years(DPNL, ent):
        gg = dre_agg(DPNL, ent, y * 100 + 1, y * 100 + 12)
        if gg['volume'] > 0:
            anos.append([y, gg['volume'], gg['ticket_prod'], gg['rol_prod'], -gg['custo_prod'], -gg['gvv_prod'],
                         gg['mc_prod'], gg['mc_prod'] / gg['rol_prod'] if gg['rol_prod'] else 0])
    out['dre-produto-ano'] = {'anos': anos}
    if ent == 'CONSOLIDADO':
        f, d = dre_agg(DPNL, 'FABRICA', a, b), dre_agg(DPNL, 'DESIGN', a, b)
        out['dre-fabloja'] = {'f': sub(f), 'd': sub(d), 'g': sub(g), 'yms': [x[0] for x in rl_m],
                              'rl_f': [x[1] for x in dre_monthly(DPNL, 'FABRICA', a, b, 'receita_liquida')],
                              'rl_d': [x[1] for x in dre_monthly(DPNL, 'DESIGN', a, b, 'receita_liquida')]}
    s = _snap(C, params)
    s['nome'] = ENT_CURTO[s['emp']]
    out['dre-snap'] = s
    return out

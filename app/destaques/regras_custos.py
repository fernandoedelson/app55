# -*- coding: utf-8 -*-
"""Regras de custo — porte de R.cpvAbsorcao, R.cpvMix, R.custoUnitarioVolume, R.custoEvitavel,
R.taxaHoraCC e R.comparaAnos (insights.js)."""
from ..calculo.numeros import soma
from .nucleo import destaque, media, nucleo_material, quantos_para

MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']


def _janela_cpv(rows, y0, y1):
    o = {'mp': 0, 'mo': 0, 'ggf': 0, 'q': 0, 'tot': 0}
    for r in rows:
        if r[0] < y0 or r[0] > y1:
            continue
        o['mp'] += r[3]
        o['mo'] += r[4]
        o['ggf'] += r[5]
        o['q'] += r[2]
        o['tot'] += r[6]
    if not o['tot']:
        o['tot'] = o['mp'] + o['mo'] + o['ggf']
    return o


def absorcao(C, ctx):
    rows = (C.blob('CUSTOS') or {}).get('cpv')
    a = ctx.get('custosA')
    if not rows or not a or a[0] is None:
        return None
    o = _janela_cpv(rows, a[0], a[1])
    if not o['tot'] or not o['q']:
        return None
    sh_g = o['ggf'] / o['tot']
    if sh_g < .45:
        return None
    unit = o['tot'] / o['q']
    unit_var = (o['mp'] + o['mo']) / o['q']
    q10 = o['q'] * 1.1
    return destaque('cpvAbsorcao', ctx, 'oculto', sh_g,
                    {'shG': sh_g, 'shMp': o['mp'] / o['tot'], 'unit': unit, 'unitVar': unit_var,
                     'unit10': (o['ggf'] + (o['mp'] + o['mo']) * 1.1) / q10},
                    tom='warn', labels=['Gastos gerais', 'GGF'], id_fixo='cpv-absorcao')


def mix(C, ctx):
    rows = (C.blob('CUSTOS') or {}).get('cpv')
    a, b = ctx.get('custosA'), ctx.get('custosB')
    if not rows or not a or not b or a[0] is None or b[0] is None:
        return None
    cur, pre = _janela_cpv(rows, a[0], a[1]), _janela_cpv(rows, b[0], b[1])
    if not cur['tot'] or not pre['tot'] or not cur['q'] or not pre['q']:
        return None
    comps = [('Matéria-prima', 'mp'), ('Mão de obra', 'mo'), ('Estrutura da fábrica', 'ggf')]
    movs = [{'nome': nome, 'k': k, 'shA': pre[k] / pre['tot'], 'shB': cur[k] / cur['tot']} for nome, k in comps]
    for m in movs:
        m['d'] = m['shB'] - m['shA']
    movs.sort(key=lambda m: -abs(m['d']))
    m = movs[0]
    if abs(m['d']) < .03:
        return None
    u_a, u_b = pre['tot'] / pre['q'], cur['tot'] / cur['q']
    unit_a, unit_b = pre[m['k']] / pre['q'], cur[m['k']] / cur['q']
    return destaque('cpvMix', ctx, 'decomposicao', abs(m['d']) * 10,
                    {'nome': m['nome'], 'shA': m['shA'], 'shB': m['shB'], 'd': m['d'], 'unitA': unit_a,
                     'unitB': unit_b, 'uA': u_a, 'uB': u_b, 'q': cur['q'],
                     'vale': abs(unit_b - unit_a) * cur['q']},
                    tom='warn' if m['d'] > 0 else 'note',
                    labels=[m['nome'], 'GGF'] if m['k'] == 'ggf' else [m['nome']], id_fixo='cpv-mix')


def unitario_volume(ctx):
    M = [m for m in (ctx.get('meses') or []) if m[5] > 0 and m[4] > 0]
    if len(M) < 4:
        return None
    un = [{'q': m[5], 'u': m[4] / m[5]} for m in M]
    ordem = sorted(un, key=lambda x: -x['q'])
    meio = len(ordem) // 2
    altos, baixos = ordem[:meio], ordem[-meio:] if meio else []
    if not altos or not baixos:
        return None
    u_alto, u_baixo = media([x['u'] for x in altos]), media([x['u'] for x in baixos])
    q_alto, q_baixo = media([x['q'] for x in altos]), media([x['q'] for x in baixos])
    if not u_alto or not u_baixo:
        return None
    d = u_baixo / u_alto - 1
    if d < .08:
        return None
    return destaque('custoUnitarioVolume', ctx, 'oculto', d * 2.5,
                    {'uAlto': u_alto, 'uBaixo': u_baixo, 'qAlto': q_alto, 'qBaixo': q_baixo, 'd': d,
                     'rotulo': ctx.get('rotulo') or 'produzidas'},
                    tom='warn',
                    id_fixo='custo-unitario-volume' + ('-' + ctx['id'] if ctx.get('id') else ''))


def evitavel(ctx):
    R2, A, base = ctx.get('ret'), ctx.get('ass'), ctx.get('base')
    if not R2 or not A or not base:
        return None
    tot = (R2.get('total') or 0) + (A.get('total') or 0)
    if not tot or tot / base < .005:
        return None
    sh = tot / base
    cc = sorted(({'name': x[0], 'v': x[1]} for x in (R2.get('porCC') or []) if x[1] > 0), key=lambda x: -x['v'])
    k = quantos_para([x['v'] for x in cc], .8) if cc else 0
    prod = [x for x in (A.get('porProduto') or []) if x[1] > 0]
    maior = max(prod, key=lambda x: x[1]) if prod else None
    return destaque('custoEvitavel', ctx, 'consequencia', sh * 18,
                    {'tot': tot, 'sh': sh, 'ret': R2.get('total') or 0, 'ass': A.get('total') or 0,
                     'k': k, 'maiorProd': maior[0] if maior else None, 'maiorV': maior[1] if maior else 0},
                    tom='warn' if sh > .03 else 'note',
                    id_fixo='custo-evitavel' + ('-' + ctx['id'] if ctx.get('id') else ''))


def taxa_hora(ctx):
    L = [{'name': x[0], 'v': x[3] or (x[1] + x[2]), 'horas': x[4], 'taxa': x[7]}
         for x in (ctx.get('cc') or []) if len(x) > 7]
    L = [x for x in L if x['horas'] > 0 and x['taxa'] > 0]
    if len(L) < 3:
        return None
    nucleo = nucleo_material(L, 'horas', .8, 3)
    if len(nucleo) < 2:
        return None
    ordem = sorted(nucleo, key=lambda x: -x['taxa'])
    caro, barato = ordem[0], ordem[-1]
    razao = caro['taxa'] / barato['taxa']
    if razao < 1.4:
        return None
    horas_tot = soma(x['horas'] for x in nucleo)
    return destaque('taxaHoraCC', ctx, 'divergencia', (razao - 1) / 2,
                    {'caro': caro['name'], 'taxaCaro': caro['taxa'], 'horasCaro': caro['horas'],
                     'barato': barato['name'], 'taxaBarato': barato['taxa'], 'horasBarato': barato['horas'],
                     'razao': razao, 'media': soma(x['v'] for x in nucleo) / horas_tot, 'horas': horas_tot},
                    labels=[caro['name'], barato['name']],
                    id_fixo='taxa-hora-cc' + ('-' + ctx['id'] if ctx.get('id') else ''))


def compara_anos(ctx):
    anos, ordem = ctx.get('anos') or {}, ctx.get('ordem') or []
    if len(ordem) < 2:
        return None
    serie = lambda a: [(None if x is None else float(x)) for x in (anos.get(str(a)) or anos.get(a) or [])]
    med = lambda a: (lambda v: soma(v) / len(v) if v else 0)([x for x in serie(a) if x is not None and x > 0])
    A, B = ordem[-2], ordem[-1]
    m_a, m_b = med(A), med(B)
    if not m_a or not m_b:
        return None
    d = m_b / m_a - 1
    if abs(d) < .03:
        return None
    s_a, s_b = serie(A), serie(B)
    acima = comparaveis = 0
    maior_mes, maior_d = None, 0
    for i in range(12):
        if i >= len(s_a) or i >= len(s_b) or s_a[i] is None or s_b[i] is None or not s_a[i]:
            continue
        comparaveis += 1
        dd = s_b[i] / s_a[i] - 1
        if dd > 0:
            acima += 1
        if abs(dd) > abs(maior_d):
            maior_d, maior_mes = dd, i
    return destaque('comparaAnos', ctx, 'padrao', abs(d) * 3,
                    {'A': A, 'B': B, 'mA': m_a, 'mB': m_b, 'd': d, 'acima': acima, 'comparaveis': comparaveis,
                     'maiorMes': MESES_CURTO[maior_mes] if maior_mes is not None else None,
                     'maiorD': maior_d},
                    tom='warn' if d > 0 else 'ok',
                    id_fixo='compara-anos' + ('-' + ctx['id'] if ctx.get('id') else ''))

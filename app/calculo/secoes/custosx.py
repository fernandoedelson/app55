# -*- coding: utf-8 -*-
"""Custos — Visão executiva (CPV) — porte de renderCustosX(), renderCxGrpTable(), cxgGroupDrivers()
e renderCxgDrivers() (app.js).

Parâmetros: de/ate (período da leitura executiva) e cxa/cxb (os dois meses do comparativo A × B,
que têm filtro próprio no Kit). Os materiais de uma categoria e os produtos de um grupo de driver
saem por detalhamento."""
from ..custos import custos_agg, moggf_por_tipo_de_conta, reconciliar
from ..datas import ym_shift
from ..numeros import ordem_chaves_js, soma

EXCL = ['MATERIAIS']


def _int(v, padrao):
    try:
        return int(v)
    except (TypeError, ValueError):
        return padrao


def _meses(a, b):
    return (b // 100 - a // 100) * 12 + (b % 100) - (a % 100) + 1


def _presets(C):
    """CUSTOSX_PRESETS: último mês, ano corrente YTD, últimos 12m e o ano anterior (se a base o cobre)."""
    maxym, minym, ano = C.maxym_custos, C.minym_custos, C.ano_c
    p = [['Último mês', maxym, maxym], [None, ano * 100 + 1, maxym], ['Últimos 12m', ym_shift(maxym or 101, -11), maxym]]
    if (ano - 1) * 100 + 12 >= minym:
        p.append([str(ano - 1), (ano - 1) * 100 + 1, (ano - 1) * 100 + 12])
    return p


def _filtro(C, params):
    valido = lambda v: 200001 <= v <= 300000 and 1 <= v % 100 <= 12
    ini = max(C.ano_c * 100 + 1, C.minym_custos or 0)
    a, b = _int(params.get('de'), ini), _int(params.get('ate'), C.maxym_custos)
    a = a if valido(a) else ini
    b = b if valido(b) else C.maxym_custos
    return (b, a) if a > b else (a, b)


def _ab(C, params, cx_max):
    """Meses do comparativo A × B: por padrão B = fim do período e A = mês anterior."""
    valido = lambda v: v and 200001 <= v <= 300000 and 1 <= v % 100 <= 12
    b = _int(params.get('cxb'), cx_max)
    b = b if valido(b) else cx_max
    pad_a = ym_shift(cx_max, -1)
    a = _int(params.get('cxa'), pad_a if pad_a >= C.minym_custos else cx_max)
    if not valido(a):
        a = pad_a if pad_a >= C.minym_custos else cx_max
    return a, b


def _impacto(qa, ca, qb, cb):
    ua = ca / qa if qa else 0
    ub = cb / qb if qb else 0
    um_zero = (qa == 0) != (qb == 0)
    ambos = qa > 0 and qb > 0
    mix = (qb - qa) * (ub if qb > 0 else ua) if um_zero else 0
    vol = (qb - qa) * ub if ambos else 0
    cst = (ub - ua) * qa if ambos else 0
    return {'mix': mix, 'vol': vol, 'cst': cst, 'total': mix + vol + cst}


def _merge_produtos(agg_a, agg_b):
    mapa = {}
    for lado, agg in (('A', agg_a), ('B', agg_b)):
        for p in (agg or {}).get('produtos') or []:
            k = p['prod'] + '||' + p['grp']
            o = mapa.setdefault(k, {'prod': p['prod'], 'grp': p['grp'], 'qtyA': 0, 'custoA': 0, 'qtyB': 0, 'custoB': 0})
            o['qty' + lado] += p['qtd']
            o['custo' + lado] += p['custo']
    return [mapa[k] for k in ordem_chaves_js(mapa)]


def _drivers(agg_a, agg_b):
    grp = {}
    for p in _merge_produtos(agg_a, agg_b):
        im = _impacto(p['qtyA'], p['custoA'], p['qtyB'], p['custoB'])
        g = grp.setdefault(p['grp'], {'grp': p['grp'], 'mix': 0, 'vol': 0, 'cst': 0, 'total': 0, 'custoA': 0, 'custoB': 0})
        for k in ('mix', 'vol', 'cst', 'total'):
            g[k] += im[k]
        g['custoA'] += p['custoA']
        g['custoB'] += p['custoB']
    return sorted((grp[k] for k in ordem_chaves_js(grp)), key=lambda g: -abs(g['total']))


def _pontos(a, prev, t):
    """Os números dos sete 'pontos que importam' (o texto é montado no desenho)."""
    comp_a = next((g for g in a['grupos'] if g[0] == 'COMPONENTES'), None)
    tX = {'qtd': t['qtd'] - (comp_a[1] if comp_a else 0), 'mat': t['mat'] - (comp_a[2] if comp_a else 0),
          'mod': t['mod'] - (comp_a[3] if comp_a else 0), 'ggf': t['ggf'] - (comp_a[4] if comp_a else 0),
          'custo': t['custo'] - (comp_a[5] if comp_a else 0)}
    grupos_x = [g for g in a['grupos'] if g[0] != 'COMPONENTES']
    comp_p = next((g for g in prev['grupos'] if g[0] == 'COMPONENTES'), None) if prev else None
    prev_tx = ({'qtd': prev['total']['qtd'] - (comp_p[1] if comp_p else 0),
                'custo': prev['total']['custo'] - (comp_p[5] if comp_p else 0)} if prev else None)
    un_x = tX['custo'] / tX['qtd'] if tX['qtd'] else 0
    p_un_x = prev_tx['custo'] / prev_tx['qtd'] if prev and prev_tx['qtd'] else 0
    comp_max = sorted([['Matéria-prima', tX['mat']], ['Mão de obra', tX['mod']], ['GGF', tX['ggf']]], key=lambda x: -x[1])[0]
    cat_prev = {c: v for c, v in (prev['materiais'] if prev else [])}
    cat_move = None
    if prev:
        movs = sorted(([c, v, cat_prev.get(c, 0), v - cat_prev.get(c, 0)] for c, v in a['materiais']
                       if cat_prev.get(c, 0) > 0), key=lambda x: -x[3])
        cat_move = movs[0] if movs else None
    cat_top = a['materiais'][0] if a['materiais'] else None
    grp_prev = {g[0]: {'q': g[1], 'c': g[5]} for g in (prev['grupos'] if prev else [])}
    grp_top = grupos_x[0] if grupos_x else None
    grp_press = None
    if prev:
        cand = []
        for g in grupos_x:
            if not (g[5] > tX['custo'] * 0.05 and g[1]):
                continue
            ua = g[5] / g[1]
            gp = grp_prev.get(g[0])
            ub = gp['c'] / gp['q'] if gp and gp['q'] else 0
            if ub:
                cand.append([g[0], ua, ub, ua / ub - 1])
        cand.sort(key=lambda x: -x[3])
        grp_press = cand[0] if cand else None
    ret_map = {}
    for x in a['retrabalho']['porItem']:
        ret_map[x[1]] = ret_map.get(x[1], 0) + x[2]
    ret_top = sorted(([k, ret_map[k]] for k in ordem_chaves_js(ret_map)), key=lambda x: -x[1])
    cc_caro = sorted((x for x in a['cc'] if x[7] > 0), key=lambda x: -x[7])
    qa = prev_tx['qtd'] if prev else 0
    qb = tX['qtd']
    ua_avg = prev_tx['custo'] / qa if qa else 0
    vol_eff = (qb - qa) * ua_avg if prev else 0
    mix_eff = cost_eff = 0
    top_mix = top_cost = None
    if prev:
        unit_a = {g[0]: (g[5] / g[1] if g[1] else 0) for g in prev['grupos']}
        efeitos = [[g[0], g[1] * (unit_a.get(g[0], 0) - ua_avg), g[1] * ((g[5] / g[1] if g[1] else 0) - unit_a.get(g[0], 0))]
                   for g in grupos_x]
        mix_eff = soma(e[1] for e in efeitos)
        cost_eff = soma(e[2] for e in efeitos)
        top_mix = sorted(efeitos, key=lambda e: -abs(e[1]))[0] if efeitos else None
        top_cost = sorted(efeitos, key=lambda e: -abs(e[2]))[0] if efeitos else None
    return {'tX': tX, 'un_x': un_x, 'p_un_x': p_un_x, 'comp_max': comp_max, 'cat_move': cat_move, 'cat_top': cat_top,
            'grp_press': grp_press, 'grp_top': grp_top, 'ret_top': ret_top[0] if ret_top else None,
            'cc_caro': cc_caro[0] if cc_caro else None, 'prev_tx': prev_tx, 'qa': qa, 'qb': qb,
            'vol_eff': vol_eff, 'mix_eff': mix_eff, 'cost_eff': cost_eff, 'top_mix': top_mix, 'top_cost': top_cost,
            'mat_total': t['mat']}


def calcular(C, params=None):
    params = params or {}
    CU = C.blob('CUSTOS')
    out = {'custosx.abertura': {'tem': bool(CU)}}
    if not CU:
        return out
    cx_min, cx_max = _filtro(C, params)
    abertura = out['custosx.abertura']
    abertura.update({'a': cx_min, 'b': cx_max, 'minym': C.minym_custos, 'maxym': C.maxym_custos,
                     'ano': C.ano_c, 'presets': _presets(C)})
    a = reconciliar(custos_agg(CU, cx_min, cx_max, EXCL))
    t = a['total']
    if not t['custo']:
        abertura['vazio'] = True
        return out
    ln = _meses(cx_min, cx_max)
    p_max = ym_shift(cx_min, -1)
    p_min = ym_shift(p_max, -(ln - 1))
    prev = reconciliar(custos_agg(CU, p_min, p_max, EXCL)) if p_min >= C.minym_custos else None
    if not (prev and prev['total']['custo']):
        prev = None
    evit = a['retrabalho']['total'] + a['assistencia']['total']
    abertura.update({
        'lab_prev': [p_min, p_max] if prev else None,
        'kpi': {'custo': t['custo'], 'qtd': t['qtd'], 'mat': t['mat'], 'mod': t['mod'], 'ggf': t['ggf'],
                'un': t['custo'] / t['qtd'] if t['qtd'] else 0, 'evit': evit,
                'evit_pct': evit / a['ccTotal']['custoRaw'] if a['ccTotal']['custoRaw'] else 0,
                'taxa': a['ccTotal']['taxaRaw'], 'horas': a['ccTotal']['horas'],
                'prev': ({'custo': prev['total']['custo'], 'qtd': prev['total']['qtd'], 'mat': prev['total']['mat'],
                          'mod': prev['total']['mod'], 'ggf': prev['total']['ggf'],
                          'un': prev['total']['custo'] / prev['total']['qtd'] if prev['total']['qtd'] else 0,
                          'evit': prev['retrabalho']['total'] + prev['assistencia']['total'],
                          'taxa': prev['ccTotal']['taxaRaw']} if prev else None)},
        'pontos': _pontos(a, prev, t),
        'retrabalho_total': a['retrabalho']['total'], 'assistencia_total': a['assistencia']['total'],
    })
    # comparativo A × B (filtro próprio)
    cxa, cxb = _ab(C, params, cx_max)
    agg_a = custos_agg(CU, cxa, cxa, EXCL)
    agg_b = custos_agg(CU, cxb, cxb, EXCL)
    grupos = lambda g: [[x[0], x[1], x[2], x[3], x[4], x[5]] for x in g['grupos']]
    out['cx-grp'] = {'cxa': cxa, 'cxb': cxb, 'minym': C.minym_custos, 'maxym': C.maxym_custos,
                     'a': grupos(agg_a), 'b': grupos(agg_b)}
    out['cx-ranking'] = {'produtos': [[p['prod'], p['grp'], p['qtd'], p['mat'], p['mod'], p['ggf'], p['custo']]
                                      for p in agg_b['produtos']]}
    if len(a['meses']) > 1:
        out['cx-mensal'] = {'meses': a['meses']}
        out['cx-unidade'] = {'meses': a['meses']}
        out['cx-volume'] = {'meses': a['meses']}
    out['cx-grupos'] = {'top': [[g[0], g[5], g[1]] for g in a['grupos'][:8]], 'total': t['custo']}
    out['cx-drivers'] = {'cxa': cxa, 'cxb': cxb,
                         'grupos': [[g['grp'], g['custoA'], g['custoB'], g['mix'], g['vol'], g['cst'], g['total']]
                                    for g in _drivers(agg_a, agg_b)]}
    out['cx-materia'] = {'materiais': a['materiais'], 'mat': t['mat'], 'a': cx_min, 'b': cx_max,
                         'prev': ({c: v for c, v in prev['materiais']} if prev else None)}
    out['cx-operacionais'] = {'mod': t['mod'], 'ggf': t['ggf']}
    out['cx-absorcao-cc'] = {'cc': a['cc'], 'mod': soma(x[1] for x in a['cc']), 'ggf': soma(x[2] for x in a['cc']),
                             'custo': a['ccTotal']['custo'], 'custo_raw': a['ccTotal']['custoRaw'],
                             'horas': a['ccTotal']['horas'], 'taxa_raw': a['ccTotal']['taxaRaw']}
    itens = sorted(moggf_por_tipo_de_conta(a, t['mod'], t['ggf']), key=lambda x: -x[2])
    tot_mo = soma(x[2] for x in itens if x[1] == 'Mão de Obra')
    tot_ggf = soma(x[2] for x in itens if x[1] == 'GGF')
    out['cx-absorcao-conta'] = {'itens': itens, 'mo': tot_mo, 'ggf': tot_ggf, 'total': tot_mo + tot_ggf}
    out['cx-evitavel'] = {}
    base_raw = a['ccTotal']['custoRaw']
    ytd_min, ytd_max = cx_max // 100 * 100 + 1, cx_max
    ytd = custos_agg(CU, ytd_min, ytd_max, EXCL) if not (ytd_min == cx_min and ytd_max == cx_max) else None
    out['cx-retrabalho'] = {'total': a['retrabalho']['total'], 'pct': a['retrabalho']['total'] / base_raw if base_raw else 0,
                            'mensal': a['retrabalho']['mensal'], 'por_item': a['retrabalho']['porItem'][:25],
                            'top': a['retrabalho']['porItem'][0] if a['retrabalho']['porItem'] else None,
                            'ano': cx_max // 100, 'ytd': ytd['retrabalho']['total'] if ytd else None,
                            'a': cx_min, 'b': cx_max}
    ret_cc = {}
    for x in a['retrabalho']['porItem']:
        ret_cc[x[0]] = ret_cc.get(x[0], 0) + x[2]
    pareto = sorted(([k, ret_cc[k]] for k in ordem_chaves_js(ret_cc)), key=lambda x: -x[1])[:12]
    if len(pareto) > 2:
        out['cx-retrabalho-pareto'] = {'pareto': pareto}
    out['cx-assistencia'] = {'total': a['assistencia']['total'],
                             'pct': a['assistencia']['total'] / base_raw if base_raw else 0,
                             'mensal': a['assistencia']['mensal'], 'ano': cx_max // 100,
                             'ytd': ytd['assistencia']['total'] if ytd else None, 'a': cx_min, 'b': cx_max}
    out['cx-assistencia-prod'] = {'produtos': a['assistencia']['porProduto']}
    return out


def materiais_da_categoria(C, params):
    """Detalhamento: principais materiais de uma categoria (recurso 'detalhar')."""
    CU = C.blob('CUSTOS')
    cx_min, cx_max = _filtro(C, params)
    a = reconciliar(custos_agg(CU, cx_min, cx_max, EXCL))
    cat = params.get('cat')
    top = a['materiaisTop'].get(cat) or []
    cat_tot = next((x[1] for x in a['materiais'] if x[0] == cat), 0)
    return {'cat': cat, 'top': top, 'total': cat_tot, 'a': cx_min, 'b': cx_max,
            'demais': cat_tot - soma(x[1] for x in top)}


def produtos_do_driver(C, params):
    """Detalhamento: os produtos que explicam o impacto de um grupo (recurso 'detalhar')."""
    CU = C.blob('CUSTOS')
    _, cx_max = _filtro(C, params)
    cxa, cxb = _ab(C, params, cx_max)
    agg_a, agg_b = custos_agg(CU, cxa, cxa, EXCL), custos_agg(CU, cxb, cxb, EXCL)
    grp = params.get('grp')
    merged = []
    for p in _merge_produtos(agg_a, agg_b):
        if p['grp'] != grp:
            continue
        merged.append(dict(p, **_impacto(p['qtyA'], p['custoA'], p['qtyB'], p['custoB'])))
    merged.sort(key=lambda p: -abs(p['total']))
    # cxgPickTop: sempre os 3 maiores, até 5 enquanto o próximo valer ao menos 15% do maior
    n = min(5, len(merged))
    corte = n if n <= 3 else 3
    if n > 3:
        top_abs = abs(merged[0]['total']) or 1
        for i in range(3, n):
            if abs(merged[i]['total']) >= 0.15 * top_abs:
                corte = i + 1
            else:
                break
    grupo = next((g for g in _drivers(agg_a, agg_b) if g['grp'] == grp), None)
    return {'grp': grp, 'cxa': cxa, 'cxb': cxb, 'n': len(merged), 'grupo': grupo,
            'linhas': [[p['prod'], p['qtyA'], p['qtyB'], p['custoA'], p['custoB'], p['mix'], p['vol'], p['cst'], p['total']]
                       for p in merged[:corte]]}

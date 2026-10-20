# -*- coding: utf-8 -*-
"""Custos — Visão executiva (CPV) — porte de renderCustosX(), renderCxGrpTable(), cxgGroupDrivers()
e renderCxgDrivers() (app.js).

O texto das leituras (os "pontos que importam", a leitura de cada quadro e o resumo dos drivers) é o motor de
leitura do Kit (static/relatorio/leituras.js, extraído do app.js). Ele trabalha sobre os mesmos agregados do
Kit — períodos A e B, produtos, materiais, centros de custo — e por isso o servidor os manda no formato do Kit.

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


def _slim(a):
    """O agregado do Kit (custosAgg) só com o que o motor de leitura consome."""
    return {'ymMin': a['ymMin'], 'ymMax': a['ymMax'], 'total': a['total'], 'grupos': a['grupos'],
            'produtos': [{'prod': p['prod'], 'grp': p['grp'], 'qtd': p['qtd'], 'custo': p['custo']}
                         for p in a['produtos']],
            'materiais': a['materiais'], 'materiaisTop': a['materiaisTop'], 'cc': a['cc'], 'ccTotal': a['ccTotal'],
            'retrabalho': a['retrabalho'], 'assistencia': a['assistencia']}


def _janela(CU, ym_min, ym_max):
    """As linhas da base bruta que o motor lê direto (window.CUSTOS no Kit), só das janelas pedidas:
    materiais por item (ponte consumo × preço), unidades produzidas (CPP) e o grupo MATERIAIS do CPV
    (conciliação com o arquivo CPV_Acumulado)."""
    dentro = lambda ym: ym_min <= ym <= ym_max
    return {'materiais_item': [r for r in CU['materiais_item'] if dentro(r[0])],
            'cpp': [[r[0], r[1], r[2]] for r in CU['cpp'] if dentro(r[0])],
            'cpv': [r for r in CU['cpv'] if dentro(r[0]) and r[1] == 'MATERIAIS']}


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
        'agg': {'a': _slim(a), 'prev': _slim(prev) if prev else None},
        'janela': _janela(CU, (prev or a)['ymMin'], a['ymMax']),
        'retrabalho_total': a['retrabalho']['total'], 'assistencia_total': a['assistencia']['total'],
    })
    # comparativo A × B (filtro próprio)
    cxa, cxb = _ab(C, params, cx_max)
    agg_a = custos_agg(CU, cxa, cxa, EXCL)
    agg_b = custos_agg(CU, cxb, cxb, EXCL)
    grupos = lambda g: [[x[0], x[1], x[2], x[3], x[4], x[5]] for x in g['grupos']]
    out['cx-grp'] = {'cxa': cxa, 'cxb': cxb, 'minym': C.minym_custos, 'maxym': C.maxym_custos,
                     'a': grupos(agg_a), 'b': grupos(agg_b), 'ta': agg_a['total'], 'tb': agg_b['total']}
    out['cx-ranking'] = {'produtos': [[p['prod'], p['grp'], p['qtd'], p['mat'], p['mod'], p['ggf'], p['custo']]
                                      for p in agg_b['produtos']]}
    if len(a['meses']) > 1:
        out['cx-mensal'] = {'meses': a['meses']}
        out['cx-unidade'] = {'meses': a['meses']}
        out['cx-volume'] = {'meses': a['meses']}
    out['cx-grupos'] = {'top': [[g[0], g[5], g[1]] for g in a['grupos'][:8]], 'total': t['custo'],
                        'grupos': a['grupos']}
    out['cx-drivers'] = {'cxa': cxa, 'cxb': cxb,
                         'grupos': [[g['grp'], g['custoA'], g['custoB'], g['mix'], g['vol'], g['cst'], g['total']]
                                    for g in _drivers(agg_a, agg_b)]}
    out['cx-materia'] = {'materiais': a['materiais'], 'mat': t['mat'], 'a': cx_min, 'b': cx_max,
                         'prev': ({c: v for c, v in prev['materiais']} if prev else None),
                         'prev_list': prev['materiais'] if prev else None}
    out['cx-operacionais'] = {'mod': t['mod'], 'ggf': t['ggf']}
    out['cx-absorcao-cc'] = {'cc': a['cc'], 'mod': soma(x[1] for x in a['cc']), 'ggf': soma(x[2] for x in a['cc']),
                             'custo': a['ccTotal']['custo'], 'custo_raw': a['ccTotal']['custoRaw'],
                             'horas': a['ccTotal']['horas'], 'taxa_raw': a['ccTotal']['taxaRaw'],
                             'prev_cc': prev['cc'] if prev else None}
    itens = sorted(moggf_por_tipo_de_conta(a, t['mod'], t['ggf']), key=lambda x: -x[2])
    tot_mo = soma(x[2] for x in itens if x[1] == 'Mão de Obra')
    tot_ggf = soma(x[2] for x in itens if x[1] == 'GGF')
    out['cx-absorcao-conta'] = {'itens': itens, 'mo': tot_mo, 'ggf': tot_ggf, 'total': tot_mo + tot_ggf}
    out['cx-evitavel'] = {}
    base_raw = a['ccTotal']['custoRaw']
    ytd_min, ytd_max = cx_max // 100 * 100 + 1, cx_max
    ytd = custos_agg(CU, ytd_min, ytd_max, EXCL) if not (ytd_min == cx_min and ytd_max == cx_max) else None
    out['cx-retrabalho'] = {'total': a['retrabalho']['total'], 'pct': a['retrabalho']['total'] / base_raw if base_raw else 0,
                            'mensal': a['retrabalho']['mensal'], 'por_item': a['retrabalho']['porItem'],
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
    grupo = next((g for g in _drivers(agg_a, agg_b) if g['grp'] == grp), None)
    return {'grp': grp, 'cxa': cxa, 'cxb': cxb, 'n': len(merged), 'grupo': grupo,
            'produtos': [[p['prod'], p['qtyA'], p['custoA'], p['qtyB'], p['custoB']] for p in merged]}

# -*- coding: utf-8 -*-
"""Custos — Operacional (CPP) — porte de renderCustosBody(), renderCompare(), nzCompute() e drawPC()
(app.js).

Parâmetros: de/ate (período), cbde/cbate (comparativo, opcional), nzcod/nza/nzb/nzida/nzidb (nível
zero) e pccod/pcid/pcde/pcate (evolutivo por produto). Materiais de uma categoria e produtos de um
grupo saem por detalhamento."""
from ..custos import custos_agg, reconciliar
from ..datas import ym_list
from ..numeros import ordem_chaves_js, soma

SRC = 'cpp'


def _int(v, padrao):
    try:
        return int(v)
    except (TypeError, ValueError):
        return padrao


def _presets(C):
    """CUSTOS_PRESETS: histórico completo, ano anterior (se coberto), ano corrente YTD e 12 meses móveis."""
    maxym, minym, ano = C.maxym_custos, C.minym_custos, C.ano_c
    p = [['Histórico completo', 200001, 300000]]
    if (ano - 1) * 100 + 12 >= minym:
        p.append([str(ano - 1), (ano - 1) * 100 + 1, (ano - 1) * 100 + 12])
    p.append([None, ano * 100 + 1, maxym])
    from ..datas import ym_shift
    p.append(['Últimos 12m', ym_shift(maxym or 101, -11), maxym])
    return p


def _valido(v):
    return v in (200001, 300000) or (200001 <= v <= 300000 and 1 <= v % 100 <= 12)


def _filtro(C, params):
    a, b = _int(params.get('de'), 200001), _int(params.get('ate'), 300000)
    a = a if _valido(a) else 200001
    b = b if _valido(b) else 300000
    return (b, a) if a > b else (a, b)


def _comparacao(params):
    a, b = _int(params.get('cbde'), None), _int(params.get('cbate'), None)
    if a is None or b is None or not (_valido(a) and _valido(b)):
        return None
    return (b, a) if a > b else (a, b)


# ------------------------------------------------------------------ nível zero e evolutivo
def _ids(CU, cod, ym_min, ym_max):
    ids = []
    for o in CU['nz_ordens']:
        if o[0] == cod and ym_min <= o[1] <= ym_max and o[3] and o[3] not in ids:
            ids.append(o[3])
    return ids


def _nz_compute(CU, cod, ym_a, id_a, ym_b, id_b):
    um = {}

    def vol_de(ym, ident):
        return soma(r[3] for r in CU['nz_volume'] if r[1] == cod and r[0] == ym and (not ident or r[2] == ident))

    def mats_de(ym, ident):
        m = {}
        for r in CU['nz_materiais']:
            if r[1] != cod or r[0] != ym or (ident and r[2] != ident):
                continue
            o = m.setdefault(r[3], {'qtd': 0, 'custo': 0})
            o['qtd'] += r[5]
            o['custo'] += r[6]
            if r[4] and r[3] not in um:
                um[r[3]] = r[4]
        return m

    vol_a, vol_b = vol_de(ym_a, id_a), vol_de(ym_b, id_b)
    mats_a, mats_b = mats_de(ym_a, id_a), mats_de(ym_b, id_b)
    nomes = []
    for n in ordem_chaves_js(mats_a) + ordem_chaves_js(mats_b):
        if n not in nomes:
            nomes.append(n)
    linhas = []
    for nm in nomes:
        qa = mats_a.get(nm, {}).get('qtd', 0)
        ca = mats_a.get(nm, {}).get('custo', 0)
        qb = mats_b.get(nm, {}).get('qtd', 0)
        cb = mats_b.get(nm, {}).get('custo', 0)
        qua = qa / vol_a if vol_a else 0
        cua = ca / qa if qa else 0
        qub = qb / vol_b if vol_b else 0
        cub = cb / qb if qb else 0
        dq, dc = qub - qua, cub - cua
        mix, cst = dq * cua, dc * qub
        linhas.append({'nm': nm, 'um': um.get(nm, ''), 'qA': qa, 'qtdUnitA': qua, 'custoUnitA': cua, 'custoTotalA': ca,
                       'qB': qb, 'qtdUnitB': qub, 'custoUnitB': cub, 'custoTotalB': cb, 'difQtdUnit': dq,
                       'difCustoUnit': dc, 'efeitoMix': mix, 'efeitoCusto': cst, 'impacto': mix + cst})
    custo_total_b = soma(l['custoTotalB'] for l in linhas)
    unit_b = custo_total_b / vol_b if vol_b else 0
    for l in linhas:
        l['pctImpacto'] = l['impacto'] / unit_b if unit_b else 0
    linhas.sort(key=lambda l: -abs(l['impacto']))
    custo_total_a = soma(l['custoTotalA'] for l in linhas)
    return {'linhas': linhas, 'volA': vol_a, 'volB': vol_b, 'custoTotalA': custo_total_a, 'custoTotalB': custo_total_b,
            'custoUnitProdA': custo_total_a / vol_a if vol_a else 0, 'custoUnitProdB': unit_b}


def _nivel_zero(C, CU, params):
    prods = CU.get('nz_produtos') or []
    if not prods:
        return {'ausente': True}
    por_cod = sorted(prods, key=lambda p: p[0])
    cod = params.get('nzcod') if any(p[0] == params.get('nzcod') for p in prods) else por_cod[0][0]
    ym_a = _int(params.get('nza'), C.minym_custos)
    ym_b = _int(params.get('nzb'), C.maxym_custos)
    ids_a, ids_b = _ids(CU, cod, ym_a, ym_a), _ids(CU, cod, ym_b, ym_b)
    id_a = params.get('nzida') if params.get('nzida') in ids_a else ''
    id_b = params.get('nzidb') if params.get('nzidb') in ids_b else ''
    r = _nz_compute(CU, cod, ym_a, id_a, ym_b, id_b)
    desc = next((p[1] for p in prods if p[0] == cod), '')
    return {'produtos': por_cod, 'produtos_desc': sorted(prods, key=lambda p: p[1]),
            'cod': cod, 'desc': desc, 'ymA': ym_a, 'ymB': ym_b, 'idA': id_a, 'idB': id_b,
            'idsA': ids_a, 'idsB': ids_b, 'minym': C.minym_custos, 'maxym': C.maxym_custos, 'r': r}


def _pc_mes(CU, cod, ym, ident):
    vol = soma(r[3] for r in CU['nz_volume'] if r[1] == cod and r[0] == ym and (not ident or r[2] == ident))
    if not vol:
        return None
    custo = soma(r[6] for r in CU['nz_materiais'] if r[1] == cod and r[0] == ym and (not ident or r[2] == ident))
    return custo / vol


def _evolutivo(C, CU, params):
    prods = CU.get('nz_produtos') or []
    if not prods:
        return {'ausente': True}
    por_cod = sorted(prods, key=lambda p: p[0])
    cod = params.get('pccod') if any(p[0] == params.get('pccod') for p in prods) else por_cod[0][0]
    de = _int(params.get('pcde'), C.minym_custos)
    ate = _int(params.get('pcate'), C.maxym_custos)
    ids = _ids(CU, cod, de, ate)
    ident = params.get('pcid') if params.get('pcid') in ids else ''
    serie, ultimo = [], None
    for ym in ym_list(de, ate):
        v = _pc_mes(CU, cod, ym, ident)
        if v is None:
            v = ultimo
        else:
            ultimo = v
        serie.append([ym, v])
    anos = {}
    for ym, v in serie:
        anos.setdefault(ym // 100, [None] * 12)[ym % 100 - 1] = v
    ordem = sorted(anos)
    desc = next((p[1] for p in prods if p[0] == cod), '')
    return {'produtos': por_cod, 'produtos_desc': sorted(prods, key=lambda p: p[1]), 'cod': cod, 'desc': desc,
            'de': de, 'ate': ate, 'id': ident, 'ids': ids, 'minym': C.minym_custos, 'maxym': C.maxym_custos,
            'anos': {str(a): anos[a] for a in ordem}, 'ordem': ordem, 'tem': any(v is not None for _, v in serie)}


# ------------------------------------------------------------------ seção
def calcular(C, params=None):
    params = params or {}
    CU = C.blob('CUSTOS')
    out = {'custos.abertura': {'tem': bool(CU)}}
    if not CU:
        return out
    cu_min, cu_max = _filtro(C, params)
    abertura = out['custos.abertura']
    abertura.update({'a': cu_min, 'b': cu_max, 'minym': C.minym_custos, 'maxym': C.maxym_custos, 'ano': C.ano_c,
                     'presets': _presets(C), 'cb': _comparacao(params)})
    a = reconciliar(custos_agg(CU, cu_min, cu_max, None, SRC))
    t = a['total']
    if not t['custo']:
        abertura['vazio'] = True
        return out
    cb = _comparacao(params)
    if cb:
        b = reconciliar(custos_agg(CU, cb[0], cb[1], None, SRC))
        tb = b['total']
        out['cu-comparativo'] = {'a': [cu_min, cu_max], 'b': list(cb),
                                 'linhas': [[t['custo'], tb['custo']], [t['qtd'], tb['qtd']],
                                            [t['custo'] / t['qtd'] if t['qtd'] else 0,
                                             tb['custo'] / tb['qtd'] if tb['qtd'] else 0],
                                            [t['mat'], tb['mat']], [t['mod'], tb['mod']], [t['ggf'], tb['ggf']],
                                            [a['retrabalho']['total'], b['retrabalho']['total']],
                                            [a['assistencia']['total'], b['assistencia']['total']]]}
        cats_b = {c: v for c, v in b['materiais']}
        out['cu-mp-cat'] = {'a': [cu_min, cu_max], 'b': list(cb),
                            'linhas': [[c, v, cats_b.get(c, 0)] for c, v in a['materiais']]}
        grp_b = {g[0]: {'q': g[1], 'c': g[5]} for g in b['grupos']}
        linhas = []
        for g in a['grupos'][:10]:
            gb = grp_b.get(g[0])
            ub = gb['c'] / gb['q'] if gb and gb['q'] else 0
            linhas.append([g[0], g[5] / g[1] if g[1] else 0, ub])
        out['cu-cpp-grupo'] = {'a': [cu_min, cu_max], 'b': list(cb), 'linhas': linhas}
    ret_pct = a['retrabalho']['total'] / a['ccTotal']['custo'] if a['ccTotal']['custo'] else 0
    ass_pct = a['assistencia']['total'] / a['ccTotal']['custo'] if a['ccTotal']['custo'] else 0
    cc_caro = sorted((x for x in a['cc'] if x[5] > 0), key=lambda x: -x[5])
    out['cu-painel'] = {'a': cu_min, 'b': cu_max, 'custo': t['custo'], 'qtd': t['qtd'], 'mat': t['mat'],
                        'mod': t['mod'], 'ggf': t['ggf'], 'ret': a['retrabalho']['total'], 'ret_pct': ret_pct,
                        'ass': a['assistencia']['total'], 'ass_pct': ass_pct, 'horas': a['ccTotal']['horas'],
                        'taxa': a['ccTotal']['taxa'], 'cc_caro': cc_caro[0] if cc_caro else None}
    out['cu-desmembrado'] = {'meses': a['meses'], 'mat': t['mat'], 'mod': t['mod'], 'ggf': t['ggf'], 'custo': t['custo']}
    out['cu-composicao'] = {'materiais': a['materiais']}
    out['cu-grupos'] = {'grupos': [[g[0], g[1], g[2], g[3], g[4], g[5]] for g in a['grupos']],
                        'meses': a['mesesYm'],
                        'serie': {g[0]: [(a['cpvGrpMes'].get(g[0]) or {}).get(ym, 0) for ym in a['mesesYm']]
                                  for g in a['grupos']},
                        'total': [soma(g[1] for g in a['grupos']), soma(g[2] for g in a['grupos']),
                                  soma(g[3] for g in a['grupos']), soma(g[4] for g in a['grupos']),
                                  soma(g[5] for g in a['grupos'])]}
    out['cu-ranking'] = {'produtos': [[p['prod'], p['grp'], p['qtd'], p['mat'], p['mod'], p['ggf'], p['custo']]
                                      for p in a['produtos']]}
    grp_ord = [g[0] for g in a['grupos'] if g[0] != 'MATERIAIS']
    vol = {'grupos': grp_ord, 'meses': a['mesesYm'],
           'mat': [[(a['volGrpMes'].get(g) or {}).get(ym, 0) for ym in a['mesesYm']] for g in grp_ord]}
    vol['total'] = [soma(linha[i] for linha in vol['mat']) for i in range(len(a['mesesYm']))]
    out['cu-volume'] = vol
    op = a['operacionais']
    out['cu-operacionais'] = {'produtivo': op['PRODUTIVO']['total'], 'apoio': op['AUXILIAR/APOIO']['total']}
    out['cu-produtivo'] = {'itens': op['PRODUTIVO']['itens'][:8], 'todos': op['PRODUTIVO']['itens']}
    out['cu-apoio'] = {'itens': op['AUXILIAR/APOIO']['itens'][:8]}
    vp = {r: v for r, v in op['PRODUTIVO']['itens']}
    va = {r: v for r, v in op['AUXILIAR/APOIO']['itens']}
    contas = []
    for nm in [x[0] for x in op['PRODUTIVO']['itens']] + [x[0] for x in op['AUXILIAR/APOIO']['itens']]:
        if nm not in contas:
            contas.append(nm)
    contas_ord = sorted(contas, key=lambda nm: -(vp.get(nm, 0) + va.get(nm, 0)))
    out['cu-absorcao-conta'] = {'linhas': [[nm, vp.get(nm, 0), va.get(nm, 0)] for nm in contas_ord],
                                'produtivo': op['PRODUTIVO']['total'], 'apoio': op['AUXILIAR/APOIO']['total']}
    out['cu-absorcao-cc'] = {}
    out['cu-cc-total'] = {'cc': [[x[0], x[3]] for x in a['cc']]}
    out['cu-cc-taxa'] = {'taxa': [[x[0], x[5]] for x in a['cc']], 'cc': a['cc'],
                         'mod': soma(x[1] for x in a['cc']), 'ggf': soma(x[2] for x in a['cc']),
                         'custo': a['ccTotal']['custo'], 'horas': a['ccTotal']['horas'], 'taxa_total': a['ccTotal']['taxa']}
    cu_max_real = min(cu_max, C.maxym_custos)
    ytd_min, ytd_max = cu_max_real // 100 * 100 + 1, cu_max_real
    ytd = custos_agg(CU, ytd_min, ytd_max, None, SRC) if not (ytd_min == cu_min and ytd_max == cu_max) else None
    out['cu-retrabalho'] = {'a': cu_min, 'b': cu_max, 'total': a['retrabalho']['total'], 'pct': ret_pct,
                            'mensal': a['retrabalho']['mensal'], 'por_item': a['retrabalho']['porItem'][:25],
                            'top': a['retrabalho']['porItem'][0] if a['retrabalho']['porItem'] else None,
                            'ano': cu_max_real // 100, 'ytd': ytd['retrabalho']['total'] if ytd else None}
    ret_cc = {}
    for x in a['retrabalho']['porItem']:
        ret_cc[x[0]] = ret_cc.get(x[0], 0) + x[2]
    pareto = sorted(([k, ret_cc[k]] for k in ordem_chaves_js(ret_cc)), key=lambda x: -x[1])[:12]
    if len(pareto) > 2:
        out['cu-retrabalho-pareto'] = {'pareto': pareto}
    out['cu-assistencia'] = {'a': cu_min, 'b': cu_max, 'total': a['assistencia']['total'], 'pct': ass_pct,
                             'mensal': a['assistencia']['mensal'], 'ano': cu_max_real // 100,
                             'ytd': ytd['assistencia']['total'] if ytd else None}
    out['cu-assistencia-prod'] = {'produtos': a['assistencia']['porProduto']}
    out['cu-nivelzero'] = _nivel_zero(C, CU, params)
    out['cu-evolutivo'] = _evolutivo(C, CU, params)
    return out


def materiais_da_categoria(C, params):
    """Detalhamento: materiais de uma categoria, com a série mensal (recurso 'detalhar')."""
    CU = C.blob('CUSTOS')
    cu_min, cu_max = _filtro(C, params)
    a = reconciliar(custos_agg(CU, cu_min, cu_max, None, SRC))
    cat = params.get('cat')
    mes = {}
    for ym, c, v in CU['materiais']:
        if cu_min <= ym <= cu_max and c == cat:
            mes[ym] = mes.get(ym, 0) + v
    acc = {}
    for ym, c, item, um, qtd, custo in CU['materiais_item']:
        if not (cu_min <= ym <= cu_max) or c != cat:
            continue
        o = acc.setdefault(item, {'qtd': 0, 'custo': 0, 'um': um})
        o['qtd'] += qtd
        o['custo'] += custo
        if um:
            o['um'] = um
    lista = sorted(({'item': k, 'qtd': acc[k]['qtd'], 'custo': acc[k]['custo'], 'um': acc[k]['um']}
                    for k in ordem_chaves_js(acc)), key=lambda x: -x['custo'])
    bruto = soma(x['custo'] for x in lista)
    recon = next((x[1] for x in a['materiais'] if x[0] == cat), 0)
    f = recon / bruto if bruto else 0
    lista = [dict(x, custo=x['custo'] * f) for x in lista]
    tot = soma(x['custo'] for x in lista)
    yms = sorted(mes)
    top, resto = lista[:25], lista[25:]
    return {'cat': cat, 'a': cu_min, 'b': cu_max, 'total': tot, 'n': len(lista),
            'yms': yms, 'serie': [mes[y] * f for y in yms],
            'linhas': [[x['item'], x['um'], x['qtd'], x['custo']] for x in top],
            'resto': [len(resto), soma(x['custo'] for x in resto)]}


def produtos_do_grupo(C, params):
    """Detalhamento: os produtos de um grupo, com a série mensal do CPP (recurso 'detalhar')."""
    CU = C.blob('CUSTOS')
    cu_min, cu_max = _filtro(C, params)
    a = reconciliar(custos_agg(CU, cu_min, cu_max, None, SRC))
    grp = params.get('grp')
    mes = {}
    for ym, g, q, rmat, rmod, rggf, rcusto in CU['cpp']:
        if not (cu_min <= ym <= cu_max) or g != grp:
            continue
        o = mes.setdefault(ym, {'custo': 0, 'qtd': 0})
        o['custo'] += rcusto
        o['qtd'] += q
    prods = [p for p in a['produtos'] if p['grp'] == grp]
    tot = soma(p['custo'] for p in prods)
    tot_q = soma(p['qtd'] for p in prods)
    yms = sorted(mes)
    top, resto = prods[:30], prods[30:]
    return {'grp': grp, 'a': cu_min, 'b': cu_max, 'total': tot, 'qtd': tot_q, 'n': len(prods),
            'yms': yms, 'serie': [mes[y]['custo'] for y in yms],
            'linhas': [[p['prod'], p['qtd'], p['mat'], p['mod'], p['ggf'], p['custo']] for p in top],
            'resto': [len(resto), soma(p['qtd'] for p in resto), soma(p['mat'] for p in resto),
                      soma(p['mod'] for p in resto), soma(p['ggf'] for p in resto), soma(p['custo'] for p in resto)]}

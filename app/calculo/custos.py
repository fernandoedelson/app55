# -*- coding: utf-8 -*-
"""Agregação da base de custos — porte de custosAgg(), reconcileCustos() e moggfPorTipoDeConta()
(app.js). Compartilhado pelas seções Custos — Executivo (CPV) e Custos — Operacional (CPP).

Como no Kit, as somas seguem a ordem das linhas da base e os agrupamentos saem na ordem em que o
JavaScript os listaria (Object.keys), com ordenação estável por valor."""
import re

from .numeros import ordem_chaves_js, soma


def custos_agg(CUSTOS, ym_min, ym_max, excl=None, src=None):
    cpv_rows = CUSTOS['cpp'] if src == 'cpp' else CUSTOS['cpv']
    prod_rows = CUSTOS['produtos_cpp'] if src == 'cpp' else CUSTOS['produtos']
    dentro = lambda ym: ym_min <= ym <= ym_max
    mat = mod = ggf = custo = qtd = 0
    grp_map, mes_map, vol_grp_mes, cpv_grp_mes = {}, {}, {}, {}
    for ym, grp, q, rmat, rmod, rggf, rcusto in cpv_rows:
        if not dentro(ym) or (excl and grp in excl):
            continue
        mat += rmat
        mod += rmod
        ggf += rggf
        custo += rcusto
        qtd += q
        g = grp_map.setdefault(grp, {'qtd': 0, 'mat': 0, 'mod': 0, 'ggf': 0, 'custo': 0})
        g['qtd'] += q
        g['mat'] += rmat
        g['mod'] += rmod
        g['ggf'] += rggf
        g['custo'] += rcusto
        m = mes_map.setdefault(ym, {'mat': 0, 'mod': 0, 'ggf': 0, 'custo': 0, 'qtd': 0})
        m['mat'] += rmat
        m['mod'] += rmod
        m['ggf'] += rggf
        m['custo'] += rcusto
        m['qtd'] += q
        vg = vol_grp_mes.setdefault(grp, {})
        vg[ym] = vg.get(ym, 0) + q
        cg = cpv_grp_mes.setdefault(grp, {})
        cg[ym] = cg.get(ym, 0) + rcusto
    grupos = sorted(([g, v['qtd'], v['mat'], v['mod'], v['ggf'], v['custo']]
                     for g, v in ((k, grp_map[k]) for k in ordem_chaves_js(grp_map))), key=lambda x: -x[5])
    prod_map = {}
    for ym, prod, grp, q, rmat, rmod, rggf, rcusto in prod_rows:
        if not dentro(ym) or (excl and grp in excl):
            continue
        p = prod_map.setdefault(prod + '||' + grp, {'prod': prod, 'grp': grp, 'qtd': 0, 'mat': 0, 'mod': 0,
                                                    'ggf': 0, 'custo': 0})
        p['qtd'] += q
        p['mat'] += rmat
        p['mod'] += rmod
        p['ggf'] += rggf
        p['custo'] += rcusto
    produtos = sorted((prod_map[k] for k in ordem_chaves_js(prod_map)), key=lambda x: -x['custo'])
    meses_ym = sorted(mes_map)
    meses = [[ym, mes_map[ym]['mat'], mes_map[ym]['mod'], mes_map[ym]['ggf'], mes_map[ym]['custo'], mes_map[ym]['qtd']]
             for ym in meses_ym]
    mat_map = {}
    for ym, cat, v in CUSTOS['materiais']:
        if dentro(ym):
            mat_map[cat] = mat_map.get(cat, 0) + v
    materiais = sorted(([k, mat_map[k]] for k in ordem_chaves_js(mat_map)), key=lambda x: -x[1])
    mat_item = {}
    for ym, cat, item, um, q, cst in CUSTOS['materiais_item']:
        if not dentro(ym):
            continue
        c = mat_item.setdefault(cat, {})
        o = c.setdefault(item, {'qtd': 0, 'custo': 0, 'um': um})
        o['qtd'] += q
        o['custo'] += cst
        if um:
            o['um'] = um
    materiais_top = {cat: sorted(([k, v['custo'], v['qtd'], v['um']]
                                  for k, v in ((k, mat_item[cat][k]) for k in ordem_chaves_js(mat_item[cat]))),
                                 key=lambda x: -x[1])[:5] for cat in ordem_chaves_js(mat_item)}
    cta_map = {'PRODUTIVO': {}, 'AUXILIAR/APOIO': {}}
    for ym, classif, agr, v in CUSTOS['cta']:
        if not dentro(ym) or classif not in cta_map:
            continue
        cta_map[classif][agr] = cta_map[classif].get(agr, 0) + v
    rotulo = lambda agr: (CUSTOS.get('rotulos_cta') or {}).get(agr, agr)
    operacionais = {}
    for classif in ('PRODUTIVO', 'AUXILIAR/APOIO'):
        itens = sorted(([rotulo(a), cta_map[classif][a]] for a in ordem_chaves_js(cta_map[classif])), key=lambda x: -x[1])
        operacionais[classif] = {'itens': itens, 'total': soma(x[1] for x in itens)}
    cc_map = {}
    for ym, cc_, rmod, rggf, rreal in CUSTOS['cc']:
        if not dentro(ym):
            continue
        o = cc_map.setdefault(cc_, {'mod': 0, 'ggf': 0, 'real': 0, 'horas': 0})
        o['mod'] += rmod
        o['ggf'] += rggf
        o['real'] += rreal
    for ym, cc_, h in CUSTOS['horas']:
        if not dentro(ym):
            continue
        o = cc_map.setdefault(cc_, {'mod': 0, 'ggf': 0, 'real': 0, 'horas': 0})
        o['horas'] += h
    cc = sorted(([k, cc_map[k]['mod'], cc_map[k]['ggf'], cc_map[k]['real'], cc_map[k]['horas'],
                  cc_map[k]['real'] / cc_map[k]['horas'] if cc_map[k]['horas'] else 0] for k in ordem_chaves_js(cc_map)),
                key=lambda x: -x[3])
    cc_total = {'horas': soma(x[4] for x in cc), 'custo': soma(x[3] for x in cc)}
    cc_total['taxa'] = cc_total['custo'] / cc_total['horas'] if cc_total['horas'] else 0
    ret_mes, ret_item = {}, {}
    for ym, cc2, prod, v in CUSTOS['retrabalho']:
        if not dentro(ym):
            continue
        ret_mes[ym] = ret_mes.get(ym, 0) + v
        k = cc2 + '||' + prod
        ret_item[k] = ret_item.get(k, 0) + v
    ret_mensal = [[ym, ret_mes[ym]] for ym in sorted(ret_mes)]
    ret_por_item = sorted(([k[:k.index('||')], k[k.index('||') + 2:], ret_item[k]] for k in ordem_chaves_js(ret_item)),
                          key=lambda x: -x[2])
    ass_mes, ass_prod = {}, {}
    for ym, prod, v in CUSTOS['assistencia']:
        if not dentro(ym):
            continue
        ass_mes[ym] = ass_mes.get(ym, 0) + v
        ass_prod[prod] = ass_prod.get(prod, 0) + v
    ass_mensal = [[ym, ass_mes[ym]] for ym in sorted(ass_mes)]
    ass_por_produto = sorted(([k, ass_prod[k]] for k in ordem_chaves_js(ass_prod)), key=lambda x: -x[1])[:15]
    return {'ymMin': ym_min, 'ymMax': ym_max,
            'total': {'mat': mat, 'mod': mod, 'ggf': ggf, 'custo': custo, 'qtd': qtd},
            'meses': meses, 'grupos': grupos, 'produtos': produtos, 'materiais': materiais,
            'materiaisTop': materiais_top, 'operacionais': operacionais, 'cc': cc, 'ccTotal': cc_total,
            'volGrpMes': vol_grp_mes, 'cpvGrpMes': cpv_grp_mes, 'mesesYm': meses_ym,
            'retrabalho': {'mensal': ret_mensal, 'total': soma(x[1] for x in ret_mensal), 'porItem': ret_por_item},
            'assistencia': {'mensal': ass_mensal, 'total': soma(x[1] for x in ass_mensal), 'porProduto': ass_por_produto}}


def reconciliar(a):
    """reconcileCustos(): escala materiais e centros de custo para fechar com o total do CPV. Idempotente."""
    if not a or a.get('_reconciliado'):
        return a
    a['_reconciliado'] = True
    t = a['total']
    mat_raw = soma(x[1] for x in a['materiais'])
    f_mat = t['mat'] / mat_raw if mat_raw else 0
    a['materiais'] = [[c, v * f_mat] for c, v in a['materiais']]
    a['materiaisTop'] = {cat: [[nome, custo * f_mat, qtd, um] for nome, custo, qtd, um in lst]
                         for cat, lst in a['materiaisTop'].items()}
    mod_raw, ggf_raw = soma(x[1] for x in a['cc']), soma(x[2] for x in a['cc'])
    f_mod = t['mod'] / mod_raw if mod_raw else 0
    f_ggf = t['ggf'] / ggf_raw if ggf_raw else 0
    novo = []
    for x in a['cc']:
        mod, ggf = x[1] * f_mod, x[2] * f_ggf
        custo = mod + ggf
        custo_raw = x[1] + x[2]
        novo.append([x[0], mod, ggf, custo, x[4], custo / x[4] if x[4] else 0, custo_raw,
                     custo_raw / x[4] if x[4] else 0])
    a['cc'] = novo
    horas = a['ccTotal']['horas']
    a['ccTotal'] = {'horas': horas, 'custo': t['mod'] + t['ggf'],
                    'taxa': (t['mod'] + t['ggf']) / horas if horas else 0,
                    'custoRaw': mod_raw + ggf_raw, 'taxaRaw': (mod_raw + ggf_raw) / horas if horas else 0}
    return a


PESSOAL = re.compile('PESSOAL', re.I)


def moggf_por_tipo_de_conta(a, mod, ggf):
    itens = a['operacionais']['PRODUTIVO']['itens']
    mo_raw = soma(v for r, v in itens if PESSOAL.search(r))
    ggf_raw = soma(v for _, v in itens) - mo_raw
    f_mo = mod / mo_raw if mo_raw else 0
    f_ggf = ggf / ggf_raw if ggf_raw else 0
    return [[r, 'Mão de Obra' if PESSOAL.search(r) else 'GGF', v * (f_mo if PESSOAL.search(r) else f_ggf)]
            for r, v in itens]

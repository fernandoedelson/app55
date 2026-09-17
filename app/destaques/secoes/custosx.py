# -*- coding: utf-8 -*-
"""Destaques de Custos — Visão executiva (CPV): as chamadas de ins() de renderCustosX (app.js)."""
from ...calculo.custos import custos_agg, moggf_por_tipo_de_conta, reconciliar
from ...calculo.datas import ym_shift
from ...calculo.numeros import ordem_chaves_js
from ...calculo.secoes.custosx import EXCL, _ab, _drivers, _filtro, _meses
from ..genericas import auto, serie_oscilacao
from ..regras_custos import evitavel, mix, taxa_hora, unitario_volume


def _mes_lab(ym):
    from ...calculo.datas import MES
    return MES[ym % 100 - 1] + '/' + str(ym // 100)[2:]


def montar(C, params=None):
    params = params or {}
    CU = C.blob('CUSTOS')
    if not CU:
        return
    cx_min, cx_max = _filtro(C, params)
    a = reconciliar(custos_agg(CU, cx_min, cx_max, EXCL))
    t = a['total']
    if not t['custo']:
        return
    ln = _meses(cx_min, cx_max)
    p_max = ym_shift(cx_min, -1)
    p_min = ym_shift(p_max, -(ln - 1))
    prev = reconciliar(custos_agg(CU, p_min, p_max, EXCL)) if p_min >= C.minym_custos else None
    if not (prev and prev['total']['custo']):
        prev = None
    grupos_it = [{'name': g[0], 'v': g[5], 'q': g[1]} for g in a['grupos']]
    yield ('cx-grp', [], auto({'itens': grupos_it, 'escopo': 'grupo', 'escopoPl': 'grupos de produto',
                               'universo': 'do CPV', 'id': 'cx-grupos', 'tabela': True,
                               'preferir': ['divergencia', 'estrutura']}))
    cxa, cxb = _ab(C, params, cx_max)
    agg_a, agg_b = custos_agg(CU, cxa, cxa, EXCL), custos_agg(CU, cxb, cxb, EXCL)
    yield ('cx-ranking', [], auto({'itens': [{'name': p['prod'], 'v': p['custo'], 'q': p['qtd']}
                                             for p in agg_b['produtos']],
                                   'escopo': 'produto', 'escopoPl': 'produtos', 'universo': 'do CPV',
                                   'id': 'cx-produtos', 'tabela': True, 'preferir': ['cauda', 'estrutura']}))
    if len(a['meses']) > 1:
        if prev:
            yield ('cx-mensal', [], mix(C, {'custosA': [a['ymMin'], a['ymMax']],
                                            'custosB': [prev['ymMin'], prev['ymMax']]}))
        yield ('cx-unidade', [], unitario_volume({'meses': a['meses'], 'rotulo': 'vendidas', 'id': 'cpv'}))
        yield ('cx-volume', [], serie_oscilacao({'labels': [_mes_lab(m[0]) for m in a['meses']],
                                                 'vals': [m[5] for m in a['meses']], 'id': 'cx-volume',
                                                 'fmt': 'pecas', 'verbo': 'entregou'}))
    yield ('cx-grupos', [], auto({'itens': grupos_it, 'escopo': 'grupo', 'escopoPl': 'grupos de produto',
                                  'universo': 'do CPV', 'id': 'cx-concentra', 'preferir': ['cauda']}))
    yield ('cx-drivers', [], auto({'itens': [{'name': g['grp'], 'v': abs(g['total'])} for g in _drivers(agg_a, agg_b)],
                                   'escopo': 'grupo', 'escopoPl': 'grupos de produto',
                                   'universo': 'da variação do CPV', 'id': 'cx-drivers', 'tabela': True,
                                   'preferir': ['estrutura', 'cauda']}))
    yield ('cx-materia', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in a['materiais']],
                                   'escopo': 'categoria', 'escopoPl': 'categorias de material',
                                   'universo': 'da matéria-prima', 'id': 'cx-materiais',
                                   'preferir': ['estrutura', 'cauda']}))
    yield ('cx-absorcao-cc', [], taxa_hora({'cc': a['cc'], 'id': 'cpv'}))
    itens = moggf_por_tipo_de_conta(a, t['mod'], t['ggf'])
    yield ('cx-absorcao-conta', [], auto({'itens': [{'name': x[0], 'v': x[2]} for x in itens],
                                          'escopo': 'tipo de conta', 'escopoPl': 'tipos de conta',
                                          'universo': 'do custo produtivo', 'id': 'cx-conta', 'tabela': True,
                                          'preferir': ['estrutura', 'cauda']}))
    base = a['ccTotal']['custoRaw'] or a['ccTotal']['custo']
    yield ('cx-retrabalho', [], evitavel({'ret': dict(a['retrabalho'], porCC=None),
                                          'ass': {'total': a['assistencia']['total'],
                                                  'porProduto': a['assistencia']['porProduto']},
                                          'base': base}))
    ret_cc = {}
    for x in a['retrabalho']['porItem']:
        ret_cc[x[0]] = ret_cc.get(x[0], 0) + x[2]
    pareto = sorted(([k, ret_cc[k]] for k in ordem_chaves_js(ret_cc)), key=lambda x: -x[1])[:12]
    if len(pareto) > 2:
        yield ('cx-retrabalho-pareto', [], auto({'itens': [{'name': x[0][:22], 'v': x[1]} for x in pareto],
                                                 'escopo': 'centro de custo', 'escopoPl': 'centros de custo',
                                                 'universo': 'do retrabalho', 'id': 'cx-retrabalho',
                                                 'preferir': ['estrutura', 'cauda', 'relacao']}))
    yield ('cx-retrabalho', [], auto({'itens': [{'name': x[1], 'v': x[2]} for x in a['retrabalho']['porItem']],
                                      'escopo': 'produto', 'escopoPl': 'produtos', 'universo': 'do retrabalho',
                                      'id': 'retrab-item', 'tabela': True, 'preferir': ['estrutura', 'relacao']}))
    if len(a['assistencia']['mensal']) > 1:
        yield ('cx-assistencia', [], serie_oscilacao({'labels': [_mes_lab(m[0]) for m in a['assistencia']['mensal']],
                                                      'vals': [m[1] for m in a['assistencia']['mensal']],
                                                      'id': 'assist'}))
    yield ('cx-assistencia-prod', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in a['assistencia']['porProduto']],
                                            'escopo': 'produto', 'escopoPl': 'produtos',
                                            'universo': 'da assistência técnica', 'id': 'assist-prod',
                                            'tabela': True, 'preferir': ['estrutura', 'cauda']}))

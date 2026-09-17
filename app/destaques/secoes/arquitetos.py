# -*- coding: utf-8 -*-
"""Destaques de Vendedor × Arquiteto — as chamadas de ins() de renderArquitetos e
blocoRfvArquitetos (app.js)."""
from ...calculo.datas import ym_shift
from ...calculo.numeros import ordem_chaves_js, soma
from ...calculo.secoes.analise_vendas import _janela
from ...calculo.secoes.arquitetos import SEG_BONS, SEG_RUINS, _rfv, arq_agg
from ..genericas import auto
from ..regras_arquitetos import (canal, dependencia, exclusividade, matriz, parados, rfv_por_vendedor,
                                 rfv_qualidade, rfv_segmentos, rfv_tabela)


def montar(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    janela, fim = _janela(params), C.maxym_vendas
    A = arq_agg(DATA, ym_shift(fim, -(janela - 1)), fim)
    if not A['arqs']:
        return
    yield ('aq-dependencia', [], canal({'vend': A['vend'], 'share': A['share'], 'totA': A['totA'],
                                        'totV': A['totV']}))
    yield ('aq-quantos', [], dependencia({'vend': A['vend'], 'arqs': A['arqs']}))
    top_v = [x['name'] for x in A['vend'] if x['vArq'] > 0][:7]
    top_a = [x['name'] for x in A['arqs'][:7]]
    md = {vn: {an: ((A['mat'].get(vn) or {}).get(an) or 0) for an in top_a} for vn in top_v}
    yield ('aq-matriz', [], matriz({'mat': md, 'linhas': top_v, 'colunas': top_a, 'arqs': A['arqs']}))
    yield ('aq-lista', [], auto({'itens': [{'name': x['name'], 'v': x['v'], 'peds': x['peds'], 'extra': x['rt']}
                                           for x in A['arqs']],
                                 'escopo': 'arquiteto', 'escopoPl': 'arquitetos',
                                 'universo': 'da venda pelo canal', 'rotuloExtra': 'RT', 'id': 'arq-canal',
                                 'preferir': ['taxa', 'divergencia']}))
    yield ('aq-lista', [], exclusividade({'arqs': A['arqs'], 'vend': A['vend']}))
    p = sorted((x for x in A['arqs'] if x['r'] >= 6), key=lambda x: -x['v'])[:12]
    if p:
        yield ('aq-parados', [], parados({'parados': p, 'arqs': A['arqs'], 'totA': A['totA']}))
    R = _rfv(A)
    if not R:
        return
    ctx = {'segs': R['segs'], 'total': R['total'], 'itens': R['itens'], 'arqs': A['arqs']}
    yield ('aq-rfv', [], rfv_segmentos(ctx))
    yield ('aq-rfv', [], rfv_tabela(ctx))
    por = {}
    for x in R['itens']:
        d = x['dono']
        if not d:
            continue
        o = por.get(d)
        if o is None:
            o = por[d] = {'n': 0, 'v': 0, 'bons': 0, 'vBons': 0, 'ruins': 0, 'vRuins': 0, 'peds': 0, 'r': 0}
        o['n'] += 1
        o['v'] += x['v']
        o['peds'] += x['f']
        o['r'] += x['r']
        if x['seg'] in SEG_BONS:
            o['bons'] += 1
            o['vBons'] += x['v']
        if x['seg'] in SEG_RUINS:
            o['ruins'] += 1
            o['vRuins'] += x['v']
    linhas = []
    for d in ordem_chaves_js(por):
        o = por[d]
        linhas.append({'d': d, 'n': o['n'], 'v': o['v'], 'bons': o['bons'], 'vBons': o['vBons'],
                       'ruins': o['ruins'], 'vRuins': o['vRuins'],
                       'shBons': o['vBons'] / o['v'] if o['v'] else 0,
                       'shRuins': o['vRuins'] / o['v'] if o['v'] else 0,
                       'pedArq': o['peds'] / o['n'] if o['n'] else 0,
                       'ticket': o['v'] / o['peds'] if o['peds'] else 0})
    linhas = sorted((x for x in linhas if x['n'] >= 2), key=lambda x: -x['v'])
    if linhas:
        yield ('aq-perf', [], rfv_por_vendedor({'linhas': linhas, 'total': R['total']}))
        yield ('aq-perf', [], rfv_qualidade({'linhas': linhas}))

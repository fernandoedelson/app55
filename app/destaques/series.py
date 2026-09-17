# -*- coding: utf-8 -*-
"""Séries derivadas da base comercial usadas pelas regras — porte de serieVendas(), serieVendasPR()
e pedidosDoMes() do insights.js."""
from ..calculo.datas import ym_lab
from ..calculo.numeros import soma
from .nucleo import quantos_para


def serie_vendas(C, n_meses=12, fim_ref=None):
    DATA = C.blob('DATA')
    if not DATA or not DATA.get('rows'):
        return None
    fim = fim_ref or C.maxym_vendas
    por = {}
    for r in DATA['rows']:
        o = por.get(r[0])
        if o is None:
            o = por[r[0]] = {'v': 0, 'q': 0, 'peds': set()}
        o['v'] += r[1]
        o['q'] += r[2]
        if r[15] >= 0:
            o['peds'].add(r[15])
    yms = sorted(por)
    ult = [y for y in yms if y <= fim][-(n_meses or 12):]
    return {'yms': ult, 'labels': [ym_lab(y) for y in ult],
            'val': [por[y]['v'] for y in ult], 'qnt': [por[y]['q'] for y in ult],
            'peds': [len(por[y]['peds']) for y in ult],
            'pm': [por[y]['v'] / por[y]['q'] if por[y]['q'] else 0 for y in ult]}


def serie_vendas_pr(C, yms):
    """Venda para partes relacionadas, mês a mês (nomes de cliente que casam com os padrões do blob)."""
    DATA = C.blob('DATA')
    pats = [str(p).upper() for p in (C.blob('PARTES_RELACIONADAS') or []) if p]
    if not pats or not DATA:
        return None
    eh_pr = {i for i, n in enumerate(DATA['cl']) if any(p in str(n).upper() for p in pats)}
    if not eh_pr:
        return None
    por = {y: 0 for y in yms}
    for r in DATA['rows']:
        if r[0] in por and r[5] in eh_pr:
            por[r[0]] += r[1]
    return {'pr': [por[y] for y in yms], 'nomes': [DATA['cl'][i] for i in sorted(eh_pr)]}


def pedidos_do_mes(C, ym):
    DATA = C.blob('DATA')
    if not DATA:
        return None
    por = {}
    for r in DATA['rows']:
        if r[0] != ym or r[15] < 0:
            continue
        por[r[15]] = por.get(r[15], 0) + r[1]
    vals = sorted(por.values(), reverse=True)
    if not vals:
        return None
    return {'n': len(vals), 'metade': quantos_para(vals, .5), 'maior': vals[0], 'total': soma(vals)}

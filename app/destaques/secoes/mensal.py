# -*- coding: utf-8 -*-
"""Destaques da Análise mensal — as chamadas de ins() de renderMensalBody (app.js).
Onde o Kit encadeia `ins(A)||ins(B)`, aqui vale a primeira regra que dispara."""
from ...calculo.vendas import PSEUDO_VEND, agregar
from ..genericas import auto, concentracao
from ..regras_vendas import mes_vs_anterior, preco_volume_mensal


def _primeiro(*destaques):
    for d in destaques:
        if d:
            return d
    return None


def montar(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    meses = sorted({r[0] for r in DATA['rows']})
    try:
        ym = int(params.get('ym') or meses[-1])
    except (TypeError, ValueError):
        ym = meses[-1]
    if ym not in meses:
        ym = meses[-1]
    j = agregar(DATA, ym, ym)
    if not j['total']:
        return
    yield ('mn-evol', [], _primeiro(preco_volume_mensal(C, {'fim': ym}), mes_vs_anterior(C, {'fim': ym})))
    vend = [x for x in j['vend'] if x['name'] not in PSEUDO_VEND]
    yield ('mn-vend', [], _primeiro(
        concentracao({'itens': [{'name': x['name'], 'v': x['v']} for x in vend],
                      'escopo': 'vendedor(a)', 'escopoPl': 'vendedores', 'universo': 'da venda do mês',
                      'id': 'vend-mes'}),
        auto({'itens': [{'name': x['name'], 'v': x['v'], 'q': x['q'], 'peds': x['peds']} for x in vend],
              'escopo': 'vendedor(a)', 'escopoPl': 'vendedores', 'universo': 'da venda do mês',
              'id': 'vend-mes-alt', 'preferir': ['divergencia', 'cauda']})))
    fams = [f for f in j['fams'] if f['name'] != 'Frete/Serviço']
    yield ('mn-cat', [], concentracao({'itens': [{'name': x['name'], 'v': x['v']} for x in fams],
                                       'escopo': 'categoria', 'escopoPl': 'categorias',
                                       'universo': 'da venda do mês', 'id': 'fam-mes'}))
    yield ('mn-cli', [], concentracao({'itens': [{'name': x['name'], 'v': x['v']} for x in j['clis']],
                                       'escopo': 'cliente', 'escopoPl': 'clientes',
                                       'universo': 'da venda do mês', 'id': 'cli-mes',
                                       'limiar': .35, 'tabela': True}))

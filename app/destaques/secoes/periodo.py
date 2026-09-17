# -*- coding: utf-8 -*-
"""Destaques da Análise por período — as chamadas de ins() de renderPeriodo (app.js)."""
from ...calculo.secoes.periodo import CLSMAP, _carteira_hist, filtro
from ...calculo.vendas import PSEUDO_VEND, agregar
from ...calculo.numeros import ordem_chaves_js
from ...calculo.datas import ym_lab
from ..genericas import auto
from ..regras_carteira import meses_cobertura
from ..regras_matriz import mix_cruzado


def _primeiro(*ds):
    for d in ds:
        if d:
            return d
    return None


def montar(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    a, b = filtro(C, params)
    g = agregar(DATA, a, b)
    ch = _carteira_hist(C, g['monthly'])
    if ch:
        labels = [ym_lab(y) for y in ch['yms']]
        yield ('pe-cart', [], _primeiro(
            meses_cobertura({'labels': labels, 'carteira': ch['valor'], 'meses': ch['meses'],
                             'venda': ch['venda']}),
            auto({'itens': [{'name': labels[i], 'v': v} for i, v in enumerate(ch['valor'])],
                  'escopo': 'mês', 'escopoPl': 'meses', 'universo': 'da carteira em aberto',
                  'id': 'cart-hist', 'preferir': ['cauda', 'estrutura']})))
    vr = [x for x in g['vend'] if x['peds'] >= 1 and x['name'] not in PSEUDO_VEND]
    vend_it = [{'name': x['name'], 'v': x['v'], 'q': x['q'], 'peds': x['peds'], 'extra': x['com']} for x in vr]
    yield ('pe-vend', [], auto({'itens': vend_it, 'escopo': 'vendedor(a)', 'escopoPl': 'vendedores',
                                'universo': 'da venda do período', 'id': 'vend-periodo',
                                'preferir': ['divergencia']}))
    yield ('pe-vend', [], auto({'itens': vend_it, 'escopo': 'vendedor(a)', 'escopoPl': 'vendedores',
                                'universo': 'da venda do período', 'rotuloExtra': 'comissão',
                                'id': 'vend-periodo-tab', 'tabela': True, 'preferir': ['taxa', 'cauda']}))
    fams = [f for f in g['fams'] if f['name'] != 'Frete/Serviço']
    yield ('pe-cat', [], auto({'itens': [{'name': x['name'], 'v': x['v']} for x in fams],
                               'escopo': 'categoria', 'escopoPl': 'categorias',
                               'universo': 'da venda do período', 'id': 'fam-periodo', 'preferir': ['cauda']}))
    top_v = [x['name'] for x in vr[:6]]
    top_f = [x['name'] for x in fams[:8]]
    md = {vn: {fn: 0 for fn in top_f} for vn in top_v}
    for vi in ordem_chaves_js(g['VF']):
        vn = DATA['vd'][vi]
        if vn not in md:
            continue
        for fi in ordem_chaves_js(g['VF'][vi]):
            fn = DATA['fam'][fi]
            if fn in md[vn]:
                md[vn][fn] = g['VF'][vi][fi]
    yield ('pe-catvend', [], mix_cruzado({'linhas': top_v, 'colunas': top_f, 'mat': md,
                                          'escopo': 'vendedor(a)', 'id': 'vend-fam-periodo'}))
    clis = [{'name': x['name'], 'v': x['v']} for x in g['clis']]
    yield ('pe-canal', [], auto({'itens': clis, 'escopo': 'cliente', 'escopoPl': 'clientes',
                                 'universo': 'da venda do período', 'id': 'cli-periodo', 'preferir': ['cauda']}))
    cagg = {}
    for x in g['clss']:
        k = CLSMAP.get(x['name'], x['name'])
        cagg[k] = cagg.get(k, 0) + x['v']
    yield ('pe-canal', [], auto({'itens': [{'name': k, 'v': cagg[k]} for k in ordem_chaves_js(cagg)],
                                 'escopo': 'canal', 'escopoPl': 'canais',
                                 'universo': 'da venda do período', 'id': 'canal-periodo'}))
    yield ('pe-cli', [], auto({'itens': clis, 'escopo': 'cliente', 'escopoPl': 'clientes',
                               'universo': 'da venda do período', 'id': 'cli-periodo-tab',
                               'tabela': True, 'preferir': ['estrutura']}))
    desg_it = [{'name': x['name'], 'v': x['v'], 'peds': x['peds'], 'extra': x['roy']} for x in g['desg']]
    yield ('pe-desig', [], auto({'itens': desg_it, 'escopo': 'designer', 'escopoPl': 'designers',
                                 'universo': 'dos royalties', 'rotuloExtra': 'royalty',
                                 'id': 'desg-periodo', 'preferir': ['taxa']}))
    yield ('pe-desig', [], auto({'itens': desg_it, 'escopo': 'designer', 'escopoPl': 'designers',
                                 'universo': 'da venda associada', 'id': 'desg-periodo-tab',
                                 'tabela': True, 'preferir': ['divergencia', 'cauda']}))
    arq_it = [{'name': x['name'], 'v': x['v'], 'peds': x['peds'], 'extra': x['rt']} for x in g['arqs']]
    yield ('pe-arq', [], auto({'itens': arq_it, 'escopo': 'arquiteto', 'escopoPl': 'arquitetos',
                               'universo': 'da RT paga', 'rotuloExtra': 'RT', 'id': 'arq-periodo',
                               'preferir': ['taxa']}))
    yield ('pe-arq', [], auto({'itens': arq_it, 'escopo': 'arquiteto', 'escopoPl': 'arquitetos',
                               'universo': 'da venda associada', 'id': 'arq-periodo-tab',
                               'tabela': True, 'preferir': ['cauda', 'divergencia']}))
    c = g['comp']
    comp = [['RT arquitetos', c['rt']], ['Royalties designers', c['roy']], ['Comissão vendedor(a) (PF)', c['pf']],
            ['Prêmio', c['prem']], ['Comissão vendedor(a) (PJ)', c['pj']], ['Curadoria / RP', c['cur']],
            ['DSR', c['dsr']], ['Comissão gerente', c['ger']]]
    rep_it = [{'name': x[0], 'v': x[1]} for x in sorted((x for x in comp if x[1] > 0), key=lambda x: -x[1])]
    yield ('pe-repasses', [], auto({'itens': rep_it, 'escopo': 'repasse', 'escopoPl': 'tipos de repasse',
                                    'universo': 'dos repasses', 'id': 'rep-periodo', 'preferir': ['cauda']}))
    yield ('pe-repasses', [], auto({'itens': rep_it, 'escopo': 'repasse', 'escopoPl': 'tipos de repasse',
                                    'universo': 'dos repasses', 'id': 'rep-periodo-tab', 'tabela': True,
                                    'preferir': ['estrutura']}))

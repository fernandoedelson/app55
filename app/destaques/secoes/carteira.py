# -*- coding: utf-8 -*-
"""Destaques da Carteira em aberto e da Carteira dinâmica — chamadas de ins() de renderCarteira(),
renderCarteiraDinamica() e drawCartdinStatus() (app.js)."""
from ...calculo.datas import ym_lab
from ...calculo.numeros import ordem_chaves_js, soma
from ...calculo.secoes.carteira import ST_ROT
from ...calculo.vendas import PSEUDO_VEND
from ..genericas import auto, concentracao
from ..regras_carteira import adiado_ticket, atraso_concentrado, pico_entrega, ticket_por_espera


def _primeiro(*ds):
    for d in ds:
        if d:
            return d
    return None


def montar(C, params=None):
    DATA, CD = C.blob('DATA'), C.blob('CARTDIN')
    c = DATA['carteira']
    stat = []
    if CD:
        mapa = dict(CD['status'])
        stat = [[rot, mapa.get(k, 0)] for k, rot in ST_ROT]
    tem_stat = bool(stat) and soma(x[1] for x in stat) > 0
    if tem_stat:
        yield ('ce-status', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in stat],
                                      'escopo': 'status', 'escopoPl': 'status', 'universo': 'da carteira',
                                      'id': 'cart-status', 'preferir': ['estrutura', 'cauda']}))
    # o aging pertence ao bloco do status quando ele existe; senão, à abertura da seção
    bloco_aging = 'ce-status' if tem_stat else 'carteira.abertura'
    aging_itens = [{'name': x[0], 'v': x[1], 'q': x[2]} for x in c['aging']]
    yield (bloco_aging, [], _primeiro(
        ticket_por_espera({'aging': c['aging']}),
        auto({'itens': aging_itens, 'escopo': 'faixa', 'escopoPl': 'faixas de espera',
              'universo': 'da carteira', 'id': 'cart-aging', 'preferir': ['relacao', 'estrutura']})))
    yield (bloco_aging, [], auto({'itens': aging_itens, 'escopo': 'faixa', 'escopoPl': 'faixas de espera',
                                  'universo': 'da carteira', 'id': 'cart-aging-tab', 'tabela': True,
                                  'preferir': ['taxa', 'cauda']}))
    vend = [x for x in c['vend'] if x[0] not in PSEUDO_VEND]
    yield ('ce-vend', [], auto({'itens': [{'name': x[0], 'v': x[1], 'q': x[2], 'peds': x[2]} for x in vend],
                                'escopo': 'vendedor(a)', 'escopoPl': 'vendedores',
                                'universo': 'da carteira em aberto', 'id': 'cart-vend', 'tabela': True,
                                'preferir': ['divergencia', 'estrutura']}))
    yield ('ce-peds', [], auto({'itens': [{'name': x[1] or ('Pedido ' + str(x[0])), 'v': x[3]} for x in c['peds']],
                                'escopo': 'pedido', 'escopoPl': 'pedidos', 'universo': 'da carteira em aberto',
                                'id': 'cart-peds', 'tabela': True, 'preferir': ['cauda', 'estrutura']}))


def montar_dinamica(C, params=None):
    CD = C.blob('CARTDIN')
    if not CD:
        return
    yield ('cd-status', [], _primeiro(
        atraso_concentrado(C),
        auto({'itens': [{'name': x[0], 'v': x[1]} for x in CD['status']], 'escopo': 'status',
              'escopoPl': 'status', 'universo': 'da carteira', 'id': 'cartdin-status',
              'preferir': ['estrutura', 'cauda']})))
    E = CD['evol']
    yield ('cd-evol', [], auto({'itens': [{'name': ym_lab(y), 'v': E['vendas'][i], 'q': E['atrasados'][i]}
                                          for i, y in enumerate(E['yms'])],
                                'escopo': 'mês', 'escopoPl': 'meses', 'universo': 'da carteira',
                                'id': 'cartdin-evol', 'preferir': ['relacao', 'cauda']}))
    yield ('cd-adiados', [], adiado_ticket(C))
    A = CD['andamento_entrega']
    yield ('cd-previsao', [], _primeiro(
        pico_entrega(C),
        auto({'itens': [{'name': ym_lab(y), 'v': A['valor'][i]} for i, y in enumerate(A['yms'])],
              'escopo': 'mês de entrega', 'escopoPl': 'meses de entrega',
              'universo': 'do que está para faturar', 'id': 'cartdin-entrega',
              'preferir': ['cauda', 'estrutura']})))
    vend = [x for x in (CD.get('vend') or []) if x[0] not in PSEUDO_VEND]
    if CD.get('vend'):
        yield ('cd-vend', [], auto({'itens': [{'name': x[0], 'v': x[1], 'q': x[2], 'peds': x[2]} for x in vend],
                                    'escopo': 'vendedor(a)', 'escopoPl': 'vendedores',
                                    'universo': 'da carteira em aberto', 'id': 'cartdin-vend',
                                    'tabela': True, 'preferir': ['divergencia', 'estrutura']}))
    pc = {}
    for b in CD.get('status_pedidos') or {}:
        for x in CD['status_pedidos'][b]:
            o = pc.get(x[0])
            if o is None:
                o = pc[x[0]] = {'ped': x[0], 'valor': 0}
            o['valor'] += x[2]
    peds = sorted((pc[k] for k in ordem_chaves_js(pc)), key=lambda o: -o['valor'])
    yield ('cd-peds', [], concentracao({'itens': [{'name': 'FOCCO-' + str(o['ped']), 'v': o['valor']} for o in peds],
                                        'escopo': 'pedido', 'escopoPl': 'pedidos', 'universo': 'da carteira',
                                        'id': 'ped-carteira', 'tabela': True}))
    # o detalhe por status é desenhado no clique: um destaque por bucket, com a mesma chave do Kit
    for bucket, lst in (CD.get('status_pedidos') or {}).items():
        yield ('cd-status', [], auto({'itens': [{'name': x[1] or ('Pedido ' + str(x[0])), 'v': x[2], 'q': x[3]}
                                                for x in lst],
                                      'escopo': 'pedido', 'escopoPl': 'pedidos',
                                      'universo': 'do status ' + str(bucket).lower(),
                                      'id': 'cartdin-peds-' + bucket, 'tabela': True,
                                      'preferir': ['cauda', 'estrutura']}))

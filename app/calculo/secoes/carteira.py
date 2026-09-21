# -*- coding: utf-8 -*-
"""Carteira em aberto (base comercial) e Carteira dinâmica (VENDAS LOJA) — porte de
renderCarteira() e renderCarteiraDinamica() (app.js)."""
from ..numeros import ordem_chaves_js, soma
from ..vendas import PSEUDO_VEND

ST_ROT = [('ANDAMENTO', 'Em andamento'), ('FINALIZADO', 'Finalizado (estoque)'), ('ADIADO', 'Adiado p/ cliente'),
          ('ATRASADO', 'Atrasado')]


def calcular_carteira(C, params=None):
    # a Carteira é a posição de fechamento; sem esse arquivo, usa a dinâmica (é o que o Kit faz)
    DATA, CD = C.blob('DATA'), C.blob('CARTDIN_FECH') or C.blob('CARTDIN')
    c = DATA['carteira']
    # o aging vem logo depois do quadro de status; sem carteira dinâmica não há esse título e o
    # aging passa a pertencer à abertura da seção (é assim que o Kit marca os blocos)
    out = {'carteira.abertura': {'maxym': C.maxym_vendas, 'total': c['total']}}
    stat = []
    if CD:
        mapa = dict(CD['status'])
        stat = [[rot, mapa.get(k, 0)] for k, rot in ST_ROT]
    if not stat or soma(x[1] for x in stat) <= 0:
        out['carteira.abertura']['aging'] = c['aging']
    else:
        out['ce-status'] = {'stat': stat, 'itens': CD['itens'], 'data_base': CD['data_base'],
                            'maxym': C.maxym_vendas, 'total_base': c['total'], 'aging': c['aging']}
    out['ce-vend'] = {'vend': [x for x in c['vend'] if x[0] not in PSEUDO_VEND]}
    out['ce-peds'] = {'peds': [[x[0], x[1], x[3]] for x in c['peds'][:12]]}
    return out


def calcular_dinamica(C, params=None):
    CD = C.blob('CARTDIN')
    if not CD:
        return {'carteira_dinamica.abertura': {'ausente': True}}
    pc = {}
    for b in CD.get('status_pedidos') or {}:
        for x in CD['status_pedidos'][b]:
            o = pc.get(x[0])
            if o is None:
                o = pc[x[0]] = {'ped': x[0], 'cliente': x[1], 'valor': 0, 'status': []}
            o['valor'] += x[2]
            if b not in o['status']:
                o['status'].append(b)
            if (not o['cliente'] or o['cliente'] == 'Não informado') and x[1]:
                o['cliente'] = x[1]
    peds = [pc[k] for k in ordem_chaves_js(pc)]
    peds.sort(key=lambda o: -o['valor'])
    fonte = CD.get('fonte')
    # detalhe por status sem os itens de cada pedido (os itens vêm por detalhamento)
    por_status = {b: [p[:4] for p in lst] for b, lst in (CD.get('status_pedidos') or {}).items()}
    return {
        'carteira_dinamica.abertura': {'fonte': fonte, 'data_base': CD['data_base'], 'total': CD['total'],
                                       'itens': CD['itens'], 'pedidos': CD['pedidos']},
        'cd-status': {'status': CD['status'], 'pedidos': por_status},
        'cd-evol': {'evol': CD['evol']},
        'cd-adiados': {'evol': CD['evol_adiado']},
        'cd-previsao': {'evol': CD['andamento_entrega']},
        'cd-vend': {'vend': [x for x in (CD.get('vend') or []) if x[0] not in PSEUDO_VEND], 'tem': bool(CD.get('vend'))},
        'cd-peds': {'peds': [[o['ped'], o['cliente'], o['status'], o['valor']] for o in peds[:12]]},
        'cd-status-tab': {'status': CD['status']},
    }


def itens_do_pedido(C, params):
    CD = C.blob('CARTDIN')
    alvo = str(params.get('ped', ''))
    sp = CD.get('status_pedidos') or {}
    # o pedido é procurado no status que foi clicado (um pedido pode ter itens em dois status)
    listas = [sp[params['status']]] if params.get('status') in sp else list(sp.values())
    for lst in listas:
        for p in lst:
            if str(p[0]) == alvo:
                return {'ped': p[0], 'itens': p[4]}
    return {'ped': alvo, 'itens': []}

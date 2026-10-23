# -*- coding: utf-8 -*-
"""Carteira em aberto (base comercial) e Carteira dinâmica (VENDAS LOJA) — porte de
renderCarteira() e renderCarteiraDinamica() (app.js)."""
from ..numeros import ordem_chaves_js, soma
from ..vendas import PSEUDO_VEND

ST_ROT = [('ANDAMENTO', 'Em andamento'), ('FINALIZADO', 'Finalizado (estoque)'), ('ADIADO', 'Adiado p/ cliente'),
          ('ATRASADO', 'Atrasado')]


def _partes_relacionadas(C):
    """Trechos de nome de cliente tratados como intragrupo (config_apresentacao.json): o desenho marca PR e explica."""
    return [str(p) for p in (C.blob('PARTES_RELACIONADAS') or []) if p]


def calcular_carteira(C, params=None):
    # a Carteira é a posição de fechamento; sem esse arquivo, usa a dinâmica (é o que o Kit faz)
    DATA, CD = C.blob('DATA'), C.blob('CARTDIN_FECH') or C.blob('CARTDIN')
    c = DATA['carteira']
    # o aging vem logo depois do quadro de status; sem carteira dinâmica não há esse título e o
    # aging passa a pertencer à abertura da seção (é assim que o Kit marca os blocos)
    pr_cd = (CD or {}).get('pr')
    out = {'carteira.abertura': {'maxym': C.maxym_vendas, 'total': c['total'], 'pr': c.get('pr')}}
    stat = []
    if CD:
        mapa = dict(CD['status'])
        stat = [[rot, mapa.get(k, 0)] for k, rot in ST_ROT]
    if not stat or soma(x[1] for x in stat) <= 0:
        out['carteira.abertura']['aging'] = c['aging']
    else:
        out['ce-status'] = {'stat': stat, 'itens': CD['itens'], 'data_base': CD['data_base'],
                            'maxym': C.maxym_vendas, 'total_base': c['total'], 'aging': c['aging'],
                        # parte relacionada (PR): por status (carteira dinâmica) e por faixa/vendedor (base)
                        'pr_base': c.get('pr'), 'pr_total': pr_cd['total'] if pr_cd else None,
                        'pr_stat': [pr_cd['status'].get(k, 0) for k, _ in ST_ROT] if pr_cd else None}
    out['ce-vend'] = {'vend': [x for x in c['vend'] if x[0] not in PSEUDO_VEND], 'pr': (c.get('pr') or {}).get('vend')}
    out['ce-peds'] = {'peds': [[x[0], x[1], x[3]] for x in c['peds'][:12]], 'pr': _partes_relacionadas(C)}
    return out


def _faixa_data(datas):
    """Data (ou faixa) dos itens de um pedido: '03/07/2026' ou '03/07/2026 a 28/08/2026' — o mesmo texto do Kit."""
    v = [d for d in datas if d]
    if not v:
        return '—'
    chave = lambda d: tuple(int(x) for x in reversed(d.split('/')))
    u = sorted(set(v), key=chave)
    return u[0] if len(u) == 1 else u[0] + ' a ' + u[-1]


def eh_showroom(cliente):
    """SHOW ROOM não vira faturamento: vale o nome do cliente, sem acento nem espaço (o mesmo teste do Kit)."""
    import re
    import unicodedata
    return 'SHOWROOM' in re.sub('[^A-Za-z]', '', unicodedata.normalize('NFD', str(cliente or ''))).upper()


def _andamento_por_mes(C, CD):
    """Em andamento por mês de entrega prevista: peças, valor e peças de parte relacionada (a mesma leitura do Kit)."""
    peds = (CD.get('status_pedidos') or {}).get('ANDAMENTO') or []
    pats = [p.upper() for p in _partes_relacionadas(C)]
    por = {}
    for p in peds:
        pr = bool(pats) and any(x in str(p[1] or '').upper() for x in pats)
        sh = eh_showroom(p[1])
        for linha in p[4] or []:
            if not linha[4]:
                continue
            _d, mes, ano = linha[4].split('/')
            # [peças que faturam, valor que fatura, peças PR que faturam, peças showroom, valor showroom, peças PR showroom]
            o = por.setdefault(int(ano) * 100 + int(mes), [0.0] * 8)
            k = 3 if sh else 0
            o[k] += linha[1] or 0
            o[k + 1] += linha[2] or 0
            if pr:
                o[k + 2] += linha[1] or 0
                o[6 + (1 if sh else 0)] += linha[2] or 0     # valor PR do segmento (barras de valor da previsão)
    if not por:
        return None
    yms = sorted(por)
    # pedidos de cada mês (só os itens daquele mês de entrega): [pedido, cliente, itens, peças, valor]
    pedidos = {}
    for p in peds:
        meses = {}
        for linha in p[4] or []:
            if not linha[4]:
                continue
            _d, mes, ano = linha[4].split('/')
            o = meses.setdefault(int(ano) * 100 + int(mes), [0, 0.0, 0.0])
            o[0] += 1
            o[1] += linha[1] or 0
            o[2] += linha[2] or 0
        for ym, (n, q, v) in meses.items():
            itens_mes = [l for l in (p[4] or []) if l[4] and int(l[4].split('/')[2]) * 100 + int(l[4].split('/')[1]) == ym]
            pedidos.setdefault(str(ym), []).append([p[0], p[1], n, q, round(v, 2),
                                                    _faixa_data([l[3] for l in itens_mes]), _faixa_data([l[4] for l in itens_mes])])
    for lst in pedidos.values():
        lst.sort(key=lambda x: -x[4])
    col = lambda i: [por[y][i] for y in yms]
    soma = lambda a, b: [x + y for x, y in zip(a, b)]
    return {'yms': yms, 'qtd': soma(col(0), col(3)), 'valor': soma(col(1), col(4)),
            'qtd_pr': soma(col(2), col(5)) if pats else None,
            'q_fat': col(0), 'v_fat': col(1), 'qpr_fat': col(2) if pats else None,
            'q_show': col(3), 'v_show': col(4), 'qpr_show': col(5) if pats else None,
            'vpr_fat': col(6) if pats else None, 'vpr_show': col(7) if pats else None,
            'pedidos': pedidos, 'pr_padroes': _partes_relacionadas(C)}


def _adiados_por_mes(C, CD):
    """Pedidos adiados de cada mês de VENDA (o eixo do gráfico), só com os itens daquele mês:
    [pedido, cliente, itens, peças, valor, data da venda, entrega prevista] — a mesma forma do Em andamento."""
    pedidos = {}
    for p in (CD.get('status_pedidos') or {}).get('ADIADO') or []:
        meses = {}
        for linha in p[4] or []:
            if not linha[3]:
                continue
            _d, mes, ano = linha[3].split('/')
            meses.setdefault(int(ano) * 100 + int(mes), []).append(linha)
        for ym, itens in meses.items():
            pedidos.setdefault(str(ym), []).append([p[0], p[1], len(itens), sum(l[1] or 0 for l in itens),
                                                    round(sum(l[2] or 0 for l in itens), 2),
                                                    _faixa_data([l[3] for l in itens]), _faixa_data([l[4] for l in itens])])
    for lst in pedidos.values():
        lst.sort(key=lambda x: -x[4])
    return {'pedidos': pedidos, 'pr_padroes': _partes_relacionadas(C)}


def _previsao_separada(C, CD):
    """O que vira faturamento e o que é showroom em cada mês da previsão (mesmos meses do gráfico): peças e valor."""
    a = _andamento_por_mes(C, CD)
    if not a:
        return None
    ix = {y: i for i, y in enumerate(a['yms'])}
    pega = lambda k: None if a.get(k) is None else [a[k][ix[y]] if y in ix else 0 for y in CD['andamento_entrega']['yms']]
    return {k: pega(k) for k in ('q_fat', 'v_fat', 'vpr_fat', 'q_show', 'v_show', 'vpr_show')}


def _pedidos_do_mes(C, CD):
    """Os pedidos de cada mês de entrega (e os padrões de PR) para o gráfico de previsão de faturamento."""
    a = _andamento_por_mes(C, CD)
    return {'pedidos': a['pedidos'], 'pr_padroes': a['pr_padroes']} if a else {}


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
    pr = CD.get('pr')
    # detalhe por status sem os itens de cada pedido (os itens vêm por detalhamento)
    por_status = {b: [p[:4] + [_faixa_data([l[3] for l in p[4]]), _faixa_data([l[4] for l in p[4]])] for p in lst]
                  for b, lst in (CD.get('status_pedidos') or {}).items()}
    return {
        'carteira_dinamica.abertura': {'fonte': fonte, 'data_base': CD['data_base'], 'total': CD['total'],
                                       'itens': CD['itens'], 'pedidos': CD['pedidos'],
                                       'pr_total': pr['total'] if pr else None},
        'cd-status': {'status': CD['status'], 'pedidos': por_status, 'total': CD['total'],
                      'pr_status': [pr['status'].get(x[0], 0) for x in CD['status']] if pr else None,
                      'pr_total': pr['total'] if pr else None, 'pr_padroes': _partes_relacionadas(C)},
        'cd-evol': {'evol': CD['evol'], 'pr': [pr['evol']['vendas'], pr['evol']['atrasados']] if pr else None},
        'cd-adiados': {'evol': CD['evol_adiado'], 'pr': [pr['adiado']] if pr else None, **_adiados_por_mes(C, CD)},
        'cd-previsao': {'evol': CD['andamento_entrega'], 'pr': [pr['entrega']] if pr else None,
                        'separada': _previsao_separada(C, CD), **_pedidos_do_mes(C, CD)},
        'cd-andamento': _andamento_por_mes(C, CD),
        'cd-vend': {'vend': [x for x in (CD.get('vend') or []) if x[0] not in PSEUDO_VEND], 'tem': bool(CD.get('vend')),
                    'pr': pr['vend'] if pr else None},
        'cd-peds': {'peds': [[o['ped'], o['cliente'], o['status'], o['valor']] for o in peds[:12]],
                    'pr': _partes_relacionadas(C)},
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

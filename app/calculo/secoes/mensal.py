# -*- coding: utf-8 -*-
"""Análise mensal — porte de buildMensalFilter/renderMensalBody (app.js). Parâmetro: ym."""
from ..datas import ym_list, ym_shift
from ..vendas import PSEUDO_VEND, agregar, cliente_itens, tabela_clientes


def meses_disponiveis(DATA):
    return sorted({r[0] for r in DATA['rows']})


def calcular(C, params=None):
    DATA = C.blob('DATA')
    ms = meses_disponiveis(DATA)
    try:
        ym = int((params or {}).get('ym') or ms[-1])
    except (TypeError, ValueError):
        ym = ms[-1]
    if ym not in ms:
        ym = ms[-1]
    j = agregar(DATA, ym, ym)
    pv = ym_shift(ym, -1)
    p = agregar(DATA, pv, pv)
    resumo = lambda g: {'total': g['total'], 'peds': g['peds'], 'ticket': g['ticket'], 'qnt': g['qnt']}
    out = {'mensal.abertura': {'meses': ms, 'ym': ym, 'pv': pv, 'j': resumo(j), 'p': resumo(p)}}
    if not j['total']:
        return out
    ini = ym_shift(ym, -11)
    win = agregar(DATA, ini, ym)
    meses = ym_list(ini, ym)
    vend = [x for x in j['vend'] if x['name'] not in PSEUDO_VEND]
    fams = [f for f in j['fams'] if f['name'] != 'Frete/Serviço']
    out.update({
        'mn-evol': {'ym': ym, 'meses': meses, 'serie': [win['monthly'].get(m, 0) for m in meses]},
        'mn-vend': {'top': [[x['name'], x['v']] for x in vend[:6]]},
        'mn-cat': {'top': [[x['name'], x['v']] for x in fams[:6]]},
        'mn-cli': dict(tabela_clientes(j['clis'], j['total'], maximo=30), ym=ym),
    })
    return out


def itens_do_cliente(C, params):
    """Detalhamento: itens comprados por um cliente no mês (recurso 'detalhar')."""
    DATA = C.blob('DATA')
    ym, cli = int(params['ym']), int(params['cli'])
    return {'itens': cliente_itens(DATA, cli, ym, ym)}

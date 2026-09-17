# -*- coding: utf-8 -*-
"""Destaques da Análise de Vendas — as chamadas de ins() de renderAnaliseVendas (app.js)."""
from ...calculo.datas import ym_shift
from ...calculo.numeros import ordem_chaves_js, soma
from ...calculo.secoes.analise_vendas import _janela, comercial_agg, rfv_clientes
from ..regras_matriz import mix_cruzado
from ..regras_rfv import (fatores_lider, lider, potencial_ticket, rfv_por_vendedor, rfv_risco,
                          rfv_segmentos, rfv_tabela)


def montar(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    janela, fim = _janela(params), C.maxym_vendas
    vend, total = comercial_agg(DATA, ym_shift(fim, -(janela - 1)), fim)
    if not vend:
        return
    L, demais = vend[0], vend[1:]
    tot_demais = soma(x['v'] for x in demais)
    s_peds, s_q = soma(x['peds'] for x in demais), soma(x['q'] for x in demais)
    s_clis, s_com = soma(x['clis'] for x in demais), soma(x['com'] for x in demais)
    med = {'v': tot_demais / len(demais) if demais else 0, 'ticket': tot_demais / s_peds if s_peds else 0,
           'titem': tot_demais / s_q if s_q else 0, 'itensPed': s_q / s_peds if s_peds else 0,
           'pedCli': s_peds / s_clis if s_clis else 0, 'vCli': tot_demais / s_clis if s_clis else 0,
           'custop': s_com / tot_demais if tot_demais else 0}
    yield ('av-lider', [], lider({'lider': L, 'demais': demais, 'medDemais': med, 'total': total}))
    fatores = [{'nome': 'Clientes atendidos', 'l': L['clis'],
                'd': soma(x['clis'] for x in demais) / len(demais) if demais else 0, 'fmt': 'nf0'},
               {'nome': 'Pedidos por cliente', 'l': L['pedCli'], 'd': med['pedCli'], 'fmt': 'nf2'},
               {'nome': 'Valor médio do pedido', 'l': L['ticket'], 'd': med['ticket'], 'fmt': 'money'}]
    yield ('av-diferenca', [], fatores_lider({'fatores': fatores}))
    top_v = [x['name'] for x in vend[:7]]
    fam_tot = {}
    for x in vend:
        for f in ordem_chaves_js(x['fam']):
            fam_tot[f] = fam_tot.get(f, 0) + x['fam'][f]
    top_f = sorted((f for f in ordem_chaves_js(fam_tot) if f != 'Frete/Serviço'), key=lambda f: -fam_tot[f])[:8]
    md = {}
    for vn in top_v:
        o = next((x for x in vend if x['name'] == vn), None)
        md[vn] = {fn: ((o['fam'].get(fn) if o else 0) or 0) for fn in top_f}
    yield ('av-mix', [], mix_cruzado({'linhas': top_v, 'colunas': top_f, 'mat': md,
                                      'escopo': 'vendedor(a)', 'id': 'vendas-mix'}))
    cen = []
    for x in demais:
        cen.append({'name': x['name'], 'v': x['v'],
                    'porTicket': max(0, x['peds'] * L['ticket'] - x['v']),
                    'porFreq': max(0, (x['clis'] * L['pedCli'] * x['ticket']) - x['v'])})
    yield ('av-jogo', [], potencial_ticket({'cen': cen, 'lider': L, 'totDemais': tot_demais,
                                            'ganhoTicket': soma(x['porTicket'] for x in cen)}))
    RF = rfv_clientes(DATA, fim, max(janela, 12))
    if not RF:
        return
    ctx_rfv = {'segs': RF['segs'], 'total': RF['total'], 'cli': RF['cli']}
    yield ('av-rfv', [], rfv_segmentos(ctx_rfv))
    yield ('av-rfv', [], rfv_tabela(ctx_rfv))
    risco = sorted((x for x in RF['cli'] if x['seg'] in ('Em risco', 'Hibernando')), key=lambda x: -x['v'])[:15]
    if risco:
        yield ('av-parados', [], rfv_risco({'risco': risco, 'total': RF['total'], 'cli': RF['cli']}))
    donos = []
    for x in RF['cli']:
        if x['dono'] and x['dono'] not in donos:
            donos.append(x['dono'])
    linhas = []
    for d in donos:
        meus = [x for x in RF['cli'] if x['dono'] == d]
        camp = [x for x in meus if x['seg'] in ('Campeões', 'Fiéis')]
        perd = [x for x in meus if x['seg'] in ('Em risco', 'Hibernando', 'Perdidos')]
        linhas.append({'d': d, 'n': len(meus), 'v': soma(x['v'] for x in meus), 'camp': len(camp),
                       'vcamp': soma(x['v'] for x in camp), 'perd': len(perd),
                       'vperd': soma(x['v'] for x in perd), 'rec': soma(x['f'] for x in meus) / len(meus)})
    linhas = sorted((x for x in linhas if x['n'] >= 3), key=lambda x: -x['v'])
    yield ('av-qualidade', [], rfv_por_vendedor({'donos': linhas}))

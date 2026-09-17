# -*- coding: utf-8 -*-
"""Regras da Análise de Vendas (líder e RFV dos clientes) — porte de R.lider, R.fatoresLider,
R.potencialTicket, R.rfvSegmentos, R.rfvTabela, R.rfvRisco e R.rfvPorVendedor (insights.js)."""
from ..calculo.numeros import ordem_chaves_js, pot, soma
from .nucleo import destaque


def lider(ctx):
    L, M, D = ctx.get('lider'), ctx.get('medDemais'), ctx.get('demais')
    if not L or not M or not D:
        return None
    fatores = [{'nome': 'clientes atendidos', 'l': L['clis'], 'm': soma(x['clis'] for x in D) / len(D)},
               {'nome': 'pedidos por cliente', 'l': L['pedCli'], 'm': M['pedCli']},
               {'nome': 'ticket por pedido', 'l': L['ticket'], 'm': M['ticket']}]
    for f in fatores:
        f['r'] = f['l'] / f['m'] if f['m'] else 0
    forte = max(fatores, key=lambda f: f['r'])
    fraco = min(fatores, key=lambda f: f['r'])
    razao = L['v'] / M['v'] if M['v'] else 0
    if razao < 1.3:
        return None
    return destaque('lider', dict(ctx, tabela=True), 'decomposicao', (forte['r'] - 1) / 2,
                    {'nome': L['name'], 'razao': razao, 'esperado': pot(razao, 1 / 3),
                     'forte': forte['nome'], 'rForte': forte['r'], 'fraco': fraco['nome'], 'rFraco': fraco['r']},
                    tom='ok', id_fixo='lider-retrato')


def fatores_lider(ctx):
    F = ctx.get('fatores')
    if not F or len(F) < 3:
        return None
    com = [dict(f, r=(f['l'] / f['d'] - 1) if f['d'] else 0) for f in F]
    acima = [f for f in com if f['r'] > .1]
    abaixo = [f for f in com if f['r'] < -.05]
    if not acima:
        return None
    maior = max(com, key=lambda f: f['r'])
    return destaque('fatoresLider', ctx, 'decomposicao', maior['r'],
                    {'maior': maior['nome'], 'rMaior': maior['r'],
                     'abaixo': ({'nome': abaixo[0]['nome'], 'r': abaixo[0]['r']} if abaixo else None),
                     'fatores': [{'nome': f['nome'], 'l': f['l'], 'd': f['d'], 'r': f['r'], 'fmt': f['fmt']}
                                 for f in com]},
                    labels=[maior['nome']], id_fixo='lider-fatores')


def potencial_ticket(ctx):
    cen, L = ctx.get('cen'), ctx.get('lider')
    if not cen or not L or not ctx.get('totDemais'):
        return None
    ganho = ctx.get('ganhoTicket') or 0
    if ganho <= 0:
        return None
    ordem = sorted(cen, key=lambda x: -x['porTicket'])
    top2 = soma(x['porTicket'] for x in ordem[:2])
    sh = ganho / ctx['totDemais']
    return destaque('potencialTicket', dict(ctx, tabela=True), 'consequencia', sh,
                    {'ganho': ganho, 'sh': sh, 'nome': L['name'], 'ticket': L['ticket'],
                     'shTop2': top2 / ganho if ganho else 0,
                     'top2': [{'name': x['name'], 'v': x['porTicket']} for x in ordem[:2]]},
                    id_fixo='potencial-ticket')


def rfv_segmentos(ctx):
    S, tot, cli = ctx.get('segs'), ctx.get('total'), ctx.get('cli')
    if not S or not tot or not cli:
        return None
    fieis = [x for x in S if x['seg'] in ('Campeões', 'Fiéis')]
    risco = [x for x in S if x['seg'] in ('Em risco', 'Hibernando')]
    if not fieis and not risco:
        return None
    v_f, n_f = soma(x['v'] for x in fieis), soma(x['n'] for x in fieis)
    v_r, n_r = soma(x['v'] for x in risco), soma(x['n'] for x in risco)
    N = len(cli)
    if not n_f and not n_r:
        return None
    return destaque('rfvSegmentos', ctx, 'concentracao', v_f / tot + v_r / tot,
                    {'nF': n_f, 'vF': v_f, 'nR': n_r, 'vR': v_r, 'N': N, 'tot': tot,
                     'fMedia': (soma(x['f'] * x['n'] for x in fieis) / n_f) if fieis and n_f else 0,
                     'rMedia': (soma(x['r'] * x['n'] for x in risco) / n_r) if risco and n_r else 0},
                    tom='warn' if v_r > v_f else 'note',
                    labels=['Campeões', 'Fiéis', 'Em risco', 'Hibernando'], id_fixo='rfv-segmentos')


def rfv_tabela(ctx):
    cli, S, tot = ctx.get('cli'), ctx.get('segs'), ctx.get('total')
    if not cli or not tot:
        return None
    uma_vez = [x for x in cli if x['f'] <= 1]
    sh_uma = len(uma_vez) / len(cli)
    v_uma = soma(x['v'] for x in uma_vez) / tot
    repete = [x for x in cli if x['f'] > 1]
    if not repete:
        return None
    v_medio_uma = (soma(x['v'] for x in uma_vez) / len(uma_vez)) if uma_vez else 0
    v_medio_rep = soma(x['v'] for x in repete) / len(repete)
    return destaque('rfvTabela', dict(ctx, tabela=True), 'oculto', sh_uma,
                    {'shUma': sh_uma, 'vUma': v_uma, 'nUma': len(uma_vez), 'nRepete': len(repete),
                     'n': len(cli), 'vMedioUma': v_medio_uma, 'vMedioRep': v_medio_rep,
                     'segs': [{'seg': x['seg'], 'n': x['n'], 'v': x['v'], 'r': x['r'],
                               'rMin': x.get('rMin'), 'rMax': x.get('rMax')} for x in (S or [])]},
                    tom='warn' if sh_uma > .7 else 'note', id_fixo='rfv-recompra')


def rfv_risco(ctx):
    R2, tot = ctx.get('risco'), ctx.get('total')
    if not R2 or len(R2) < 3 or not tot:
        return None
    v = soma(x['v'] for x in R2)
    donos = {}
    for x in R2:
        if x.get('dono'):
            donos[x['dono']] = donos.get(x['dono'], 0) + x['v']
    rank = sorted(((d, donos[d]) for d in ordem_chaves_js(donos)), key=lambda x: -x[1])
    meses_med = soma(x['r'] for x in R2) / len(R2)
    return destaque('rfvRisco', dict(ctx, tabela=True), 'consequencia', v / tot * 3,
                    {'n': len(R2), 'v': v, 'mesesMed': meses_med, 'maior': R2[0]['v'],
                     'dono': rank[0][0] if rank else None, 'vDono': rank[0][1] if rank else 0,
                     'shDono': (rank[0][1] / v) if rank and v else 0},
                    tom='warn', id_fixo='rfv-risco')


def rfv_por_vendedor(ctx):
    D = ctx.get('donos')
    if not D or len(D) < 3:
        return None
    com = [dict(x, shCamp=(x['vcamp'] / x['v'] if x['v'] else 0)) for x in D]
    melhor = max(com, key=lambda x: x['shCamp'])
    pior = min(com, key=lambda x: x['shCamp'])
    if melhor['shCamp'] - pior['shCamp'] < .2:
        return None
    maior_venda = sorted(com, key=lambda x: -x['v'])[0]
    return destaque('rfvPorVendedor', dict(ctx, tabela=True), 'oculto', melhor['shCamp'] - pior['shCamp'],
                    {'melhor': melhor['d'], 'shMelhor': melhor['shCamp'], 'nMelhor': melhor['n'],
                     'recMelhor': melhor['rec'], 'pior': pior['d'], 'shPior': pior['shCamp'],
                     'nPior': pior['n'], 'recPior': pior['rec'], 'maiorVenda': maior_venda['d'],
                     'shMaiorVenda': maior_venda['shCamp'], 'amp': melhor['shCamp'] - pior['shCamp']},
                    labels=[melhor['d'], pior['d']], id_fixo='rfv-por-vendedor')

# -*- coding: utf-8 -*-
"""Regras da carteira — porte de R.carteiraMesesCobertura, R.carteiraTicketPorEspera,
R.carteiraAtrasoConcentrado, R.carteiraPicoEntrega e R.carteiraAdiadoTicket (insights.js)."""
from ..calculo.datas import ym_lab, ym_shift
from ..calculo.dre import dre_monthly
from ..calculo.numeros import soma
from .nucleo import argmax, destaque, media, ordenar


def _fat_12m(C):
    """Receita bruta mensal dos últimos 12 meses da DRE (base de comparação das duas regras)."""
    fim = C.maxym_dre
    linhas = dre_monthly(C.blob('DPNL'), 'CONSOLIDADO', ym_shift(fim, -11), fim, 'receita_bruta')
    return [x[1] for x in linhas if x[1] > 0]


def meses_cobertura(ctx):
    L, Cc, M = ctx.get('labels') or [], ctx.get('carteira') or [], ctx.get('meses') or []
    if len(L) < 5 or len(Cc) != len(L):
        return None
    i1 = len(Cc) - 1
    c0, c1, m0, m1 = Cc[0], Cc[i1], M[0], M[i1]
    if not c0 or not c1 or not m0 or not m1:
        return None
    d_c, d_m = c1 / c0 - 1, m1 / m0 - 1
    if abs(d_c - d_m) < .15:
        return None
    f0, f1 = c0 / m0, c1 / m1
    return destaque('carteiraMesesCobertura', ctx, 'oculto', abs(d_c - d_m),
                    {'dC': d_c, 'dM': d_m, 'm0': m0, 'm1': m1, 'c0': c0, 'c1': c1, 'f0': f0, 'f1': f1,
                     'dF': f1 / f0 - 1, 'piorou': d_m > d_c, 'lab0': L[0], 'lab1': L[i1]},
                    tom='warn' if d_m > d_c else 'ok', labels=[L[i1]], id_fixo='carteira-meses-cobertura')


def ticket_por_espera(ctx):
    A = [x for x in (ctx.get('aging') or []) if x[2] > 0 and x[1] > 0]
    if len(A) < 3:
        return None
    it = [{'nome': x[0], 'v': x[1], 'n': x[2], 'tk': x[1] / x[2]} for x in A]
    tot, n_tot = soma(x['v'] for x in it), soma(x['n'] for x in it)
    ord_ = sorted(it, key=lambda x: -x['tk'])
    caro, barato = ord_[0], ord_[-1]
    razao = caro['tk'] / barato['tk']
    if razao < 1.5:
        return None
    return destaque('carteiraTicketPorEspera', ctx, 'oculto', (razao - 1) / 3,
                    {'caro': caro['nome'], 'tkCaro': caro['tk'], 'nCaro': caro['n'], 'vCaro': caro['v'],
                     'barato': barato['nome'], 'tkBarato': barato['tk'], 'nBarato': barato['n'],
                     'vBarato': barato['v'], 'razao': razao, 'media': tot / n_tot, 'nTot': n_tot},
                    labels=[caro['nome'], barato['nome']], id_fixo='carteira-ticket-espera')


def atraso_concentrado(C, ctx=None):
    CD = C.blob('CARTDIN')
    if not CD or not CD.get('status_pedidos'):
        return None
    bucket = next((b for b in CD['status_pedidos'] if 'ATRAS' in str(b).upper()), None)
    if not bucket:
        return None
    peds = CD['status_pedidos'][bucket] or []
    if len(peds) < 2:
        return None
    tot = soma(p[2] for p in peds)
    if not tot:
        return None
    por_cli = {}
    for p in peds:
        c = p[1] or 'Não informado'
        por_cli[c] = por_cli.get(c, 0) + p[2]
    rank = sorted(por_cli.items(), key=lambda x: -x[1])
    sh = rank[0][1] / tot
    if sh < .35:
        return None
    return destaque('carteiraAtrasoConcentrado', ctx or {}, 'concentracao', sh,
                    {'sh': sh, 'cliente': rank[0][0], 'valor': rank[0][1], 'tot': tot,
                     'nCli': len(rank), 'sem': tot - rank[0][1]},
                    tom='warn', labels=[bucket], id_fixo='carteira-atraso-concentrado')


def pico_entrega(C, ctx=None):
    CD = C.blob('CARTDIN')
    if not CD or not CD.get('andamento_entrega') or not CD['andamento_entrega']['yms']:
        return None
    A = CD['andamento_entrega']
    i = argmax(A['valor'])
    pico = A['valor'][i]
    if not pico:
        return None
    fat = _fat_12m(C)
    if len(fat) < 6:
        return None
    med_fat, max_fat = media(fat), max(fat)
    razao = pico / med_fat
    if razao < 1.2:
        return None
    return destaque('carteiraPicoEntrega', ctx or {}, 'consequencia', (razao - 1) / 1.5,
                    {'pico': pico, 'lab': ym_lab(A['yms'][i]), 'razao': razao, 'medFat': med_fat,
                     'maxFat': max_fat, 'nFat': len(fat), 'total': soma(A['valor']),
                     'acima': pico - med_fat},
                    tom='warn', labels=[ym_lab(A['yms'][i])], id_fixo='carteira-pico-entrega')


def adiado_ticket(C, ctx=None):
    CD = C.blob('CARTDIN')
    if not CD or not CD.get('status_pedidos'):
        return None
    bucket = next((b for b in CD['status_pedidos'] if 'ADIA' in str(b).upper()), None)
    if not bucket:
        return None
    peds = CD['status_pedidos'][bucket] or []
    if len(peds) < 5:
        return None
    val_ad, it_ad = soma(p[2] for p in peds), soma(p[3] or 0 for p in peds)
    if not it_ad:
        return None
    todos = [p for b in CD['status_pedidos'] for p in CD['status_pedidos'][b]]
    val_tot, it_tot = soma(p[2] for p in todos), soma(p[3] or 0 for p in todos)
    if not it_tot:
        return None
    t_ad, t_geral = val_ad / it_ad, val_tot / it_tot
    d = t_ad / t_geral - 1
    if abs(d) < .18:
        return None
    fat = _fat_12m(C)
    med_fat = media(fat) if fat else 0
    return destaque('carteiraAdiadoTicket', ctx or {}, 'decomposicao', abs(d) * 2.5,
                    {'tAd': t_ad, 'tGeral': t_geral, 'd': d, 'valAd': val_ad, 'itAd': it_ad,
                     'shValor': val_ad / val_tot if val_tot else 0,
                     'meses': val_ad / med_fat if med_fat else None},
                    id_fixo='carteira-adiado-ticket')


__all__ = ['meses_cobertura', 'ticket_por_espera', 'atraso_concentrado', 'pico_entrega', 'adiado_ticket',
           'ordenar']

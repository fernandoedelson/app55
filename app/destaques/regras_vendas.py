# -*- coding: utf-8 -*-
"""Regras de destaque das seções comerciais — porte de R.vendasPartesRelacionadas,
R.vendasEfeitoPrecoVolume, R.vendaVsFaturamento, R.vendasPrecoVolume e R.mesVsAnterior (insights.js)."""
import math

from ..calculo.numeros import soma
from .nucleo import argmax, argmin, clamp, destaque, media, posicao_na_serie
from .series import pedidos_do_mes, serie_vendas, serie_vendas_pr


def partes_relacionadas(C, ctx=None):
    S = serie_vendas(C, 12)
    if not S:
        return None
    P = serie_vendas_pr(C, S['yms'])
    if not P:
        return None
    total, total_pr = soma(S['val']), soma(P['pr'])
    if not total_pr or total_pr / total < .04:
        return None
    ex = [v - P['pr'][i] for i, v in enumerate(S['val'])]
    i_pior_com, i_pior_ex, i_maior_pr = argmin(S['val']), argmin(ex), argmax(P['pr'])
    mudou = i_pior_com != i_pior_ex
    conc = soma(sorted(P['pr'], reverse=True)[:3]) / total_pr
    if not mudou and conc < .8:
        return None
    labels = [S['labels'][i_pior_ex], S['labels'][i_maior_pr]] if mudou else [S['labels'][i_maior_pr]]
    return destaque('vendasPartesRelacionadas', ctx or {}, 'oculto', (.6 if mudou else .3) + conc * .4,
                    {'totalPR': total_pr, 'total': total, 'conc': conc, 'mudou': mudou,
                     'labMaiorPR': S['labels'][i_maior_pr], 'maiorPR': P['pr'][i_maior_pr],
                     'labPiorCom': S['labels'][i_pior_com], 'labPiorEx': S['labels'][i_pior_ex],
                     'piorEx': ex[i_pior_ex], 'semGrupo': total - total_pr},
                    tom='warn', labels=labels, id_fixo='vendas-partes-relacionadas')


def efeito_preco_volume(C, ctx=None):
    S = serie_vendas(C, 36)
    if not S or len(S['yms']) < 24:
        return None
    fim = C.maxym_vendas
    ano, mes = fim // 100, fim % 100
    idx = {y: i for i, y in enumerate(S['yms'])}
    cur, pre = [], []
    for m in range(1, mes + 1):
        a, b = idx.get(ano * 100 + m), idx.get((ano - 1) * 100 + m)
        if a is not None and b is not None:
            cur.append(a)
            pre.append(b)
    if len(cur) < 3:
        return None
    V1, Q1 = soma(S['val'][i] for i in cur), soma(S['qnt'][i] for i in cur)
    V0, Q0 = soma(S['val'][i] for i in pre), soma(S['qnt'][i] for i in pre)
    if not Q0 or not Q1 or not V0:
        return None
    P1, P0 = V1 / Q1, V0 / Q0
    ef_p, ef_q, d_tot = (P1 - P0) * Q1, (Q1 - Q0) * P0, V1 - V0
    if not d_tot:
        return None
    menor, maior = min(abs(ef_p), abs(ef_q)), max(abs(ef_p), abs(ef_q))
    if (ef_p > 0) == (ef_q > 0) or menor < abs(d_tot) * .35:
        return None
    pecas_falta = abs(d_tot) / P1 if P1 else 0
    return destaque('vendasEfeitoPrecoVolume', ctx or {}, 'decomposicao', menor / maior,
                    {'dTot': d_tot, 'ano': ano, 'P0': P0, 'P1': P1, 'Q0': Q0, 'Q1': Q1,
                     'efP': ef_p, 'efQ': ef_q, 'pecasFalta': pecas_falta, 'meses': len(cur),
                     'porMes': math.ceil(pecas_falta / len(cur)), 'menor': menor, 'maior': maior},
                    tom='warn' if d_tot < 0 else 'ok', id_fixo='vendas-efeito-preco-volume')


def venda_vs_faturamento(C, ctx):
    V = ctx.get('vendaAnual') or {}
    DRE = C.blob('DRE') or {}
    if not V or not DRE:
        return None
    ano_atual = C.maxym_vendas // 100
    anos = sorted(y for y in V
                  if y < ano_atual and DRE.get(str(y)) and (DRE[str(y)].get('annual') or 0) > 0 and V[y] > 0)
    if len(anos) < 3:
        return None
    linhas = [{'y': y, 'venda': V[y], 'fat': DRE[str(y)]['annual'], 'dif': V[y] - DRE[str(y)]['annual']} for y in anos]
    acum = soma(l['dif'] for l in linhas)
    relevantes = [l for l in linhas if abs(l['dif']) / l['venda'] >= .12]
    if not relevantes:
        return None
    maior, ultima = relevantes[-1], linhas[-1]
    return destaque('vendaVsFaturamento', dict(ctx, tabela=True), 'divergencia',
                    abs(maior['dif']) / maior['venda'] * 2.5,
                    {'ano': maior['y'], 'dif': maior['dif'], 'venda': maior['venda'], 'fat': maior['fat'],
                     'pct': abs(maior['dif']) / maior['venda'], 'acum': acum, 'ini': anos[0], 'ult': anos[-1],
                     'ultAno': ultima['y'], 'ultVenda': ultima['venda']},
                    id_fixo='venda-vs-faturamento')


def preco_volume_mensal(C, ctx):
    """R.vendasPrecoVolume: o mês veio de menos peças, a um preço bem maior."""
    S = serie_vendas(C, 12, ctx.get('fim'))
    if not S or len(S['yms']) < 8:
        return None
    # com mês de referência a leitura é DAQUELE mês; sem ele, varre os três últimos
    inicio = len(S['yms']) - 1 if ctx.get('fim') else len(S['yms']) - 3
    melhor = None
    for i in range(max(0, inicio), len(S['yms'])):
        d = posicao_na_serie(S['pm'], i) - posicao_na_serie(S['qnt'], i)
        if d < .7:
            continue
        if melhor is None or d > melhor[1]:
            melhor = (i, d)
    if melhor is None:
        return None
    i, d = melhor
    pm_med, q_med, v_med = media(S['pm']), media(S['qnt']), media(S['val'])
    d_pm = S['pm'][i] / pm_med - 1
    d_q = 1 - S['qnt'][i] / q_med
    d_v = S['val'][i] / v_med - 1
    P = pedidos_do_mes(C, S['yms'][i])
    return destaque('vendasPrecoVolume', ctx, 'decomposicao', d,
                    {'lab': S['labels'][i], 'qnt': S['qnt'][i], 'pm': S['pm'][i], 'val': S['val'][i],
                     'dQ': d_q, 'dPm': d_pm, 'dV': d_v, 'qMed': q_med, 'pmMed': pm_med, 'n': len(S['yms']),
                     'peds': (P or {}).get('n'), 'metade': (P or {}).get('metade'),
                     'shMaior': (P['maior'] / P['total']) if P and P['total'] else None},
                    tom='warn' if d_v < 0 else 'note', labels=[S['labels'][i]],
                    id_fixo='vendas-preco-volume')


def mes_vs_anterior(C, ctx):
    """R.mesVsAnterior: preço e quantidade brigando entre o mês e o anterior."""
    fim = ctx.get('fim')
    if not fim:
        return None
    S = serie_vendas(C, 14, fim)
    if not S or len(S['yms']) < 2:
        return None
    i = len(S['yms']) - 1
    j = i - 1
    if not S['val'][j] or not S['qnt'][j] or not S['qnt'][i]:
        return None
    V1, V0, Q1, Q0 = S['val'][i], S['val'][j], S['qnt'][i], S['qnt'][j]
    P1, P0 = V1 / Q1, V0 / Q0
    ef_p, ef_q, d_tot = (P1 - P0) * Q1, (Q1 - Q0) * P0, V1 - V0
    if not d_tot:
        return None
    opostos = (ef_p > 0) != (ef_q > 0)
    menor, maior = min(abs(ef_p), abs(ef_q)), max(abs(ef_p), abs(ef_q))
    if not opostos or menor < abs(d_tot) * .5:
        return None
    return destaque('mesVsAnterior', ctx, 'decomposicao', menor / maior,
                    {'lab': S['labels'][i], 'labAnt': S['labels'][j], 'dTot': d_tot,
                     'Q0': Q0, 'Q1': Q1, 'P0': P0, 'P1': P1, 'efP': ef_p, 'efQ': ef_q,
                     'dominante': 'a quantidade' if abs(ef_q) > abs(ef_p) else 'o preço',
                     'pmMed': media(S['pm'][:-1]), 'razao': menor / maior},
                    tom='warn' if d_tot < 0 else 'ok', labels=[S['labels'][i], S['labels'][j]],
                    id_fixo='mes-vs-anterior')

# -*- coding: utf-8 -*-
"""Regras da Performance Comercial (meta × realizado) — porte de R.metaRitmo, R.metaDispersao e
R.projecaoDistancia do insights.js. `M` é o retorno de metas_calc()."""
import math

from ..calculo.datas import MES, ym_lab
from ..calculo.numeros import soma
from .nucleo import argmax, argmin, destaque
from .series import serie_vendas


def meta_ritmo(C, ctx):
    M = ctx.get('metas')
    if not M or not M['restantes']:
        return None
    S = serie_vendas(C, 24)
    if not S:
        return None
    necessario = (M['metaAno'] - M['realAteAgora']) / M['restantes']
    max_real = max(S['val'])
    i_max = argmax(S['val'])
    media = M['realAteAgora'] / (M['iUlt'] + 1)
    quantos = len([v for v in S['val'] if v >= necessario])
    if necessario <= max_real and quantos >= math.ceil(len(S['val']) * .25):
        return None
    projetado = M['realAteAgora'] + media * M['restantes']
    return destaque('metaRitmo', ctx, 'consequencia', necessario / max(media, 1) - 1,
                    {'falta': M['metaAno'] - M['realAteAgora'], 'restantes': M['restantes'],
                     'necessario': necessario, 'media': media, 'quantos': quantos, 'n': len(S['yms']),
                     'labMax': S['labels'][i_max], 'maxReal': max_real, 'nunca': necessario > max_real,
                     'ano': M['ano'], 'projetado': projetado, 'abaixo': M['metaAno'] - projetado},
                    tom='warn', id_fixo='meta-ritmo')


def meta_dispersao(C, ctx):
    M = ctx.get('metas')
    if not M:
        return None
    n = M['iUlt'] + 1
    if n < 4:
        return None
    at = []
    for i in range(n):
        if not M['meta'][i]:
            return None
        at.append(M['realizado'][i] / M['meta'][i])
    i_bom, i_ruim = argmax(at), argmin(at)
    amp = at[i_bom] - at[i_ruim]
    if amp < .15:
        return None
    meta_per, real_per = soma(M['meta'][:n]), soma(M['realizado'][:n])
    gap = meta_per - real_per
    return destaque('metaDispersao', dict(ctx, tabela=True), 'padrao', amp * 1.6,
                    {'atBom': at[i_bom], 'atRuim': at[i_ruim], 'labBom': ym_lab(M['yms'][i_bom]),
                     'labRuim': ym_lab(M['yms'][i_ruim]), 'realBom': M['realizado'][i_bom],
                     'metaBom': M['meta'][i_bom], 'atrasoRuim': M['meta'][i_ruim] - M['realizado'][i_ruim],
                     'n': n, 'gap': gap, 'gapSeBom': meta_per * (1 - at[i_bom]), 'amp': amp},
                    tom='warn', id_fixo='meta-dispersao')


def projecao_distancia(C, ctx):
    M = ctx.get('metas')
    if not M or M.get('totProjHist') is None or not M.get('metaAno'):
        return None
    falta = M['metaAno'] - M['totProjHist']
    sh = falta / M['metaAno']
    if abs(sh) < .03:
        return None
    labels = [MES[M['idxRest'][-1]]] if M.get('idxRest') else None
    return destaque('projecaoDistancia', ctx, 'divergencia', abs(sh) * 2.2,
                    {'projHist': M['totProjHist'], 'falta': falta, 'metaAno': M['metaAno'],
                     'abaixo': falta > 0, 'frac': M['frac'], 'restantes': M['restantes'],
                     'porMes': falta / M['restantes'] if M['restantes'] else 0,
                     'cagr': M.get('totProjCagr'), 'sh': sh},
                    tom='warn' if falta > 0 else 'ok', labels=labels, id_fixo='projecao-distancia')

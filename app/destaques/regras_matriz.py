# -*- coding: utf-8 -*-
"""Regras que leem uma matriz (mapa de calor) — porte de R.mixCruzado e R.composicaoDeslocou."""
from ..calculo.numeros import soma
from .nucleo import destaque


def mix_cruzado(ctx):
    """Perfil dos DOIS MAIORES (não do mais destoante): por onde cada um chegou ao topo."""
    L, Cs, M = ctx.get('linhas') or [], ctx.get('colunas') or [], ctx.get('mat') or {}
    if len(L) < 3 or len(Cs) < 3:
        return None
    val = lambda l, c: ((M.get(l) or {}).get(c) or 0)
    tot_col = {c: soma(val(l, c) for l in L) for c in Cs}
    tot_geral = soma(tot_col[c] for c in Cs)
    if not tot_geral:
        return None
    mix_casa = {c: tot_col[c] / tot_geral for c in Cs}
    perfis = []
    for l in L:
        tl = soma(val(l, c) for c in Cs)
        if not tl:
            continue
        dist, forte, forte_d, fraco, fraco_d = 0, None, 0, None, 0
        for c in Cs:
            sh = val(l, c) / tl
            d = sh - mix_casa[c]
            dist += abs(d)
            if d > forte_d:
                forte_d, forte = d, c
            if d < fraco_d:
                fraco_d, fraco = d, c
        perfis.append({'nome': l, 'tl': tl, 'peso': tl / tot_geral, 'dist': dist / 2, 'forte': forte,
                       'forteD': forte_d, 'fraco': fraco, 'fracoD': fraco_d,
                       'shForte': val(l, forte) / tl if forte else 0})
    perfis.sort(key=lambda p: -p['tl'])
    if len(perfis) < 2:
        return None
    p1, p2 = perfis[0], perfis[1]
    if not p1['forte'] or not p2['forte']:
        return None
    mesma = p1['forte'] == p2['forte']
    if p1['forteD'] < .04 and p2['forteD'] < .04:
        return None
    juntos = p1['peso'] + p2['peso']
    return destaque('mixCruzado', ctx, 'oculto', juntos * .6 + max(p1['forteD'], p2['forteD']) * 2,
                    {'mesma': mesma, 'juntos': juntos,
                     'nome1': p1['nome'], 'forte1': p1['forte'], 'sh1': p1['shForte'], 'tl1': p1['tl'],
                     'casa1': mix_casa[p1['forte']],
                     'nome2': p2['nome'], 'forte2': p2['forte'], 'tl2': p2['tl'],
                     'sh2': val(p2['nome'], p2['forte']) / p2['tl'], 'casa2': mix_casa[p2['forte']],
                     'shForte2Mesma': p2['shForte'],
                     'fraco1': p1['fraco'], 'shFraco1': val(p1['nome'], p1['fraco']) / p1['tl'] if p1['fraco'] else 0,
                     'casaFraco1': mix_casa[p1['fraco']] if p1['fraco'] else 0},
                    labels=[p1['nome'], p2['nome']], prefixo='mix-cruzado')

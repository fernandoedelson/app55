# -*- coding: utf-8 -*-
"""Helpers das regras de destaque — porte do topo do insights.js.

Como no cálculo das seções, a soma segue a ordem das listas (fold simples) e a ordenação por valor
é estável: empate decide posição em ranking, e posição muda o texto do destaque."""
from ..calculo.numeros import soma


def clamp(v, a, b):
    return max(a, min(b, v))


def media(a):
    return soma(a) / len(a) if a else 0


def argmax(a):
    i = 0
    for k, v in enumerate(a):
        if v > a[i]:
            i = k
    return i


def argmin(a):
    i = 0
    for k, v in enumerate(a):
        if v < a[i]:
            i = k
    return i


def posicao_na_serie(arr, i):
    v, n = arr[i], len(arr)
    if n < 2:
        return .5
    return len([x for x in arr if x < v]) / (n - 1)


def quantos_para(vals, fatia):
    """Quantos itens de um ranking somam uma fatia do total."""
    tot = soma(vals)
    if not tot:
        return 0
    acc = k = 0
    for v in vals:
        acc += v
        k += 1
        if acc >= tot * fatia:
            break
    return k


def nucleo_material(itens, campo='v', fatia=.8, minimo=3):
    """O subconjunto que sustenta `fatia` do valor, com um mínimo de itens: é o que impede o
    destaque de apontar para a cauda (regra editorial 4 do insights.js)."""
    ord_ = sorted((x for x in itens if x and (x.get(campo) or 0) > 0), key=lambda x: -x[campo])
    if not ord_:
        return ord_
    k = quantos_para([x[campo] for x in ord_], fatia)
    return ord_[:max(k, minimo)]


def ordenar(itens, campo='v'):
    return sorted(itens, key=lambda x: -(x.get(campo) or 0))


def destaque(regra, ctx, fam, score, dados, tom='note', labels=None, leitura=None, prefixo=None, id_fixo=None):
    """Monta o destaque no formato que vai ao navegador: números e decisão aqui, frase no JS.

    `id_fixo` reproduz as regras do Kit cujo id não depende do contexto (uma por relatório)."""
    o = {'id': id_fixo or ((prefixo or regra) + '-' + (ctx.get('id') or 'geral')), 'regra': regra, 'fam': fam,
         'tom': tom, 'score': round(clamp(score, 0, 1), 3), 'tabela': bool(ctx.get('tabela')), 'd': dados}
    if labels:
        o['anchor'] = {'labels': [l for l in labels if l]}
    if leitura:
        o['leitura'] = leitura
    return o

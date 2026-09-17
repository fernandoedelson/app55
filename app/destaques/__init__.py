# -*- coding: utf-8 -*-
"""Camada de destaques (análise de 2º grau) — porte das regras do insights.js.

Um destaque nasce de um bloco e pode LER outros: a regra declara todos, e ela só vai para o perfil
que enxerga todos eles (decisão da especificação). O texto é montado no navegador; daqui saem a
decisão de disparar, o score, a âncora e os números.

    destaques.para_secao(C, 'ytd', params, pode_ver) -> {bloco: {slot: destaque}}
"""
from .secoes import carteira, evolutiva, mensal, performance, periodo, ytd

# seção -> função(C, params) -> [(bloco, blocos_lidos, destaque)]
REGISTRO = {
    'evolutiva': evolutiva.montar,
    'ytd': ytd.montar,
    'mensal': mensal.montar,
    'periodo': periodo.montar,
    'performance': performance.montar,
    'carteira': carteira.montar,
    'carteira_dinamica': carteira.montar_dinamica,
}


def _overrides(C):
    return C.blob('DESTAQUES_MANUAIS') or {}


def para_secao(C, secao, params=None, pode_ver=None):
    """Destaques da seção, por bloco, já filtrados pelo que o perfil pode ver."""
    montar = REGISTRO.get(secao)
    if montar is None:
        return {}
    pode = pode_ver or (lambda _b: True)
    manuais = _overrides(C)
    saida = {}
    for bloco, lidos, o in montar(C, params or {}):
        if not o:
            continue
        # a regra some inteira se o perfil não vê algum bloco que ela lê
        if not pode(bloco) or not all(pode(b) for b in (lidos or [])):
            continue
        m = manuais.get(o['id'])
        if m:
            if m.get('oculto'):
                continue
            editado = {k: m[k] for k in ('verdict', 'texto') if m.get(k)}
            if editado:
                o = dict(o, editado=editado)
        saida.setdefault(bloco, {})[o['id']] = o
    return saida

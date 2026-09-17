# -*- coding: utf-8 -*-
"""Cálculo no servidor: cada seção devolve {id_do_bloco: payload}.

As seções entram aqui à medida que são portadas e conferidas contra o gabarito (fase 3)."""
from .secoes import evolutiva, resumo, ytd

SECOES_PORTADAS = {
    'resumo': resumo.calcular,
    'evolutiva': evolutiva.calcular,
    'ytd': ytd.calcular,
}


def payloads_da_secao(C, secao, pode_ver, params=None):
    """Calcula a seção e devolve só os blocos que o perfil pode ver."""
    calc = SECOES_PORTADAS.get(secao)
    if calc is None:
        return None
    return {bid: p for bid, p in calc(C, params or {}).items() if pode_ver(bid)}

# -*- coding: utf-8 -*-
"""Cálculo no servidor: cada seção devolve {id_do_bloco: payload}.

As seções entram aqui à medida que são portadas e conferidas contra o gabarito (fase 3)."""
from .secoes import analise_vendas, arquitetos, carteira, custofixo, divida, dre, estudos, evolutiva, mensal, performance, periodo, resumo, ytd

SECOES_PORTADAS = {
    'resumo': resumo.calcular,
    'evolutiva': evolutiva.calcular,
    'ytd': ytd.calcular,
    'mensal': mensal.calcular,
    'performance': performance.calcular,
    'carteira': carteira.calcular_carteira,
    'carteira_dinamica': carteira.calcular_dinamica,
    'custofixo': custofixo.calcular,
    'custofixo_mensal': custofixo.calcular_mensal,
    'divida': divida.calcular,
    'dre': dre.calcular,
    'periodo': periodo.calcular,
    'vendas': analise_vendas.calcular,
    'arquitetos': arquitetos.calcular,
    'estudos': estudos.calcular,
}

# detalhamentos: (seção, nome) -> (bloco exigido, função). Exigem também o recurso 'detalhar'.
DETALHES = {
    ('mensal', 'itens'): ('mn-cli', mensal.itens_do_cliente),
    ('carteira_dinamica', 'pedido'): ('cd-status', carteira.itens_do_pedido),
    ('custofixo_mensal', 'composicao'): ('cfm-pacotes', custofixo.composicao_do_pacote),
    ('vendas', 'segmento'): ('av-rfv', analise_vendas.clientes_do_segmento),
    ('arquitetos', 'vendedor'): ('aq-quantos', arquitetos.arquitetos_do_vendedor),
    ('arquitetos', 'segmento'): ('aq-rfv', arquitetos.arquitetos_do_segmento),
}


def payloads_da_secao(C, secao, pode_ver, params=None):
    """Calcula a seção e devolve só os blocos que o perfil pode ver."""
    calc = SECOES_PORTADAS.get(secao)
    if calc is None:
        return None
    return {bid: p for bid, p in calc(C, params or {}).items() if pode_ver(bid)}

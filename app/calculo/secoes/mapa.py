# -*- coding: utf-8 -*-
"""Mapa de vendas — a receita bruta por UF do cliente (aba MPP DB do Painel), com filtro de período no navegador.

O servidor manda as linhas do blob MAPAVENDAS como estão (pedido, cliente, produto, peças, receita bruta por mês e UF); o recorte
de período, a soma por UF e a abertura dos pedidos são feitos no navegador. A etiqueta PR (parte relacionada) no nome do cliente usa
os mesmos padrões da Carteira."""
from .carteira import _partes_relacionadas


def calcular(C, params=None):
    M = C.blob('MAPAVENDAS')
    if not M or not M.get('rows'):
        ausente = {'ausente': True}
        return {'mapa.abertura': ausente, 'mapa-uf': ausente}
    return {'mapa.abertura': {'fonte': M['fonte'], 'ate': M['ate'], 'n': len(M['rows'])},
            'mapa-uf': {'rows': M['rows'], 'ate': M['ate'], 'fonte': M['fonte'], 'pr_padroes': _partes_relacionadas(C),
                        'arq': C.blob('ARQUITETOS_MAPA')}}

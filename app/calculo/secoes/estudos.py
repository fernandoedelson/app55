# -*- coding: utf-8 -*-
"""Estudos e Análises — Intercompany pela tabela de preço (Estudo_Intercompany_Modelo_A).

O DRE do Modelo A (aba 12 do Modelo gerencial Fábrica × Loja, blob FABLOJA) refeito com a receita de transferência interna
trocada pelo valor apurado na tabela de preço (blob INTERCOMPANY, do Analise_Intercompany_<ano>.xlsx). O cálculo e o desenho
são os do Kit (icCalcula/icHtmlResumo/icHtmlDre): o servidor manda os dois blobs, no recorte do ano do estudo."""


def _fl_do_ano(F, ano):
    """Só as linhas do ano do estudo, de cada unidade — o resto do Modelo não entra no navegador."""
    return {'markup': F.get('markup'), 'apurado': F.get('apurado'),
            'blocos': [{'chave': b['chave'], 'anos': {ano: (b.get('anos') or {}).get(ano) or b.get('linhas') or []}}
                       for b in F.get('blocos') or []]}


def calcular(C, params=None):
    I, F = C.blob('INTERCOMPANY'), C.blob('FABLOJA')
    if I and F:
        dados = {'I': I, 'F': _fl_do_ano(F, str(I['ano']))}
    else:
        dados = {'ausente': True, 'sem_estudo': not I, 'sem_modelo': not F}
    return {'estudos.abertura': dados, 'est-ic-resumo': dados, 'est-dre': dados}

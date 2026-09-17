# -*- coding: utf-8 -*-
"""Catálogo: o que existe no relatório e o que pode ser liberado a um perfil.

Permissões são textos (tabela perfil_permissoes), sempre explícitos — nunca curinga por seção:
    bloco:<id>              vê o bloco
    recurso:<id>            capacidade transversal (detalhar, exportar, nomes_pf, ...)
    base:upload:<id>        pode subir aquela base
    admin                   acesso total + telas de administração

"Liberar a seção inteira" na tela grava um bloco:<id> para cada bloco que existe HOJE. Um bloco
criado depois nasce negado para todos até alguém liberar (decisão da especificação).
"""
from .dados import SECOES, BLOCOS

SECAO = {s['id']: s for s in SECOES}
BLOCO = {b['id']: b for b in BLOCOS}

RECURSOS = [
    ('destaques', 'Destaques', 'As análises automáticas abaixo dos gráficos'),
    ('detalhar', 'Detalhar até o cliente', 'Clicar num gráfico ou tabela e abrir os itens'),
    ('exportar', 'Exportar', 'Baixar a apresentação e tabelas'),
    ('filtro_livre', 'Filtro livre de período', 'Escolher qualquer intervalo de meses'),
    ('apresentar', 'Modo Apresentar', 'Tela cheia com navegação por atos'),
    ('nomes_pf', 'Ver nomes de pessoa física', 'Sem este recurso os nomes aparecem mascarados'),
    ('fechamento', 'Fechar o mês', 'Subir as bases, processar, ver o que mudou e publicar'),
    ('comentar', 'Comentar pela área', 'Escrever o comentário da área nos blocos que ela enxerga'),
    ('consolidar', 'Enviar o comentário da área', 'Responsável: consolida o texto e envia à Controladoria'),
    ('curar_comentarios', 'Curar os comentários', 'Pedir, aprovar, ajustar ou recusar e escolher o que vai à apresentação'),
]
RECURSO = {r[0]: r for r in RECURSOS}

# bases que podem ser enviadas — os ids são os mesmos de app/importacao/motor.py (quem lê as planilhas)
BASES_UPLOAD = [
    ('comercial', 'Controle ADM de Vendas (base comercial)'),
    ('painel', 'Painel Resultado (DRE e razão do custo fixo)'),
    ('custos', 'Custos (pasta com as 5 planilhas)'),
    ('carteira', 'VENDAS LOJA (carteira dinâmica)'),
    ('metas', 'Metas de vendas do ano'),
    ('aportes', 'Aportes (dívida com o acionista)'),
    ('apelidos', 'Apelidos (de-para de nomes)'),
    ('designers', 'Designers'),
    ('fabloja', 'Modelo gerencial Fábrica × Loja'),
]
BASE_UPLOAD = dict(BASES_UPLOAD)

PERMISSAO_ADMIN = 'admin'


def blocos_da_secao(sid):
    return [b for b in BLOCOS if b['secao'] == sid]


def todas_permissoes_validas():
    out = {PERMISSAO_ADMIN}
    out |= {'bloco:' + b['id'] for b in BLOCOS}
    out |= {'recurso:' + r[0] for r in RECURSOS}
    out |= {'base:upload:' + b[0] for b in BASES_UPLOAD}
    return out


def limpar_permissoes(textos):
    """Descarta o que não existe no catálogo (a tela nunca grava permissão inventada)."""
    validas = todas_permissoes_validas()
    return sorted({t for t in (textos or []) if t in validas})


def fechar_dependencias(textos):
    """Liberar um bloco libera também os blocos de que ele depende (decisão: libera junto).

    Devolve (conjunto final, {bloco_pedido: [dependências acrescentadas]}) — o segundo item é o
    que a tela mostra antes de salvar."""
    final = set(textos)
    acrescidos = {}
    fila = [t[6:] for t in textos if t.startswith('bloco:')]
    while fila:
        bid = fila.pop()
        for dep in BLOCO.get(bid, {}).get('depende_de', []):
            chave = 'bloco:' + dep
            if chave not in final:
                final.add(chave)
                acrescidos.setdefault(bid, []).append(dep)
                fila.append(dep)
    return final, acrescidos

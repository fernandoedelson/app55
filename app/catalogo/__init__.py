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
    # o mascaramento ainda não existe: a descrição diz isso, para ninguém liberar/negar achando que protege
    ('nomes_pf', 'Ver nomes de pessoa física', 'Ainda não aplicado: hoje todo perfil que vê o bloco vê os nomes'),
    ('fechamento', 'Fechar o mês', 'Subir as bases, processar, ver o que mudou e publicar'),
    ('comentar', 'Comentar pela área', 'Escrever o comentário da área nos blocos que ela enxerga'),
    ('consolidar', 'Enviar o comentário da área', 'Responsável: consolida o texto e envia à Controladoria'),
    ('curar_comentarios', 'Curar os comentários', 'Pedir, aprovar, ajustar ou recusar e escolher o que vai à apresentação'),
    ('pilotar', 'Pilotar a apresentação', 'Montar os atos da reunião (o que entra, a ordem, os textos, qual ato existe) e gerar'),
]
RECURSO = {r[0]: r for r in RECURSOS}

# como a tela de perfil apresenta os recursos: pelo que eles liberam, não em lista corrida
GRUPOS_RECURSO = [
    ('Leitura do relatório', ['destaques', 'detalhar', 'filtro_livre', 'nomes_pf', 'exportar']),
    ('Reunião do mês', ['apresentar', 'pilotar']),
    ('Comentário da área', ['comentar', 'consolidar', 'curar_comentarios']),
    ('Fechamento do mês', ['fechamento']),
]

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

# o que cada seção responde — é o que o leitor precisa saber para escolher onde clicar
PERGUNTA_SECAO = {
    'resumo': 'O mês numa página: o histórico, o ano até agora e a leitura executiva.',
    'evolutiva': 'Quanto se vendeu e quanto se faturou, ano a ano, desde o início da série.',
    'ytd': 'O ano até o último mês fechado contra o mesmo período do ano passado.',
    'mensal': 'O mês escolhido: os 12 meses até ele, as vendedoras, as categorias e os maiores clientes.',
    'periodo': 'Qualquer intervalo de meses: carteira, vendedores, categorias, clientes, designers e arquitetos.',
    'performance': 'A venda realizada contra o orçamento, no acumulado e mês a mês.',
    'vendas': 'O time de vendas: quem lidera, de onde vem a diferença e a carteira de clientes.',
    'arquitetos': 'O canal de arquitetos: quanto cada vendedor depende dele e quem trabalha com quem.',
    'carteira': 'O que já foi vendido e ainda não foi entregue, por status, vendedor e pedido.',
    'carteira_dinamica': 'A carteira em movimento: evolução, pedidos adiados e previsão de faturamento.',
    'dre': 'O resultado de Consolidado, Fábrica e Loja: margens, ponte do resultado e ponto de equilíbrio.',
    'custofixo': 'O custo fixo dos últimos 12 meses, por categoria e por entidade.',
    'custofixo_mensal': 'O custo fixo do mês, aberto em pacotes, terceiros e contas.',
    'divida': 'A dívida com o acionista: saldo, juros e o endividamento gerado mês a mês.',
    'custosx': 'O custo dos produtos vendidos: onde se concentra, o que o move e o que pesa na matéria-prima.',
    'custos': 'O custo de produção da fábrica, linha a linha: produtos, volumes e custos operacionais.',
    'estudos': 'Estudos fora do fechamento recorrente, como o resultado por unidade.',
}


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

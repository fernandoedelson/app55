# -*- coding: utf-8 -*-
"""O roteiro da reunião — os seis atos e os anexos, na ordem em que o mês é apresentado.

É a mesma estrutura do `atos.js` do Kit congelado (ato = pergunta + blocos que a respondem,
anexo = o que não entrou na leitura corrida). Aqui ela vive em Python porque o servidor precisa
saber, ANTES de desenhar, quais seções e blocos cada ato pede — para mandar só o que o perfil
enxerga e para dizer "conteúdo restrito" no ato que ficou vazio.

Mudar o roteiro é commit, como o catálogo: a apresentação é a mesma para todo mundo; o que muda
de pessoa para pessoa é o que ela pode ver dentro dele.
"""
from .. import catalogo as C

# item: {'sec': seção de origem, 'blk': bloco, 'abre': abertura da seção, 'filtro': a barra de
# filtro da seção, 'sub': subtítulo dentro do ato (não é conteúdo)}
ATOS = [
    {'n': 1, 't': 'De onde viemos', 'q': 'A empresa está crescendo, e para onde vai se nada mudar?',
     'min': '5 min', 'itens': [
         {'sec': 'evolutiva', 'abre': True, 'semHead': True},
         {'sec': 'evolutiva', 'blk': 'ev-anual'},
         {'sec': 'performance', 'blk': 'perf-acum'},
         {'sec': 'performance', 'blk': 'perf-mes'}]},
    {'n': 2, 't': 'O que já está vendido', 'q': 'Quanto do faturamento dos próximos meses já está contratado?',
     'min': '7 min', 'itens': [
         {'sec': 'periodo', 'blk': 'pe-cart'},
         {'sec': 'carteira_dinamica', 'blk': 'cd-status'},
         {'sec': 'carteira_dinamica', 'blk': 'cd-evol'},
         {'sec': 'carteira_dinamica', 'blk': 'cd-previsao'},
         {'sec': 'carteira_dinamica', 'blk': 'cd-adiados'}]},
    {'n': 3, 't': 'O mês', 'q': 'Quanto se vendeu, e de quê?', 'min': '4 min', 'itens': [
        {'sec': 'mensal', 'filtro': True},
        {'sec': 'mensal', 'blk': 'mn-evol'},
        {'sec': 'mensal', 'blk': 'mn-cat'},
        {'sec': 'ytd', 'blk': 'ytd-kpi'},
        {'sec': 'ytd', 'blk': 'ytd-linha'},
        {'sec': 'ytd', 'blk': 'ytd-ind'}]},
    {'n': 4, 't': 'Por que vendemos o que vendemos',
     'q': 'O que separa um vendedor do outro, e o que sustenta os dois?', 'min': '14 min', 'itens': [
         {'sub': 'Primeiro, o time'},
         {'sec': 'ytd', 'blk': 'ytd-vendedor'},
         {'sec': 'vendas', 'filtro': True},
         {'sec': 'vendas', 'blk': 'av-lider'},
         {'sec': 'vendas', 'blk': 'av-diferenca'},
         {'sub': 'Depois, o canal, que explica a diferença', 'nota': 'CANAL_SHARE'},
         {'sec': 'arquitetos', 'filtro': True},
         {'sec': 'arquitetos', 'blk': 'aq-dependencia'},
         {'sec': 'arquitetos', 'blk': 'aq-quantos'},
         {'sec': 'arquitetos', 'blk': 'aq-rfv'},
         {'sec': 'arquitetos', 'blk': 'aq-esforco'},
         {'sec': 'arquitetos', 'blk': 'aq-recorrencia'},
         {'sec': 'arquitetos', 'blk': 'aq-parados'},
         {'sec': 'arquitetos', 'blk': 'aq-perf'},
         {'sub': 'Por fim, a ponta e o que está em jogo'},
         {'sec': 'mensal', 'blk': 'mn-cli'},
         {'sec': 'vendas', 'blk': 'av-rfv'},
         {'sec': 'vendas', 'blk': 'av-parados'},
         {'sec': 'vendas', 'blk': 'av-jogo'}]},
    {'n': 5, 't': 'O resultado', 'q': 'Quanto sobrou, e o que consumiu a diferença?', 'min': '12 min', 'itens': [
        {'sec': 'dre', 'filtro': True},
        {'sec': 'dre', 'blk': 'dre-ponte'},
        {'sec': 'dre', 'blk': 'dre-evol'},
        {'sec': 'dre', 'blk': 'dre-breakeven'},
        {'sec': 'dre', 'blk': 'dre-minidre'},
        {'sec': 'custofixo', 'filtro': True},
        {'sec': 'custofixo', 'blk': 'cf-cat'},
        {'sec': 'custofixo_mensal', 'filtro': True},
        {'sec': 'custofixo_mensal', 'blk': 'cfm-pacotes'},
        {'sec': 'custosx', 'filtro': True},
        {'sec': 'custosx', 'abre': True, 'semHead': True, 'semFiltro': True},
        {'sec': 'custosx', 'blk': 'cx-mensal'},
        # o comparativo por grupo traz a própria barra de período A × B, escrita dentro do corpo
        {'sec': 'custosx', 'filtroSel': '#custosx-body > .filterbar'},
        {'sec': 'custosx', 'blk': 'cx-grp'},
        {'sec': 'custosx', 'blk': 'cx-evitavel'},
        {'sec': 'custosx', 'blk': 'cx-retrabalho'},
        {'sec': 'custosx', 'blk': 'cx-retrabalho-pareto'},
        {'sec': 'custosx', 'blk': 'cx-assistencia'},
        {'sec': 'custosx', 'blk': 'cx-assistencia-prod'}]},
    # ato de passagem: só o enunciado — o estudo Fábrica × Loja é apresentado à parte e vive no Anexo III
    {'n': 6, 't': 'O que vem a seguir',
     'q': 'Como o resultado se reparte quando a leitura muda de empresa para função?', 'min': '4 min', 'itens': []},
]

ANEXOS = [
    {'id': 'anexo1', 'k': 'Anexo I', 't': 'Vendas, carteira e canal',
     'd': 'O detalhamento comercial que sustenta os atos 1 a 4: a exploração por período, o retrato completo '
          'do time e do canal, a carteira aberta por vendedor e por pedido.',
     'secs': ['resumo', 'evolutiva', 'ytd', 'mensal', 'periodo', 'performance', 'vendas', 'arquitetos',
              'carteira', 'carteira_dinamica']},
    {'id': 'anexo2', 'k': 'Anexo II', 't': 'Resultado, custo e dívida',
     'd': 'A demonstração de resultado inteira, o custo fixo aberto por pacote e por terceiro, o custo de '
          'produção da fábrica linha a linha e o histórico da dívida com o acionista.',
     'secs': ['dre', 'custofixo', 'custofixo_mensal', 'divida', 'custosx', 'custos']},
    {'id': 'anexo3', 'k': 'Anexo III', 't': 'Estudos e modelos',
     'd': 'Modelos gerenciais e estudos que não fazem parte do fechamento recorrente.',
     'secs': ['estudos']},
]


def blocos_do_ato(ato):
    """Os blocos que o ato pede (a abertura da seção é o bloco `<sec>.abertura` do catálogo)."""
    ids = []
    for it in ato['itens']:
        if it.get('sub'):
            continue
        if it.get('blk'):
            ids.append(it['blk'])
        elif it.get('abre') or it.get('filtro') or it.get('filtroSel'):
            ids.append(it['sec'] + '.abertura')
    return [b for b in ids if b in C.BLOCO]


def secoes_do_ato(ato):
    return sorted({it['sec'] for it in ato['itens'] if it.get('sec')})


def roteiro(pode_bloco):
    """O roteiro como este leitor o vê: cada ato com os itens que sobraram e se ficou vazio.

    Ato vazio não some — ele aparece dizendo "conteúdo restrito", senão a reunião pareceria
    ter menos atos para quem tem menos permissão (decisão da especificação)."""
    saida = []
    for ato in ATOS:
        itens = []
        for it in ato['itens']:
            if it.get('sub'):
                itens.append(dict(it))
                continue
            alvo = it.get('blk') or (it['sec'] + '.abertura')
            if pode_bloco(alvo):
                itens.append(dict(it))
        # subtítulo que ficou sem nenhum conteúdo depois dele não tem por que aparecer
        limpos = []
        for i, it in enumerate(itens):
            if it.get('sub') and not any(not x.get('sub') for x in itens[i + 1:]):
                continue
            limpos.append(it)
        tem = any(not it.get('sub') for it in limpos)
        saida.append(dict(ato, itens=limpos, restrito=not tem and bool(ato['itens'])))
    return saida


def secoes_necessarias(roteiro_visivel):
    """As seções que a página precisa desenhar para os atos montados — sem repetir."""
    vistas = []
    for ato in roteiro_visivel:
        for it in ato['itens']:
            if it.get('sec') and it['sec'] not in vistas:
                vistas.append(it['sec'])
    return vistas

# -*- coding: utf-8 -*-
"""O roteiro da reunião — os seis atos e os anexos, na ordem em que o mês é apresentado.

É a mesma estrutura do `atos.js` do Kit congelado (ato = pergunta + blocos que a respondem,
anexo = o que não entrou na leitura corrida). Aqui ela vive em Python porque o servidor precisa
saber, ANTES de desenhar, quais seções e blocos cada ato pede — para mandar só o que o perfil
enxerga e para dizer "conteúdo restrito" no ato que ficou vazio.

ATOS abaixo é o roteiro PADRÃO. Cada competência pode ter o seu, pilotado pela Controladoria na
página "Pilotar a apresentação": um rascunho que se edita à vontade e a versão GERADA, que é a que
a reunião mostra. A apresentação é a mesma para todo mundo; o que muda de pessoa para pessoa é o
que ela pode ver dentro dela.
"""
import copy
import json

from .. import catalogo as C
from ..db import agora, get_db

# item: {'sec': seção de origem, 'blk': bloco, 'abre': abertura da seção, 'filtro': a barra de
# filtro da seção, 'sub': subtítulo dentro do ato (não é conteúdo)}
ATOS = [
    {'n': 1, 't': 'De onde viemos', 'q': 'A empresa está crescendo, e para onde vai se nada mudar?',
     'min': '5 min', 'cortina': True, 'itens': [
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


def roteiro(pode_bloco, atos=None):
    """O roteiro como este leitor o vê: cada ato com os itens que sobraram e se ficou vazio.

    Ato vazio não some — ele aparece dizendo "conteúdo restrito", senão a reunião pareceria
    ter menos atos para quem tem menos permissão (decisão da especificação)."""
    saida = []
    for ato in (atos if atos is not None else ATOS):
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


# ------------------------------------------------------------------ o que não se repete nos anexos
# Blocos de anexo que mostram o mesmo quadro de um bloco dos atos (outra seção, mesmo conteúdo).
# Quando o bloco da direita está num ato, o da esquerda sai do anexo: o anexo é só o que sobrou.
EQUIVALENTES = {
    'ce-status': 'cd-status',                     # Carteira × Carteira dinâmica: classificação por status
    'cu-retrabalho': 'cx-retrabalho',             # Custos — Operacional × Executivo
    'cu-retrabalho-pareto': 'cx-retrabalho-pareto',
    'cu-assistencia': 'cx-assistencia',
    'cu-assistencia-prod': 'cx-assistencia-prod',
}
# barras de filtro que não são filhas diretas da seção: só as conhecidas (o valor vira seletor CSS)
FILTROS_INTERNOS = {'custosx': '#custosx-body > .filterbar'}
# seções cuja abertura traz números próprios (e não só título e texto): no anexo ela conta como conteúdo
ABERTURA_COM_CONTEUDO = {'resumo', 'performance', 'carteira_dinamica', 'divida'}
CHAVES_ITEM = ('sec', 'blk', 'abre', 'semHead', 'filtro', 'filtroSel', 'semFiltro', 'sub', 'nota')


def padrao():
    """O roteiro padrão no mesmo formato do que vem da tela (é assim que se compara um com o outro)."""
    return normalizar(copy.deepcopy(ATOS))


def blocos_nos_atos(atos):
    return [it['blk'] for a in atos for it in a['itens'] if it.get('blk')]


def ocultos_nos_anexos(atos):
    """Blocos que os anexos não mostram: os que estão num ato e os equivalentes a eles."""
    nos_atos = set(blocos_nos_atos(atos))
    return sorted(nos_atos | {b for b, alvo in EQUIVALENTES.items() if alvo in nos_atos})


def sobras_dos_anexos(atos):
    """O que fica em cada anexo depois dos atos — a prévia da página de pilotar."""
    fora = set(ocultos_nos_anexos(atos))
    aberturas = {it['sec'] for a in atos for it in a['itens'] if it.get('abre')}
    saida = []
    for g in ANEXOS:
        secs = []
        for sid in g['secs']:
            blocos = [b for b in C.BLOCOS if b['secao'] == sid and b['id'] not in fora
                      and not b['id'].endswith('.abertura')]
            if sid in ABERTURA_COM_CONTEUDO and sid not in aberturas:
                blocos.insert(0, C.BLOCO[sid + '.abertura'])
            if blocos:
                secs.append({'id': sid, 'titulo': C.SECAO[sid]['titulo'], 'blocos': blocos})
        saida.append(dict(g, secoes=secs))
    return saida


def _texto(v, limite):
    return str(v or '').strip()[:limite]


def normalizar(atos):
    """Confere um roteiro vindo da tela: só seções e blocos do catálogo, cada bloco em um lugar só,
    textos com tamanho limitado. Devolve o roteiro limpo ou levanta ValueError dizendo o problema."""
    if not isinstance(atos, list) or not atos:
        raise ValueError('o roteiro precisa de pelo menos um ato.')
    if len(atos) > 12:
        raise ValueError('no máximo 12 atos.')
    vistos, saida = set(), []
    for i, a in enumerate(atos, 1):
        if not isinstance(a, dict):
            raise ValueError('ato %d malformado.' % i)
        t = _texto(a.get('t'), 80)
        if not t:
            raise ValueError('o ato %d está sem título.' % i)
        itens = []
        for it in a.get('itens') or []:
            if not isinstance(it, dict):
                continue
            if 'sub' in it:
                sub = _texto(it['sub'], 120)
                if sub:
                    novo = {'sub': sub}
                    if it.get('nota') == 'CANAL_SHARE':
                        novo['nota'] = 'CANAL_SHARE'
                    itens.append(novo)
                continue
            sec = it.get('sec')
            if sec not in C.SECAO:
                raise ValueError('seção desconhecida: %s.' % sec)
            if it.get('blk'):
                b = C.BLOCO.get(it['blk'])
                if not b or b['secao'] != sec or b['id'].endswith('.abertura'):
                    raise ValueError('bloco desconhecido: %s.' % it['blk'])
                if b['id'] in vistos:
                    raise ValueError('"%s" aparece duas vezes no roteiro.' % b['titulo'])
                vistos.add(b['id'])
                itens.append({'sec': sec, 'blk': b['id']})
            elif it.get('filtroSel'):
                if FILTROS_INTERNOS.get(sec) != it['filtroSel']:
                    raise ValueError('filtro desconhecido em %s.' % sec)
                itens.append({'sec': sec, 'filtroSel': it['filtroSel']})
            elif it.get('filtro'):
                itens.append({'sec': sec, 'filtro': True})
            elif it.get('abre'):
                novo = {'sec': sec, 'abre': True, 'semHead': True}
                if it.get('semFiltro'):
                    novo['semFiltro'] = True
                itens.append(novo)
        saida.append({'n': i, 't': t, 'q': _texto(a.get('q'), 200), 'min': _texto(a.get('min'), 12),
                      'cortina': bool(a.get('cortina')), 'itens': itens})
    return saida


def _linha(codigo):
    r = get_db().execute('SELECT * FROM apresentacao_roteiro WHERE competencia=?', (codigo,)).fetchone()
    return dict(r) if r else None


def vigente(codigo):
    """O roteiro que a reunião mostra: o último gerado para a competência, ou o padrão."""
    r = _linha(codigo)
    return json.loads(r['gerado']) if r and r['gerado'] else padrao()


def rascunho(codigo):
    r = _linha(codigo)
    return json.loads(r['rascunho']) if r else vigente(codigo)


def estado(codigo):
    """Para a página de pilotar: quando foi gerado, por quem, e se o rascunho tem mudança não gerada."""
    r = _linha(codigo) or {}
    ras = json.loads(r['rascunho']) if r.get('rascunho') else None
    ger = json.loads(r['gerado']) if r.get('gerado') else padrao()
    return {'gerado_em': r.get('gerado_em'), 'gerado_por': r.get('gerado_por'),
            'atualizado_em': r.get('atualizado_em'), 'atualizado_por': r.get('atualizado_por'),
            'pendente': ras is not None and ras != ger, 'padrao': ger == padrao()}


def salvar_rascunho(codigo, atos, login):
    limpo = normalizar(atos)
    con = get_db()
    con.execute('INSERT INTO apresentacao_roteiro (competencia, rascunho, atualizado_em, atualizado_por) '
                'VALUES (?,?,?,?) ON CONFLICT(competencia) DO UPDATE SET rascunho=excluded.rascunho, '
                'atualizado_em=excluded.atualizado_em, atualizado_por=excluded.atualizado_por',
                (codigo, json.dumps(limpo, ensure_ascii=False), agora(), login))
    con.commit()
    return limpo


def gerar(codigo, login):
    """O rascunho passa a ser a apresentação do mês."""
    atos = salvar_rascunho(codigo, rascunho(codigo), login)
    con = get_db()
    con.execute('UPDATE apresentacao_roteiro SET gerado=rascunho, gerado_em=?, gerado_por=? WHERE competencia=?',
                (agora(), login, codigo))
    con.commit()
    return atos


def descartar_rascunho(codigo, login):
    """O rascunho volta a ser o que está gerado."""
    salvar_rascunho(codigo, vigente(codigo), login)


def secoes_necessarias(roteiro_visivel):
    """As seções que a página precisa desenhar para os atos montados — sem repetir."""
    vistas = []
    for ato in roteiro_visivel:
        for it in ato['itens']:
            if it.get('sec') and it['sec'] not in vistas:
                vistas.append(it['sec'])
    return vistas

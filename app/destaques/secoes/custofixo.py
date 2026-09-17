# -*- coding: utf-8 -*-
"""Destaques de Custo Fixo, Custo Fixo Mensal, Dívida e Estudos — chamadas de ins() de
renderCustoFixoBody/renderCustoFixoEntidade, drawCustoFixoMensal, renderDivida e renderEstudosBody."""
from ...calculo.secoes.custofixo import CATS, ENTS, PACOTES_CF, _agg_mes, _filtros_mensal
from ...calculo.secoes.divida import _anos_aportes
from ..genericas import auto, serie_oscilacao
from ..regras_custofixo import (categoria_contrafluxo, composicao, concentracao_cf, divida_correcao,
                                divida_juro_ano, fabloja_linhas, pacote_variacao)
from ...calculo.datas import ym_lab, ym_shift


def montar_cf(C, params=None):
    params = params or {}
    CF = C.blob('CF')
    if not CF:
        return
    ent = params.get('ent') if params.get('ent') in ENTS else 'CONSOLIDADO'
    cat = CF['cat_fabrica'] if ent == 'FABRICA' else CF['cat_loja'] if ent == 'DESIGN' else CF['categoria']
    cats = {c: cat[c] for c in CATS}
    yield ('cf-cat', [], categoria_contrafluxo(C, {'cats': cats, 'entidade': ent}))
    yield ('cf-cat', [], concentracao_cf(C, {'cats': cats, 'entidade': ent}))
    yield ('cf-ent', [], composicao(C))


def montar_cfm(C, params=None):
    params = params or {}
    M = C.blob('CFMENSAL')
    if not M or not M['yms']:
        return
    emp, dim, _anos, ym = _filtros_mensal(M, params)
    if isinstance(ym, str):      # visão do ano: o Kit não chama a regra do mês
        return
    prev = ym_shift(ym, -1)
    cur, _ = _agg_mes(M, emp, ym, dim)
    ant, _ = _agg_mes(M, emp, prev, dim)
    rows = [[p, cur.get(p, 0), ant.get(p, 0), cur.get(p, 0) - ant.get(p, 0)] for p in PACOTES_CF]
    yield ('cfm-pacotes', [], pacote_variacao({'rows': rows, 'labAtual': ym_lab(ym), 'labPrev': ym_lab(prev),
                                               'dim': dim}))


def montar_divida(C, params=None):
    AP = C.blob('APORTES')
    yield ('dv-saldo', [], divida_correcao(C))
    if AP:
        anos = _anos_aportes(AP)
        rot = lambda o: str(o['ano']) if o['meses'] == 12 else '%d (%dm)' % (o['ano'], o['meses'])
        yield ('dv-ano', [], divida_juro_ano({'anos': anos}))
        yield ('dv-ano', [], auto({'itens': [{'name': rot(o), 'v': o['cor'], 'q': o['liq']} for o in anos],
                                   'escopo': 'ano', 'escopoPl': 'anos', 'universo': 'da correção da dívida',
                                   'id': 'divida-anos', 'tabela': True, 'preferir': ['relacao', 'cauda']}))
    DPNL = C.blob('DPNL')
    E = DPNL['CONSOLIDADO']
    D1 = C.ano_d
    D0 = D1 - 1
    maxym = C.maxym_dre
    yms, endv, jur = [], [], []
    for y in (D0, D1):
        yr = str(y)
        if yr not in E:
            continue
        for m in range(12):
            if y == D1 and m > (maxym % 100) - 1:
                break
            yms.append(y * 100 + m + 1)
            e, j = E[yr].get('endividamento'), E[yr].get('juros_passivos')
            endv.append((e[m] if e and m < len(e) else 0) or 0)
            jur.append((j[m] if j and m < len(j) else 0) or 0)
    cum, acc = [], 0
    for v in endv:
        acc += -v
        cum.append(acc)
    labels = [ym_lab(y) for y in yms]
    ger = [-v for v in endv]
    jur_abs = [abs(v) for v in jur]
    yield ('dv-endiv', [], serie_oscilacao({'labels': labels, 'vals': cum, 'id': 'endiv-acum'})
           or auto({'itens': [{'name': labels[i], 'v': abs(v)} for i, v in enumerate(cum)],
                    'escopo': 'mês', 'escopoPl': 'meses', 'universo': 'do endividamento acumulado',
                    'id': 'endiv-acum', 'preferir': ['cauda', 'estrutura']}))
    yield ('dv-juros', [], serie_oscilacao({'labels': labels, 'vals': jur_abs, 'id': 'juros-terceiros'})
           or auto({'itens': [{'name': labels[i], 'v': v} for i, v in enumerate(jur_abs)],
                    'escopo': 'mês', 'escopoPl': 'meses', 'universo': 'dos juros pagos a bancos',
                    'id': 'juros-terceiros', 'preferir': ['cauda', 'estrutura']}))
    yield ('dv-geracao', [], auto({'itens': [{'name': labels[i], 'v': abs(v), 'q': jur_abs[i]}
                                             for i, v in enumerate(ger)],
                                   'escopo': 'mês', 'escopoPl': 'meses', 'universo': 'do endividamento gerado',
                                   'id': 'endiv-mes', 'tabela': True, 'preferir': ['relacao', 'cauda']}))


def montar_estudos(C, params=None):
    yield ('est-dre', [], fabloja_linhas(C))

# -*- coding: utf-8 -*-
"""Destaques de Custos — Operacional (CPP): as chamadas de ins() de renderCustosBody e drawPC (app.js)."""
from ...calculo.custos import custos_agg, reconciliar
from ...calculo.numeros import ordem_chaves_js, soma
from ...calculo.secoes.custos import SRC, _evolutivo, _filtro
from ..genericas import auto, serie_oscilacao
from ..regras_custos import absorcao, compara_anos, evitavel, taxa_hora
from ..regras_matriz import mix_cruzado
from .custosx import _mes_lab


def montar(C, params=None):
    params = params or {}
    CU = C.blob('CUSTOS')
    if not CU:
        return
    cu_min, cu_max = _filtro(C, params)
    a = reconciliar(custos_agg(CU, cu_min, cu_max, None, SRC))
    t = a['total']
    if not t['custo']:
        return
    yield ('cu-desmembrado', [], absorcao(C, {'custosA': [a['ymMin'], a['ymMax']]}))
    yield ('cu-desmembrado', [], auto({'itens': [{'name': 'Matéria-prima', 'v': t['mat']},
                                                 {'name': 'Mão de obra', 'v': t['mod']},
                                                 {'name': 'Gastos gerais de fabricação', 'v': t['ggf']}],
                                       'escopo': 'componente', 'escopoPl': 'componentes',
                                       'universo': 'do custo de produção', 'id': 'cpp-componentes',
                                       'tabela': True, 'preferir': ['relacao']}))
    yield ('cu-composicao', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in a['materiais']],
                                      'escopo': 'categoria', 'escopoPl': 'categorias de material',
                                      'universo': 'da matéria-prima', 'id': 'cpp-materiais',
                                      'preferir': ['estrutura', 'cauda']}))
    grupos_it = [{'name': g[0], 'v': g[5], 'q': g[1]} for g in a['grupos']]
    yield ('cu-grupos', [], auto({'itens': grupos_it, 'escopo': 'grupo', 'escopoPl': 'grupos de produto',
                                  'universo': 'do custo de produção', 'id': 'cpp-grupos',
                                  'preferir': ['divergencia', 'cauda']}))
    yield ('cu-grupos', [], auto({'itens': grupos_it, 'escopo': 'grupo', 'escopoPl': 'grupos de produto',
                                  'universo': 'do custo de produção', 'id': 'cpp-grupos-tab', 'tabela': True,
                                  'preferir': ['estrutura', 'relacao']}))
    yield ('cu-ranking', [], auto({'itens': [{'name': p['prod'], 'v': p['custo'], 'q': p['qtd']}
                                             for p in a['produtos']],
                                   'escopo': 'produto', 'escopoPl': 'produtos',
                                   'universo': 'do custo de produção', 'id': 'cpp-produtos', 'tabela': True,
                                   'preferir': ['cauda', 'relacao']}))
    grp_ord = [g[0] for g in a['grupos'] if g[0] != 'MATERIAIS']
    if len(a['mesesYm']) > 1:
        lbl = [_mes_lab(ym) for ym in a['mesesYm']]
        hdata = {g: {lbl[i]: ((a['volGrpMes'].get(g) or {}).get(ym) or 0) for i, ym in enumerate(a['mesesYm'])}
                 for g in grp_ord}
        yield ('cu-volume', [], mix_cruzado({'linhas': grp_ord, 'colunas': lbl, 'mat': hdata,
                                             'escopo': 'grupo', 'id': 'cpp-vol-mes'}))
        vol_total = [soma((a['volGrpMes'].get(g) or {}).get(ym, 0) for g in grp_ord) for ym in a['mesesYm']]
        yield ('cu-volume', [], serie_oscilacao({'labels': lbl, 'vals': vol_total, 'id': 'cpp-volume',
                                                 'fmt': 'pecas', 'verbo': 'produziu'}))
        yield ('cu-volume', [], auto({'itens': [{'name': g, 'v': soma((a['volGrpMes'].get(g) or {}).get(ym, 0)
                                                                      for ym in a['mesesYm'])} for g in grp_ord],
                                      'escopo': 'grupo', 'escopoPl': 'grupos de produto',
                                      'universo': 'do volume produzido', 'id': 'cpp-vol-tab', 'tabela': True,
                                      'preferir': ['estrutura', 'relacao']}))
    op = a['operacionais']
    yield ('cu-produtivo', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in op['PRODUTIVO']['itens']],
                                     'escopo': 'tipo de conta', 'escopoPl': 'tipos de conta',
                                     'universo': 'do custo produtivo', 'id': 'cpp-produtivo',
                                     'preferir': ['estrutura', 'relacao']}))
    yield ('cu-apoio', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in op['AUXILIAR/APOIO']['itens']],
                                 'escopo': 'tipo de conta', 'escopoPl': 'tipos de conta',
                                 'universo': 'do custo de apoio', 'id': 'cpp-apoio',
                                 'preferir': ['estrutura', 'relacao']}))
    vp = {r: v for r, v in op['PRODUTIVO']['itens']}
    va = {r: v for r, v in op['AUXILIAR/APOIO']['itens']}
    contas = []
    for nm in [x[0] for x in op['PRODUTIVO']['itens']] + [x[0] for x in op['AUXILIAR/APOIO']['itens']]:
        if nm not in contas:
            contas.append(nm)
    contas_ord = sorted(contas, key=lambda nm: -(vp.get(nm, 0) + va.get(nm, 0)))
    yield ('cu-absorcao-conta', [], auto({'itens': [{'name': nm, 'v': vp.get(nm, 0) + va.get(nm, 0)}
                                                    for nm in contas_ord],
                                          'escopo': 'tipo de conta', 'escopoPl': 'tipos de conta',
                                          'universo': 'do custo absorvido', 'id': 'cpp-conta', 'tabela': True,
                                          'preferir': ['estrutura', 'relacao']}))
    cc_it = [{'name': x[0], 'v': x[3], 'q': x[4]} for x in a['cc']]
    yield ('cu-cc-total', [], auto({'itens': cc_it, 'escopo': 'centro de custo', 'escopoPl': 'centros de custo',
                                    'universo': 'do custo absorvido', 'id': 'cpp-cc',
                                    'preferir': ['divergencia', 'cauda']}))
    yield ('cu-cc-taxa', [], auto({'itens': cc_it, 'escopo': 'centro de custo', 'escopoPl': 'centros de custo',
                                   'universo': 'do custo por hora', 'id': 'cpp-taxa',
                                   'preferir': ['divergencia', 'relacao']}))
    cc_tab = [[x[0], x[1], x[2], x[3], x[4], x[5], x[3], x[5]] for x in a['cc']]
    yield ('cu-cc-taxa', [], taxa_hora({'cc': cc_tab, 'id': 'cpp-tab'})
           or auto({'itens': cc_it, 'escopo': 'centro de custo', 'escopoPl': 'centros de custo',
                    'universo': 'do custo absorvido', 'id': 'cpp-cc-tab', 'tabela': True,
                    'preferir': ['relacao']}))
    base = a['ccTotal']['custoRaw'] or a['ccTotal']['custo']
    yield ('cu-retrabalho', [], evitavel({'ret': dict(a['retrabalho'], porCC=None),
                                          'ass': {'total': a['assistencia']['total'],
                                                  'porProduto': a['assistencia']['porProduto']},
                                          'base': base}))
    ret_cc = {}
    for x in a['retrabalho']['porItem']:
        ret_cc[x[0]] = ret_cc.get(x[0], 0) + x[2]
    pareto = sorted(([k, ret_cc[k]] for k in ordem_chaves_js(ret_cc)), key=lambda x: -x[1])[:12]
    if len(pareto) > 2:
        yield ('cu-retrabalho-pareto', [], auto({'itens': [{'name': x[0][:22], 'v': x[1]} for x in pareto],
                                                 'escopo': 'centro de custo', 'escopoPl': 'centros de custo',
                                                 'universo': 'do retrabalho', 'id': 'cpp-retrabalho',
                                                 'preferir': ['estrutura', 'cauda', 'relacao']}))
    yield ('cu-retrabalho', [], auto({'itens': [{'name': x[1], 'v': x[2]} for x in a['retrabalho']['porItem']],
                                      'escopo': 'produto', 'escopoPl': 'produtos', 'universo': 'do retrabalho',
                                      'id': 'retrab-item', 'tabela': True, 'preferir': ['estrutura', 'relacao']}))
    if len(a['assistencia']['mensal']) > 1:
        yield ('cu-assistencia', [], serie_oscilacao({'labels': [_mes_lab(m[0]) for m in a['assistencia']['mensal']],
                                                      'vals': [m[1] for m in a['assistencia']['mensal']],
                                                      'id': 'assist'}))
    yield ('cu-assistencia-prod', [], auto({'itens': [{'name': x[0], 'v': x[1]} for x in a['assistencia']['porProduto']],
                                            'escopo': 'produto', 'escopoPl': 'produtos',
                                            'universo': 'da assistência técnica', 'id': 'assist-prod',
                                            'tabela': True, 'preferir': ['estrutura', 'cauda']}))
    E = _evolutivo(C, CU, params)
    if E and not E.get('ausente'):
        yield ('cu-evolutivo', [], compara_anos({'anos': E['anos'], 'ordem': E['ordem'], 'id': 'pc'}))

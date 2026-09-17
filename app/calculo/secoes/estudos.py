# -*- coding: utf-8 -*-
"""Estudos e Análises (modelo gerencial Fábrica × Loja) — porte de renderEstudos/renderEstudosBody
(app.js). Parâmetro: grp (1 abre os 16 subgrupos de despesa). O ano é o corrente da DRE, como no Kit."""
import re

EST_EBITDA = re.compile(r'^\(=\)\s*EBITDA', re.I)
EST_DEPREC = re.compile(r'^\(-\)\s*Deprecia[cç][aã]o', re.I)
EST_ROL = re.compile(r'^\(=\)\s*RECEITA OPERACIONAL LIQUIDA', re.I)
PCT_ROL = [(re.compile(r'^\(=\)\s*MARGEM DE CONTRIBUICAO', re.I), '% Margem de contribuição sobre a ROL')]
SUB = re.compile(r'^\(=\)')
CHAVES = ['FABRICA', 'LOJA', 'CONSOLIDADO']


def calcular(C, params=None):
    params = params or {}
    F = C.blob('FABLOJA')
    out = {'estudos.abertura': {'tem': bool(F)}}
    if not F:
        return out
    aberto = str((params or {}).get('grp') or '') == '1'
    anos = F.get('anos') or []
    foco = str(C.ano_d)
    ano = foco if foco in anos else (F.get('ano_padrao') or (anos[-1] if anos else None))
    per = (F.get('periodos') or {}).get(ano) or F.get('periodo') or ano
    bl = {b['chave']: b for b in F['blocos']}
    li = lambda k: ((bl.get(k) or {}).get('anos') or {}).get(ano) or (bl.get(k) or {}).get('linhas') or []
    base = li('FABRICA')

    def val(k, i, c=2):
        linha = li(k)
        if i < 0 or i >= len(linha):
            return None
        return linha[i][c] if c < len(linha[i]) else None

    achar = lambda rx: next((i for i, l in enumerate(base) if rx.match(l[0])), -1)
    i_eb, i_dep, i_rol = achar(EST_EBITDA), achar(EST_DEPREC), achar(EST_ROL)
    corte = i_dep + 1 if i_dep >= 0 else len(base)

    def ebit(k, c=2):
        if i_eb < 0 or i_dep < 0:
            return None
        a, b = val(k, i_eb, c), val(k, i_dep, c)
        return None if (a is None or b is None) else a + b

    def sobre_rol(k, v):
        if v is None or i_rol < 0:
            return None
        rol = val(k, i_rol)
        return None if not rol else v / rol

    linhas = []
    for i, b0 in enumerate(base[:corte]):
        if not aberto and b0[3] == 2:
            continue
        if EST_EBITDA.match(b0[0]):
            continue
        forte = (b0[3] == 0) if b0[3] is not None else bool(SUB.match(b0[0]))
        linhas.append({'tipo': 'linha', 'nome': b0[0], 'nivel': b0[3], 'forte': forte,
                       'v': [val(k, i) for k in CHAVES]})
        rot = next((x[1] for x in PCT_ROL if x[0].match(b0[0])), None)
        if rot:
            linhas.append({'tipo': 'pct', 'rot': rot, 'v': [sobre_rol(k, val(k, i)) for k in CHAVES]})
    linhas.append({'tipo': 'ebit', 'v': [ebit(k) for k in CHAVES]})
    linhas.append({'tipo': 'pct', 'rot': '% EBIT sobre a ROL', 'v': [sobre_rol(k, ebit(k)) for k in CHAVES]})
    out['estudos.abertura'].update({'ano': ano, 'periodo': per, 'aberto': aberto})
    out['est-dre'] = {'ano': ano, 'periodo': per, 'aberto': aberto, 'linhas': linhas,
                      'kpis': {'loja_antigo': ebit('LOJA', 1), 'loja': ebit('LOJA'), 'fabrica': ebit('FABRICA'),
                               'consolidado': ebit('CONSOLIDADO')},
                      'apurado': F.get('apurado'), 'markup': F.get('markup')}
    return out

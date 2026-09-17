# -*- coding: utf-8 -*-
"""O que mudou de uma competência para a outra.

Duas leituras, com propósitos diferentes:

- `passado()` é o guarda: mês já publicado não muda sozinho. Compara mês a mês, na base bruta,
  tudo que está ATÉ o último mês da competência anterior. Diferença acima do limite trava a
  publicação até a Controladoria justificar (a justificativa fica na auditoria e aparece em
  "o que mudou").
- `por_bloco()` é a leitura de quem confere: para cada bloco, o maior número que se moveu.
"""
from ..calculo import competencia as comp_mod
from ..calculo.numeros import soma

# quanto um mês já publicado pode variar sem travar: o que for maior entre R$ e % do próprio mês
LIMITE_ABS = 1.0
LIMITE_REL = 0.001


def _meses_base(C):
    """{base: {ym: total}} das bases que têm valor por mês — é o que sustenta 'o passado mudou'."""
    out = {}
    DATA = C.blob('DATA')
    if DATA and DATA.get('rows'):
        v = {}
        for r in DATA['rows']:
            v[r[0]] = v.get(r[0], 0) + r[1]
        out['comercial'] = v
    DPNL = C.blob('DPNL')
    if DPNL:
        v = {}
        for ent, anos in DPNL.items():
            if ent != 'CONSOLIDADO':
                continue
            for ano, linhas in anos.items():
                serie = linhas.get('receita_liquida') or []
                for i, x in enumerate(serie):
                    if x:
                        v[int(ano) * 100 + i + 1] = v.get(int(ano) * 100 + i + 1, 0) + x
        out['painel'] = v
    CU = C.blob('CUSTOS')
    if CU and CU.get('cpv'):
        v = {}
        for r in CU['cpv']:
            v[r[0]] = v.get(r[0], 0) + r[6]
        out['custos'] = v
    CFM = C.blob('CFMENSAL')
    if CFM and CFM.get('rows'):
        v = {}
        for r in CFM['rows']:
            v[r[1]] = v.get(r[1], 0) + r[-1]
        out['custo_fixo_razao'] = v
    return out


def passado(novo, velho):
    """Divergências nos meses que a competência anterior já cobria. Lista vazia = passado intacto."""
    if velho is None:
        return []
    a, b = _meses_base(novo), _meses_base(velho)
    saida = []
    for base, antes in b.items():
        depois = a.get(base) or {}
        corte = max(antes) if antes else 0
        for ym in sorted(antes):
            if ym > corte:
                continue
            v0, v1 = antes[ym], depois.get(ym, 0)
            dif = v1 - v0
            if abs(dif) <= max(LIMITE_ABS, abs(v0) * LIMITE_REL):
                continue
            saida.append({'base': base, 'ym': ym, 'antes': v0, 'depois': v1, 'dif': dif,
                          'rel': (dif / v0) if v0 else None})
    return saida


def _numeros(o, prefixo=''):
    """Todo número do payload, com o caminho até ele."""
    if isinstance(o, dict):
        for k, v in o.items():
            if k == '_ins':
                continue
            yield from _numeros(v, '%s.%s' % (prefixo, k) if prefixo else str(k))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from _numeros(v, '%s[%d]' % (prefixo, i))
    elif isinstance(o, (int, float)) and not isinstance(o, bool):
        yield prefixo, float(o)


def por_bloco(novo, velho, secoes, params=None):
    """Para cada bloco: o maior número que mudou (valor antes, depois e o caminho no payload)."""
    from .. import calculo
    if velho is None:
        return {}
    out = {}
    for secao in secoes:
        pa = calculo.payloads_da_secao(novo, secao, lambda _b: True, params) or {}
        pb = calculo.payloads_da_secao(velho, secao, lambda _b: True, params) or {}
        for bloco, payload in pa.items():
            antes = pb.get(bloco)
            if antes is None:
                out[bloco] = {'novo': True}
                continue
            a = dict(_numeros(payload))
            b = dict(_numeros(antes))
            maior = None
            for caminho, v1 in a.items():
                v0 = b.get(caminho)
                if v0 is None or v0 == v1:
                    continue
                dif = abs(v1 - v0)
                if maior is None or dif > maior['dif']:
                    maior = {'campo': caminho, 'antes': v0, 'depois': v1, 'dif': dif,
                             'rel': (v1 - v0) / v0 if v0 else None}
            if maior:
                out[bloco] = maior
    return out


def carregar(config, codigo):
    return comp_mod.carregar(config, codigo)


def anterior(config, codigo):
    """A competência publicada imediatamente antes desta (pelo código AAAA-MM)."""
    anteriores = [c for c in comp_mod.disponiveis(config) if c < codigo]
    return comp_mod.carregar(config, anteriores[-1]) if anteriores else None

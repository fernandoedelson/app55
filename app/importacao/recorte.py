# -*- coding: utf-8 -*-
"""Competência reconstruída: planilhas de um mês posterior recortadas no fim do mês pedido.

A competência é a foto das planilhas no fim do mês. Quando essa foto não foi guardada (ex.: 31/08), dá para
reconstruir o que as planilhas acumuladas permitem: vendas, DRE, custo fixo, custos e aportes têm data por
lançamento e são cortados; a carteira de vendas é refeita pela data da NF. O que é só "foto do dia"
(carteira dinâmica, Fábrica × Loja) não se reconstrói e fica de fora.

Todas as funções devolvem o próprio dado quando `ate_ym` é None — a importação normal não passa por aqui."""

_YM = (190000, 300000)


def _e_ym(v):
    return isinstance(v, int) and not isinstance(v, bool) and _YM[0] < v < _YM[1]


def teto(maxym, ate_ym):
    if not ate_ym:
        return maxym
    return min(maxym, ate_ym) if maxym else ate_ym


def sem_foto(blob, ate_ym):
    """Bases que são a foto de um dia (carteira dinâmica, modelo Fábrica × Loja): não existem no fim do mês."""
    return None if ate_ym else blob


def _zerar_depois(v, mes):
    if isinstance(v, list) and len(v) == 12 and all(isinstance(x, (int, float)) or x is None for x in v):
        return [x if i < mes else (0 if x is not None else x) for i, x in enumerate(v)]
    if isinstance(v, dict):
        return {k: _zerar_depois(x, mes) for k, x in v.items()}
    return v


def dpnl(blob, ate_ym):
    """DRE: anos depois do corte saem; no ano do corte os meses seguintes ficam zerados (como mês futuro)."""
    if not ate_ym or not blob:
        return blob
    ano, mes = divmod(ate_ym, 100)
    out = {}
    for entidade, anos in blob.items():
        # `volume` traz também os meses futuros (previsão de produção da própria planilha): não é realizado, fica
        out[entidade] = {a: ({k: (v if k == 'volume' else _zerar_depois(v, mes)) for k, v in d.items()}
                             if int(a) == ano else d)
                         for a, d in anos.items() if int(a) <= ano}
    return out


def cf_mensal(blob, ate_ym):
    if not ate_ym or not blob:
        return blob
    out = dict(blob)
    out['yms'] = [y for y in blob['yms'] if y <= ate_ym]
    out['rows'] = [r for r in blob['rows'] if r[1] <= ate_ym]
    return out


def custos(blob, ate_ym, onde_esta_o_mes=None):
    """Toda lista de linhas com o mês numa coluna (na primeira; em `nz_ordens`, na segunda) é cortada."""
    if not ate_ym or not blob:
        return blob
    onde_esta_o_mes = onde_esta_o_mes or {'nz_ordens': 1}
    out = {}
    for chave, v in blob.items():
        i = onde_esta_o_mes.get(chave, 0)
        if isinstance(v, list) and v and all(isinstance(r, (list, tuple)) and len(r) > i for r in v[:3]) \
                and any(_e_ym(r[i]) for r in v[:3]):
            v = [r for r in v if not _e_ym(r[i]) or r[i] <= ate_ym]
        out[chave] = v
    return out


def aportes(blob, ate_ym):
    """Saldo da dívida com o acionista no fim do mês (as séries já são acumuladas por mês)."""
    if not ate_ym or not blob:
        return blob
    n = sum(1 for y in blob['yms'] if y <= ate_ym)
    if not n:
        return None
    out = dict(blob)
    for k in ('yms', 'aporte', 'correcao', 'remessas', 'recebimentos'):
        out[k] = blob[k][:n]
    out['saldo_atual'] = round(out['aporte'][-1] + out['correcao'][-1], 2)
    out['total_remessas'] = round(sum(out['remessas']), 2)
    out['total_recebimentos'] = round(sum(out['recebimentos']), 2)
    out['total_correcao'] = round(out['correcao'][-1], 2)
    return out

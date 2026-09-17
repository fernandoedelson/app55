# -*- coding: utf-8 -*-
"""DRE por entidade — porte de DRE_LINES, dreAgg, dreYears e dreMonthly (app.js).

DPNL[entidade][ano][linha] = 12 valores mensais. A iteração dos anos segue a ordem do JavaScript
(chaves numéricas em ordem crescente), e a soma segue ano -> mês -> linha, igual ao for do Kit."""

DRE_LINES = [
    ('receita_bruta', 'Receita Operacional Bruta', 'h'),
    ('deducoes', '(−) Deduções das Receitas', 'n'),
    ('receita_liquida', '= Receita Operacional Líquida', 't'),
    ('custos_var', '(−) Custos Variáveis', 'n'),
    ('margem_contrib', '= Margem de Contribuição', 't'),
    ('despesas_op', '(−) Custo Fixo (Despesas Operacionais)', 'n'),
    ('ebitda', '= EBITDA', 't'),
    ('deprec', '(−) Depreciação e Amortização', 'n'),
    ('financeiro', '(−) Resultado Financeiro', 'n'),
    ('ajuste', '(+) Efeito absorção e não operacional', 'p'),
    ('result_liq', '= Resultado Líquido', 't'),
]
EXTRAS = ['volume', 'cpv', 'gvv', 'endividamento', 'juros_passivos']


def _anos(E):
    return sorted(E, key=lambda y: int(y))


def _m(arr, m):
    """arr[m]||0 do JavaScript: None, 0 e ausência viram 0."""
    if not arr or m >= len(arr):
        return 0
    return arr[m] or 0


def dre_agg(DPNL, ent, ym_min, ym_max):
    E = DPNL.get(ent) or {}
    s = {l[0]: 0 for l in DRE_LINES}
    for k in EXTRAS:
        s[k] = 0
    for yr in _anos(E):
        y = int(yr)
        for m in range(12):
            ym = y * 100 + m + 1
            if ym < ym_min or ym > ym_max:
                continue
            for k, _, _ in DRE_LINES:
                if k == 'ajuste':
                    continue
                arr = E[yr].get(k)
                if arr:
                    s[k] += _m(arr, m)
            for k in EXTRAS:
                s[k] += _m(E[yr].get(k), m)
    s['ajuste'] = s['result_liq'] - s['ebitda'] - s['deprec'] - s['financeiro']
    rl = s['receita_liquida'] or 1
    s['mc_pct'] = s['margem_contrib'] / rl
    s['eb_pct'] = s['ebitda'] / rl
    s['rl_pct'] = s['result_liq'] / rl
    s['cf_pct'] = s['despesas_op'] / rl
    vol = s['volume'] or 0
    s['ticket_prod'] = s['receita_bruta'] / vol if vol else 0
    s['rol_prod'] = s['receita_liquida'] / vol if vol else 0
    s['custo_prod'] = s['cpv'] / vol if vol else 0
    s['gvv_prod'] = s['gvv'] / vol if vol else 0
    s['mc_prod'] = s['margem_contrib'] / vol if vol else 0
    s['margem_prod'] = s['ticket_prod'] + s['custo_prod']
    return s


def dre_years(DPNL, ent):
    # Object.keys(E).map(Number).sort() — sort sem comparador ordena como TEXTO; para anos de 4
    # dígitos dá o mesmo resultado que a ordem numérica
    return sorted(int(y) for y in (DPNL.get(ent) or {}))


def dre_monthly(DPNL, ent, ym_min, ym_max, key):
    E = DPNL.get(ent) or {}
    out = []
    for yr in _anos(E):
        y = int(yr)
        for m in range(12):
            ym = y * 100 + m + 1
            if ym < ym_min or ym > ym_max:
                continue
            arr = E[yr].get(key)
            out.append([ym, (arr[m] or 0) if arr else 0])
    out.sort(key=lambda x: x[0])
    return out

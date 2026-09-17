# -*- coding: utf-8 -*-
"""Regras da DRE — porte de R.dreJurosEbitda, R.dreMargemVolume, R.dreCustoFixoNivel,
R.dreCustoFixoRol, R.dreLinhaQueMudou, R.equilibrioAlavanca, R.equilibrioBruta, R.dreFabricaLoja
e R.dreComparativoMotor (insights.js)."""
from ..calculo.numeros import soma
from .nucleo import destaque

LINHAS_MOV = [('Receita líquida', 'receita_liquida'), ('Custos variáveis', 'custos_var'),
              ('Custo fixo', 'despesas_op'), ('Depreciação', 'deprec'),
              ('Resultado financeiro', 'financeiro')]


def _sinal(v):
    return (v > 0) - (v < 0)


def juros_ebitda(ctx):
    g = ctx.get('dre')
    if not g:
        return None
    juros, eb, rol = abs(g.get('juros_passivos') or 0), g.get('ebitda') or 0, g.get('receita_liquida') or 0
    if not juros or not rol:
        return None
    if eb > 0 and juros / eb < .35:
        return None
    return destaque('dreJurosEbitda', ctx, 'consequencia', juros / eb if eb > 0 else 1,
                    {'juros': juros, 'eb': eb, 'rol': rol, 'result': g['result_liq'],
                     'umPP': rol * .01, 'umPctJuros': juros * .01},
                    tom='warn', id_fixo='dre-juros-ebitda')


def margem_volume(ctx):
    g, p = ctx.get('dre'), ctx.get('drePrev')
    if not g or not p or not p.get('volume') or not g.get('volume') \
            or not p.get('receita_liquida') or not g.get('receita_liquida'):
        return None
    d_mc = g['mc_pct'] - p['mc_pct']
    d_vol = g['volume'] / p['volume'] - 1
    if abs(d_mc) < .02 or abs(d_vol) < .08 or _sinal(d_mc) == _sinal(d_vol):
        return None
    d_mc_abs = g['margem_contrib'] - p['margem_contrib']
    mc_peca = g['margem_contrib'] / g['volume'] if g['volume'] else 0
    return destaque('dreMargemVolume', ctx, 'decomposicao', abs(d_mc) * 12 + abs(d_vol),
                    {'mcPct': g['mc_pct'], 'mcPctPrev': p['mc_pct'], 'vol': g['volume'], 'volPrev': p['volume'],
                     'dVol': d_vol, 'dMc': d_mc, 'dMcAbs': d_mc_abs, 'mcPeca': mc_peca,
                     'seVolIgual': mc_peca * p['volume']},
                    tom='warn' if d_mc_abs < 0 else 'note', id_fixo='dre-margem-volume')


def custo_fixo_nivel(ctx):
    g = ctx.get('dre')
    if not g or not g.get('receita_liquida'):
        return None
    cf, rol, mc, mc_abs = -g['despesas_op'], g['receita_liquida'], g['mc_pct'], g['margem_contrib']
    if cf <= 0 or mc <= 0:
        return None
    sh = cf / rol
    if sh < .55:
        return None
    pe_v = cf / mc
    return destaque('dreCustoFixoNivel', ctx, 'consequencia', (sh - .4) * 2,
                    {'cf': cf, 'rol': rol, 'mc': mc, 'mcAbs': mc_abs, 'peV': pe_v,
                     'falta': pe_v - rol, 'buraco': cf - mc_abs, 'sh': sh},
                    tom='warn', labels=['(−) Custo Fixo', 'EBITDA'], id_fixo='dre-cf-nivel')


def custo_fixo_rol(ctx):
    g, p = ctx.get('dre'), ctx.get('drePrev')
    if not g or not p or not p.get('receita_liquida') or not g.get('receita_liquida'):
        return None
    cf_a, cf_b = -p['despesas_op'], -g['despesas_op']
    if cf_a <= 0 or cf_b <= 0:
        return None
    sh_a, sh_b = cf_a / p['receita_liquida'], cf_b / g['receita_liquida']
    if sh_b - sh_a < .03:
        return None
    d_rol = g['receita_liquida'] / p['receita_liquida'] - 1
    d_cf = cf_b / cf_a - 1
    return destaque('dreCustoFixoRol', ctx, 'divergencia', (sh_b - sh_a) * 8,
                    {'shA': sh_a, 'shB': sh_b, 'dRol': d_rol, 'dCf': d_cf,
                     'seAcompanhasse': cf_a * (1 + d_rol), 'cfB': cf_b},
                    tom='warn', id_fixo='dre-cf-rol')


def linha_que_mudou(ctx):
    g, p = ctx.get('dre'), ctx.get('drePrev')
    if not g or not p or not p.get('receita_liquida'):
        return None
    movs = [{'nome': nome, 'a': p.get(k) or 0, 'b': g.get(k) or 0, 'd': (g.get(k) or 0) - (p.get(k) or 0)}
            for nome, k in LINHAS_MOV]
    movs.sort(key=lambda m: -abs(m['d']))
    m = movs[0]
    d_result = g['result_liq'] - p['result_liq']
    if not d_result or abs(m['d']) < abs(d_result) * .3:
        return None
    ajuda = _sinal(m['d']) == _sinal(d_result)
    resto = d_result - m['d']
    engole = abs(m['d']) > abs(d_result)
    return destaque('dreLinhaQueMudou', dict(ctx, tabela=True), 'decomposicao',
                    abs(m['d']) / max(abs(d_result), 1) * .6,
                    {'nome': m['nome'], 'a': m['a'], 'b': m['b'], 'd': m['d'], 'dResult': d_result,
                     'resto': resto, 'engole': engole, 'ajuda': ajuda,
                     'outras': [{'nome': o['nome'], 'd': o['d']} for o in movs[1:3]],
                     'razao': abs(m['d'] / d_result)},
                    tom=('warn' if (engole and ajuda) else ('ok' if d_result >= 0 else 'warn')),
                    id_fixo='dre-linha-que-mudou')


def equilibrio_alavanca(ctx):
    rol, mc, cf = ctx.get('rol'), ctx.get('mc'), ctx.get('cf')
    if not rol or not mc or not cf:
        return None
    mc_pct = mc / rol
    if mc_pct <= 0 or mc_pct >= 1:
        return None
    por_real = 1 / mc_pct
    if por_real < 1.15:
        return None
    fin, dep = abs(ctx.get('financeiro') or 0), abs(ctx.get('deprec') or 0)
    return destaque('equilibrioAlavanca', ctx, 'decomposicao', (por_real - 1) / 3,
                    {'mcPct': mc_pct, 'porReal': por_real, 'cf': cf, 'receita': cf * por_real,
                     'fin': fin, 'dep': dep, 'alvo': (cf + fin + dep) * por_real},
                    id_fixo='equilibrio-alavanca')


def equilibrio_bruta(ctx):
    """R.equilibrioBruta: o equilíbrio lido na venda cheia (receita bruta), por mês."""
    rob, rob_eb, meses = ctx.get('rob'), ctx.get('robEB'), ctx.get('meses')
    if not rob or not rob_eb or not meses:
        return None
    falta_eb = rob_eb - rob
    rob_rz = ctx.get('robRZ')
    falta_rz = (rob_rz - rob) if rob_rz else None
    if falta_eb <= 0:
        return None
    mes_eb, mes_real = rob_eb / meses, rob / meses
    razao = mes_eb / mes_real
    return destaque('equilibrioBruta', ctx, 'consequencia', (razao - 1) / 1.5,
                    {'mesEB': mes_eb, 'mesReal': mes_real, 'razao': razao, 'robEB': rob_eb, 'rob': rob,
                     'meses': meses, 'faltaEB': falta_eb, 'faltaRZ': falta_rz, 'robRZ': rob_rz,
                     'peQ': ctx.get('peQ'), 'vol': ctx.get('vol')},
                    tom='warn', id_fixo='equilibrio-bruta')


def fabrica_loja(ctx):
    f, d = ctx.get('f'), ctx.get('d')
    if not f or not d or not f.get('receita_liquida') or not d.get('receita_liquida'):
        return None
    mf = f['margem_contrib'] / f['receita_liquida']
    md = d['margem_contrib'] / d['receita_liquida']
    gap = abs(mf - md)
    if gap < .06:
        return None
    a = {'n': 'Fábrica', 'm': mf, 'r': f['receita_liquida'], 'fx': -f['despesas_op']}
    b = {'n': 'Loja', 'm': md, 'r': d['receita_liquida'], 'fx': -d['despesas_op']}
    maior, menor = (a, b) if mf >= md else (b, a)
    res_maior = maior['r'] * maior['m'] - maior['fx']
    res_menor = menor['r'] * menor['m'] - menor['fx']
    inverte = res_maior < res_menor
    return destaque('dreFabricaLoja', ctx, 'oculto' if inverte else 'divergencia', gap * 4,
                    {'inverte': inverte, 'maiorN': maior['n'], 'maiorM': maior['m'], 'maiorFx': maior['fx'],
                     'menorN': menor['n'], 'menorM': menor['m'], 'menorFx': menor['fx'], 'gap': gap},
                    labels=[maior['n'], menor['n']], id_fixo='dre-fabrica-loja')


def comparativo_motor(ctx):
    C, LN = ctx.get('cols'), ctx.get('linhas')
    if not C or len(C) < 4 or not LN:
        return None
    val = lambda i, k: float(C[i][1].get(k) or 0)
    comp = [l for l in LN if l[2] != 't']
    if len(comp) < 3:
        return None
    d_mes = [{'nome': l[1], 'd': val(1, l[0]) - val(0, l[0])} for l in comp]
    d_ano = [{'nome': l[1], 'd': val(3, l[0]) - val(2, l[0])} for l in comp]
    topo = lambda a: sorted(a, key=lambda x: -abs(x['d']))[0]
    tm, ta = topo(d_mes), topo(d_ano)
    if not tm['d'] or not ta['d']:
        return None
    iguais = tm['nome'] == ta['nome']
    contra = soma(abs(x['d']) for x in d_mes if x['d'] * tm['d'] < 0)
    return destaque('dreComparativoMotor', ctx, 'decomposicao' if iguais else 'divergencia', .55,
                    {'iguais': iguais, 'nomeMes': tm['nome'], 'dMes': tm['d'],
                     'nomeAno': ta['nome'], 'dAno': ta['d'], 'contra': contra},
                    labels=[tm['nome']], id_fixo='dre-comparativo-motor')

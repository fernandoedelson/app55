# -*- coding: utf-8 -*-
"""Custo fixo (composição por categoria, blob CF) e Custo fixo mensal (razão contábil, blob CFMENSAL) —
porte de renderCustoFixoBody/renderCustoFixoEntidade e drawCustoFixoMensal/drawCustoFixoMensalAno (app.js).

Parâmetros: custofixo → ent (CONSOLIDADO|FABRICA|DESIGN); custofixo_mensal → emp, ym (AAAAMM ou YAAAA), dim (t|c).
A composição de um pacote por terceiro/conta sai só por detalhamento (params pac)."""
import math

from ..datas import ym_shift
from ..numeros import ordem_chaves_js, soma

CATS = ['Pessoal', 'Facilities', 'Consumo', 'Marketing', 'Terceiros', 'Outros']
ENTS = ('CONSOLIDADO', 'FABRICA', 'DESIGN')
PACOTES_CF = ['PESSOAL', 'FACILITIES', 'CONSUMO', 'MARKETING', 'TERCEIROS', 'OUTROS']
EMPS = ('CONSOLIDADO', 'FABRICA', 'LOJA')
CFM_DIMS = {'t': (3, 'terceiros'), 'c': (4, 'contas')}


def _janela(CF):
    m = (CF or {}).get('meses') or []
    return (m[0] + '–' + m[-1]).lower() if m else ''


def calcular(C, params=None):
    params = params or {}
    CF = C.blob('CF')
    ent = params.get('ent') if params.get('ent') in ENTS else 'CONSOLIDADO'
    out = {'custofixo.abertura': {'janela': _janela(CF), 'ent': ent}}
    cat = CF['cat_fabrica'] if ent == 'FABRICA' else CF['cat_loja'] if ent == 'DESIGN' else CF['categoria']
    meses = CF['meses']
    nM = len(meses) or 12
    tot = 0
    totais = {}
    for c in CATS:
        totais[c] = soma(cat[c])
        tot = tot + totais[c]
    pesfac = []
    for i in range(len(meses)):
        t = 0
        for c in CATS:
            t = t + ((cat[c][i] if i < len(cat[c]) else 0) or 0)
        pesfac.append((((cat['Pessoal'][i] or 0) + (cat['Facilities'][i] or 0)) / t) if t else 0)
    vol = []
    for c in CATS:
        if not (tot and totais[c] / tot >= .05):
            continue
        v = cat[c]
        m = soma(v) / (len(v) or 1)
        sd = math.sqrt(soma((x - m) * (x - m) for x in v) / (len(v) or 1))
        vol.append([c, sd / m if m > 0 else 0])
    vol.sort(key=lambda x: -x[1])
    orig = CF.get('origem') or []
    apr = [meses[i] for i in range(len(meses)) if (orig[i] if i < len(orig) else None) != 'razão']
    out['cf-cat'] = {
        'ent': ent, 'janela': _janela(CF), 'meses': meses, 'nM': nM, 'cats': {c: cat[c] for c in CATS},
        'pesfac': pesfac, 'linhas': [[c, totais[c], totais[c] / tot, totais[c] / nM] for c in CATS],
        'tot': tot, 'media': tot / nM, 'vol': vol[0] if vol else ['—', 0],
        'conc': (totais['Pessoal'] + totais['Facilities']) / tot,
        'n_apr': len([o for o in orig if o != 'razão']), 'meses_apr': apr,
    }
    E = CF['entidade']
    tf, tl = soma(E['Fábrica']), soma(E['Loja'])
    nE = len(meses) or 12
    out['cf-ent'] = {'meses': meses, 'fabrica': E['Fábrica'], 'loja': E['Loja'], 'nE': nE,
                     'linhas': [['Fábrica', tf, tf / nE, tf / (tf + tl)], ['Loja', tl, tl / nE, tl / (tf + tl)]],
                     'total': [tf + tl, (tf + tl) / nE]}
    return out


# ------------------------------------------------------------------ custo fixo mensal
def _filtros_mensal(M, params):
    emp = params.get('emp') if params.get('emp') in EMPS else 'CONSOLIDADO'
    dim = params.get('dim') if params.get('dim') in CFM_DIMS else 't'
    anos = []
    for y in M['yms']:
        if y // 100 not in anos:
            anos.append(y // 100)
    ym = M['yms'][-1]
    bruto = str(params.get('ym') or '')
    if bruto[:1] == 'Y' and bruto[1:].isdigit() and int(bruto[1:]) in anos:
        ym = bruto
    elif bruto.isdigit() and int(bruto) in M['yms']:
        ym = int(bruto)
    return emp, dim, anos, ym


def _emps(emp):
    return ['FABRICA', 'LOJA'] if emp == 'CONSOLIDADO' else [emp]


def _agg_mes(M, emp, ym, dim):
    emps = _emps(emp)
    pos, lista = CFM_DIMS[dim]
    nomes = M.get(lista) or []
    por_pac, por_pac_dim = {}, {}
    for row in M['rows']:
        if row[1] != ym or row[0] not in emps:
            continue
        pac, v = row[2], row[-1]
        por_pac[pac] = por_pac.get(pac, 0) + v
        d = por_pac_dim.setdefault(pac, {})
        nome = nomes[row[pos]] if 0 <= row[pos] < len(nomes) else 'undefined'
        d[nome] = d.get(nome, 0) + v
    return por_pac, por_pac_dim


def _agg_ano(M, emp, ano, dim):
    emps = _emps(emp)
    pos, lista = CFM_DIMS[dim]
    nomes = M.get(lista) or []
    ano_yms = [y for y in M['yms'] if y // 100 == ano]
    por_pac_mes, por_pac_dim_mes = {}, {}
    for row in M['rows']:
        y, pac, v = row[1], row[2], row[-1]
        if y // 100 != ano or row[0] not in emps:
            continue
        pm = por_pac_mes.setdefault(pac, {})
        pm[y] = pm.get(y, 0) + v
        nome = nomes[row[pos]] if 0 <= row[pos] < len(nomes) else 'undefined'
        nd = por_pac_dim_mes.setdefault(pac, {}).setdefault(nome, {})
        nd[y] = nd.get(y, 0) + v
    return ano_yms, por_pac_mes, por_pac_dim_mes


def calcular_mensal(C, params=None):
    params = params or {}
    M = C.blob('CFMENSAL')
    if not M:
        return {'custofixo_mensal.abertura': {'ausente': True}}
    if not M['yms']:
        return {'custofixo_mensal.abertura': {'vazio': True}}
    emp, dim, anos, ym = _filtros_mensal(M, params)
    out = {'custofixo_mensal.abertura': {'yms': M['yms'], 'anos': anos, 'ym': ym, 'emp': emp, 'dim': dim}}
    if isinstance(ym, str):
        ano = int(ym[1:])
        ano_yms, por_pac_mes, _ = _agg_ano(M, emp, ano, dim)
        linhas = []
        for p in PACOTES_CF:
            mv = [(por_pac_mes.get(p) or {}).get(y, 0) for y in ano_yms]
            linhas.append({'p': p, 'meses': mv, 'tot': soma(mv)})
        tot_geral = soma(r['tot'] for r in linhas)
        out['cfm-pacotes'] = {'modo': 'ano', 'emp': emp, 'dim': dim, 'ano': ano, 'yms': ano_yms, 'linhas': linhas,
                              'tot': tot_geral, 'pct': [r['tot'] / tot_geral if tot_geral else 0 for r in linhas],
                              'col_tot': [soma(r['meses'][i] for r in linhas) for i in range(len(ano_yms))]}
    else:
        prev = ym_shift(ym, -1)
        cur, _ = _agg_mes(M, emp, ym, dim)
        ant, _ = _agg_mes(M, emp, prev, dim)
        linhas = []
        for p in PACOTES_CF:
            v, pv = cur.get(p, 0), ant.get(p, 0)
            linhas.append([p, v, pv, v - pv])
        tc, tp = soma(r[1] for r in linhas), soma(r[2] for r in linhas)
        out['cfm-pacotes'] = {'modo': 'mes', 'emp': emp, 'dim': dim, 'ym': ym, 'prev': prev, 'linhas': linhas,
                              'tot': [tc, tp, tc - tp]}
    return out


def composicao_do_pacote(C, params):
    """Detalhamento: composição de um pacote por terceiro ou conta contábil (recurso 'detalhar')."""
    M = C.blob('CFMENSAL')
    emp, dim, _, ym = _filtros_mensal(M, params)
    pac = params.get('pac') if params.get('pac') in PACOTES_CF else PACOTES_CF[0]
    if isinstance(ym, str):
        ano = int(ym[1:])
        ano_yms, _, por_dim = _agg_ano(M, emp, ano, dim)
        dd = por_dim.get(pac) or {}
        linhas = []
        for n in ordem_chaves_js(dd):
            mv = [dd[n].get(y, 0) for y in ano_yms]
            linhas.append({'n': n, 'meses': mv, 'tot': soma(mv)})
        linhas.sort(key=lambda r: -r['tot'])
        tot_pac = soma(r['tot'] for r in linhas)
        acc = 0
        for r in linhas:
            r['pct'] = r['tot'] / tot_pac if tot_pac else 0
            acc = acc + r['pct']
            r['acum'] = acc
        return {'modo': 'ano', 'pac': pac, 'dim': dim, 'ano': ano, 'yms': ano_yms, 'linhas': linhas, 'tot': tot_pac,
                'col_tot': [soma(r['meses'][i] for r in linhas) for i in range(len(ano_yms))]}
    _, cur = _agg_mes(M, emp, ym, dim)
    _, ant = _agg_mes(M, emp, ym_shift(ym, -1), dim)
    ct, pt = cur.get(pac) or {}, ant.get(pac) or {}
    nomes = []
    for n in ordem_chaves_js(ct) + ordem_chaves_js(pt):
        if n not in nomes:
            nomes.append(n)
    linhas = [[n, ct.get(n, 0), pt.get(n, 0)] for n in nomes]
    linhas.sort(key=lambda r: -(r[1] - r[2]))
    t1 = t2 = 0
    for r in linhas:
        t1, t2 = t1 + r[1], t2 + r[2]
    return {'modo': 'mes', 'pac': pac, 'dim': dim, 'linhas': linhas, 'tot': [t1, t2]}

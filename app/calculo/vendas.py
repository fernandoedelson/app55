# -*- coding: utf-8 -*-
"""Agregação da base comercial — porte de aggregate() do app.js.

Cuidado de fidelidade: a soma de floats segue a MESMA ordem das linhas da base (a ordem muda os
últimos dígitos), e os agrupamentos saem na ordem em que o JavaScript os listaria — chaves numéricas
de objeto em ordem crescente —, com ordenação estável por valor. Empates decidem posições em rankings.

Colunas de DATA.rows: 0 ym · 1 valor · 2 qtd · 3 vendedor · 4 família · 5 cliente · 6 classe
· 7 designer · 8 royalty · 9..14 comissões/repasses · 15 pedido · 16 [[arquiteto, rt]] · 17 produto
· 18 previsão de entrega
"""

PSEUDO_VEND = ['TROCA', 'BONIFICACAO-', 'Não informado']


def agregar(DATA, ym_min, ym_max):
    total = 0.0
    qnt = 0.0
    peds = set()
    V, D, A, CL, FM, CLS, VF = {}, {}, {}, {}, {}, {}, {}
    comp = {'pf': 0, 'dsr': 0, 'prem': 0, 'pj': 0, 'ger': 0, 'cur': 0, 'rt': 0, 'roy': 0}
    monthly = {}

    def gv(o, k):
        if k not in o:
            o[k] = {'v': 0, 'q': 0, 'peds': set(), 'com': 0, 'extra': 0}
        return o[k]

    for r in DATA['rows']:
        ym = r[0]
        if ym < ym_min or ym > ym_max:
            continue
        v = r[1]
        total += v
        qnt += r[2]
        if r[15] >= 0:
            peds.add(r[15])
        monthly[ym] = monthly.get(ym, 0) + v
        vd = gv(V, r[3])
        vd['v'] += v
        vd['q'] += r[2]
        if r[15] >= 0:
            vd['peds'].add(r[15])
        vd['com'] += r[9] + r[10] + r[11] + r[12]
        FM[r[4]] = FM.get(r[4], 0) + v
        CL[r[5]] = CL.get(r[5], 0) + v
        CLS[r[6]] = CLS.get(r[6], 0) + v
        VF.setdefault(r[3], {})
        VF[r[3]][r[4]] = VF[r[3]].get(r[4], 0) + v
        if r[7] >= 0:
            d = gv(D, r[7])
            d['v'] += v
            d['extra'] += r[8]
            if r[15] >= 0:
                d['peds'].add(r[15])
        na = len(r[16])
        for a in r[16]:
            ar = gv(A, a[0])
            ar['extra'] += a[1]
            ar['v'] += v / na
            if r[15] >= 0:
                ar['peds'].add(r[15])
        comp['pf'] += r[9]
        comp['dsr'] += r[10]
        comp['prem'] += r[11]
        comp['pj'] += r[12]
        comp['ger'] += r[13]
        comp['cur'] += r[14]
        comp['roy'] += r[8]
        for a in r[16]:
            comp['rt'] += a[1]

    ped_n = len(peds)
    ordem = lambda d: sorted(d)                 # chaves numéricas: ordem crescente, como Object.keys
    desc = lambda lst, campo: sorted(lst, key=lambda x: -x[campo])

    vend = desc([{'name': DATA['vd'][k], 'idx': k, 'v': o['v'], 'q': o['q'], 'peds': len(o['peds']), 'com': o['com'],
                  'ticket': o['v'] / len(o['peds']) if o['peds'] else 0, 'titem': o['v'] / o['q'] if o['q'] else 0,
                  'contrib': o['v'] / total if total else 0, 'custop': o['com'] / o['v'] if o['v'] else 0}
                 for k in ordem(V) for o in [V[k]]], 'v')
    desg = desc([{'name': DATA['ds'][k], 'roy': D[k]['extra'], 'v': D[k]['v'], 'peds': len(D[k]['peds'])} for k in ordem(D)], 'roy')
    arqs = desc([{'name': DATA['arq'][k], 'rt': A[k]['extra'], 'v': A[k]['v'], 'peds': len(A[k]['peds'])} for k in ordem(A)], 'rt')
    fams = desc([{'name': DATA['fam'][k], 'v': FM[k]} for k in ordem(FM)], 'v')
    clis = desc([{'name': DATA['cl'][k], 'idx': k, 'v': CL[k]} for k in ordem(CL)], 'v')
    clss = desc([{'name': DATA['cls'][k], 'v': CLS[k]} for k in ordem(CLS)], 'v')
    return {'total': total, 'qnt': qnt, 'peds': ped_n, 'ticket': total / ped_n if ped_n else 0, 'vend': vend,
            'desg': desg, 'arqs': arqs, 'fams': fams, 'clis': clis, 'clss': clss, 'comp': comp,
            'monthly': monthly, 'VF': VF}


def concentracao(lista, total, alvo):
    """Quantos itens do topo de uma lista já ordenada concentram `alvo` do total (Pareto)."""
    if not total or total <= 0 or not lista:
        return None
    acum = 0
    for i, x in enumerate(lista):
        acum += x['v']
        if acum / total >= alvo:
            return {'n': i + 1, 'acum': acum, 'share': acum / total}
    return None


def tabela_clientes(clis, total, minimo=10, maximo=30, alvo=.8):
    """Dados de tabelaClientes() do app.js: as linhas exibidas e o corte de Pareto.
    Só as linhas que aparecem saem do servidor — o resto da carteira vira contagem e participação."""
    corte = concentracao(clis, total, alvo)
    n = min(len(clis), max(minimo, min(corte['n'] if corte else minimo, maximo)))
    linhas = clis[:n]
    acum = 0
    for x in linhas:
        acum += x['v']
    return {'linhas': [{'name': x['name'], 'idx': x['idx'], 'v': x['v']} for x in linhas], 'n': n,
            'corte': corte, 'mostrado': acum, 'restantes': len(clis) - n,
            'truncado': bool(corte and n < corte['n']), 'share': acum / total if total else 0, 'total': total}


def cliente_itens(DATA, cli_idx, ym_min, ym_max):
    itens = [[DATA['prod'][r[17]], r[2], r[1], r[18]] for r in DATA['rows']
             if r[5] == cli_idx and ym_min <= r[0] <= ym_max]
    itens.sort(key=lambda it: -it[2])
    return itens

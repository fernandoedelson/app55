# -*- coding: utf-8 -*-
"""Regras da seção Vendedor × Arquiteto — porte de R.arqCanal, R.arqDependencia, R.arqExclusividade,
R.arqMatriz, R.arqParados, R.rfvArqSegmentos, R.rfvArqTabela, R.rfvArqPorVendedor e R.rfvArqQualidade."""
from ..calculo.numeros import ordem_chaves_js, soma
from .nucleo import destaque, nucleo_material


def canal(ctx):
    V = ctx.get('vend') or []
    if len(V) < 3:
        return None
    nucleo = nucleo_material(V, 'v', .85, 3)
    if len(nucleo) < 2:
        return None
    ordem = sorted(nucleo, key=lambda x: -x['share'])
    alto, baixo = ordem[0], ordem[-1]
    dispersao = alto['share'] - baixo['share']
    geral = ctx.get('share') or 0
    uniforme = dispersao < .2 and geral >= .7
    if dispersao < .2 and not uniforme:
        return None
    com_a = [x for x in nucleo if x['pedsA'] > 0 and x['ticketA'] > 0]
    t_a = soma(x['vArq'] for x in com_a) / max(soma(x['pedsA'] for x in com_a), 1)
    com_s = [x for x in nucleo if (x['pedsT'] - x['pedsA']) > 0]
    t_s = soma(x['vSem'] for x in com_s) / max(soma(x['pedsT'] - x['pedsA'] for x in com_s), 1)
    razao = t_a / t_s if t_s else 0
    return destaque('arqCanal', ctx, 'divergencia', geral if uniforme else dispersao * 1.5,
                    {'uniforme': uniforme, 'geral': geral, 'alto': alto['name'], 'shAlto': alto['share'],
                     'baixo': baixo['name'], 'shBaixo': baixo['share'], 'tA': t_a, 'tS': t_s,
                     'razao': razao, 'dispersao': dispersao},
                    tom='warn' if uniforme else 'note',
                    labels=[alto['name'][:14], baixo['name'][:14]], id_fixo='arq-canal')


def dependencia(ctx):
    V = [x for x in (ctx.get('vend') or []) if x['nArq'] >= 2 and x['vArq'] > 0]
    if len(V) < 2:
        return None
    nucleo = nucleo_material(V, 'vArq', .85, 2)
    if len(nucleo) < 2:
        return None
    frag = sorted((dict(x, conc=(x['k50'] / x['nArq'] if x['nArq'] else 1)) for x in nucleo),
                  key=lambda x: x['conc'])
    pior = frag[0]
    if pior['conc'] > .25:
        return None
    A = ctx.get('arqs') or []
    do_pior = [a for a in A if a['dono'] == pior['name'] and a['exclusivo']]
    return destaque('arqDependencia', dict(ctx, tabela=True), 'concentracao', 1 - pior['conc'] * 3,
                    {'nome': pior['name'], 'k50': pior['k50'], 'nArq': pior['nArq'], 'shTop': pior['shTop'],
                     'topArq': pior.get('topArq'), 'nExcl': len(do_pior),
                     'vExcl': soma(a['v'] for a in do_pior), 'conc': pior['conc']},
                    tom='warn', id_fixo='arq-dependencia')


def exclusividade(ctx):
    A = ctx.get('arqs') or []
    if len(A) < 5:
        return None
    nucleo = nucleo_material(A, 'v', .8, 5)
    excl = [x for x in nucleo if x['shDono'] >= .9]
    v_excl, v_tot = soma(x['v'] for x in excl), soma(x['v'] for x in nucleo)
    if not v_tot or len(excl) < 2:
        return None
    sh = v_excl / v_tot
    if sh < .3:
        return None
    compart = [x for x in nucleo if x['nVend'] >= 2]
    peds_e = soma(x['peds'] for x in excl)
    peds_c = soma(x['peds'] for x in compart)
    return destaque('arqExclusividade', dict(ctx, tabela=True), 'oculto', sh,
                    {'nExcl': len(excl), 'vExcl': v_excl, 'sh': sh, 'nCompart': len(compart),
                     'vCompart': soma(x['v'] for x in compart),
                     'tkE': v_excl / peds_e if peds_e else 0,
                     'tkC': soma(x['v'] for x in compart) / peds_c if peds_c else 0},
                    tom='warn', id_fixo='arq-exclusividade')


def matriz(ctx):
    L, Cs, M = ctx.get('linhas') or [], ctx.get('colunas') or [], ctx.get('mat') or {}
    if len(L) < 3 or len(Cs) < 3:
        return None
    val = lambda l, c: ((M.get(l) or {}).get(c) or 0)
    pares = soma(1 for c in Cs for l in L if val(l, c) > 0)
    dens = pares / (len(L) * len(Cs))
    if dens > .5:
        return None
    por_col = sorted(({'c': c, 'q': len([l for l in L if val(l, c) > 0]), 'v': soma(val(l, c) for l in L)}
                      for c in Cs), key=lambda x: -x['v'])
    por_col = [x for x in por_col if x['v'] > 0]
    if not por_col:
        return None
    circula = sorted(por_col, key=lambda x: -x['q'])[0]
    presos = [x for x in por_col if x['q'] == 1]
    return destaque('arqMatriz', ctx, 'oculto', 1 - dens,
                    {'dens': dens, 'nPresos': len(presos), 'nCol': len(por_col),
                     'todosPresos': len(presos) == len(por_col), 'circula': circula['c'],
                     'qCircula': circula['q'], 'vCircula': circula['v']},
                    labels=[circula['c']], id_fixo='arq-matriz')


def parados(ctx):
    P, A, tot_a = ctx.get('parados'), ctx.get('arqs'), ctx.get('totA')
    if not P or len(P) < 3 or not A or not tot_a:
        return None
    v = soma(x['v'] for x in P)
    donos = {}
    for x in P:
        if x.get('dono'):
            donos[x['dono']] = donos.get(x['dono'], 0) + x['v']
    rank = sorted(((d, donos[d]) for d in ordem_chaves_js(donos)), key=lambda x: -x[1])
    return destaque('arqParados', dict(ctx, tabela=True), 'consequencia', v / tot_a * 3,
                    {'n': len(P), 'v': v, 'sh': v / tot_a, 'mesesMed': soma(x['r'] for x in P) / len(P),
                     'ativos': len([x for x in A if x['r'] < 6]),
                     'dono': rank[0][0] if rank else None, 'vDono': rank[0][1] if rank else 0,
                     'shDono': (rank[0][1] / v) if rank and v else 0},
                    tom='warn', id_fixo='arq-parados')


def rfv_segmentos(ctx):
    S, tot, it = ctx.get('segs'), ctx.get('total'), ctx.get('itens')
    if not S or not tot or not it:
        return None
    bons = [x for x in S if x['seg'] in ('Campeões', 'Fiéis')]
    maus = [x for x in S if x['seg'] in ('Em risco', 'Hibernando', 'Perdidos')]
    if not bons and not maus:
        return None
    v_b, n_b = soma(x['v'] for x in bons), soma(x['n'] for x in bons)
    v_m, n_m = soma(x['v'] for x in maus), soma(x['n'] for x in maus)
    if not n_b and not n_m:
        return None
    return destaque('rfvArqSegmentos', ctx, 'concentracao', v_m / tot + v_b / tot,
                    {'nB': n_b, 'vB': v_b, 'nM': n_m, 'vM': v_m, 'N': len(it), 'tot': tot,
                     'fB': (soma(x['f'] * x['n'] for x in bons) / n_b) if n_b else 0,
                     'rM': (soma(x['r'] * x['n'] for x in maus) / n_m) if n_m else 0},
                    tom='warn' if v_m > v_b else 'note',
                    labels=['Campeões', 'Fiéis', 'Em risco', 'Hibernando'], id_fixo='rfv-arq-segmentos')


def rfv_tabela(ctx):
    it, tot, S = ctx.get('itens'), ctx.get('total'), ctx.get('segs')
    if not it or not tot:
        return None
    uma_vez = [x for x in it if x['f'] <= 1]
    repete = [x for x in it if x['f'] > 1]
    if not repete:
        return None
    sh_uma = len(uma_vez) / len(it)
    v_uma = soma(x['v'] for x in uma_vez) / tot
    m_uma = (soma(x['v'] for x in uma_vez) / len(uma_vez)) if uma_vez else 0
    m_rep = soma(x['v'] for x in repete) / len(repete)
    return destaque('rfvArqTabela', dict(ctx, tabela=True), 'oculto', sh_uma,
                    {'shUma': sh_uma, 'vUma': v_uma, 'nUma': len(uma_vez), 'nRepete': len(repete),
                     'mUma': m_uma, 'mRep': m_rep,
                     'segs': [{'seg': x['seg'], 'n': x['n'], 'v': x['v'], 'r': x['r'],
                               'rMin': x.get('rMin'), 'rMax': x.get('rMax')} for x in (S or [])]},
                    tom='warn' if sh_uma > .6 else 'note', id_fixo='rfv-arq-recompra')


def rfv_por_vendedor(ctx):
    L = ctx.get('linhas')
    if not L or len(L) < 2:
        return None
    nucleo = nucleo_material(L, 'v', .85, 2)
    if len(nucleo) < 2:
        return None
    ordem = sorted(nucleo, key=lambda x: -x['shBons'])
    bom, ruim = ordem[0], ordem[-1]
    if bom['shBons'] - ruim['shBons'] < .2:
        return None
    return destaque('rfvArqPorVendedor', ctx, 'oculto', bom['shBons'] - ruim['shBons'],
                    {'bom': bom['d'], 'shBom': bom['shBons'], 'nBom': bom['n'], 'pedBom': bom['pedArq'],
                     'ruim': ruim['d'], 'shRuim': ruim['shBons'], 'nRuim': ruim['n'],
                     'pedRuim': ruim['pedArq'], 'shRuins': ruim['shRuins'], 'vRuins': ruim['vRuins'],
                     'amp': bom['shBons'] - ruim['shBons']},
                    labels=[bom['d'][:14], ruim['d'][:14]], id_fixo='rfv-arq-por-vendedor')


def rfv_qualidade(ctx):
    L = ctx.get('linhas')
    if not L or len(L) < 3:
        return None
    nucleo = nucleo_material(L, 'v', .85, 3)
    if len(nucleo) < 2:
        return None
    ordem = sorted(nucleo, key=lambda x: -x['pedArq'])
    alto, baixo = ordem[0], ordem[-1]
    if not baixo['pedArq'] or alto['pedArq'] / baixo['pedArq'] < 1.4:
        return None
    razao = alto['pedArq'] / baixo['pedArq']
    return destaque('rfvArqQualidade', dict(ctx, tabela=True), 'divergencia', (razao - 1) / 2,
                    {'alto': alto['d'], 'pedAlto': alto['pedArq'], 'nAlto': alto['n'],
                     'baixo': baixo['d'], 'pedBaixo': baixo['pedArq'], 'nBaixo': baixo['n'],
                     'razao': razao, 'pedFalta': (alto['pedArq'] - baixo['pedArq']) * baixo['n']},
                    id_fixo='rfv-arq-qualidade')

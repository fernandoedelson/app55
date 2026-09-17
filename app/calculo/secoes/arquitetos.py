# -*- coding: utf-8 -*-
"""Vendedor × Arquiteto — porte de arqAgg(), segmentaRFV(), renderArquitetos() e blocoRfvArquitetos()
(app.js). Parâmetro: janela (6|12|24). A carteira de um vendedor e os arquitetos de um segmento do RFV
saem por detalhamento."""
import math

from ..datas import ym_shift
from ..numeros import ordem_chaves_js, soma
from .analise_vendas import ORDEM_SEG, _dif_meses, _janela, _linha_comercial

SEG_BONS = ('Campeões', 'Fiéis')
SEG_RUINS = ('Em risco', 'Hibernando', 'Perdidos')


def _quantos_para(vals, fatia):
    tot = soma(vals)
    if not tot:
        return 0
    acc = k = 0
    for v in vals:
        acc += v
        k += 1
        if acc >= tot * fatia:
            break
    return k


def arq_agg(DATA, ym_min, ym_max):
    ARQ, VEND, MAT = {}, {}, {}
    for r in DATA['rows']:
        if r[0] < ym_min or r[0] > ym_max or not _linha_comercial(DATA, r):
            continue
        vn = DATA['vd'][r[3]]
        V = VEND.get(vn)
        if V is None:
            V = VEND[vn] = {'v': 0, 'vArq': 0, 'pedsT': set(), 'pedsA': set(), 'arqs': {}, 'rt': 0, 'qA': 0, 'qT': 0}
        V['v'] += r[1]
        V['qT'] += r[2]
        if r[15] >= 0:
            V['pedsT'].add(r[15])
        lista = r[16] or []
        if not lista:
            continue
        cota = r[1] / len(lista)
        V['vArq'] += r[1]
        V['qA'] += r[2]
        if r[15] >= 0:
            V['pedsA'].add(r[15])
        for ai, rt in lista:
            an = DATA['arq'][ai]
            A = ARQ.get(an)
            if A is None:
                A = ARQ[an] = {'v': 0, 'rt': 0, 'peds': set(), 'vend': {}, 'clis': set(), 'ult': 0, 'prim': 999999}
            A['v'] += cota
            A['rt'] += rt
            A['clis'].add(r[5])
            if r[15] >= 0:
                A['peds'].add(r[15])
            A['vend'][vn] = A['vend'].get(vn, 0) + cota
            if r[0] > A['ult']:
                A['ult'] = r[0]
            if r[0] < A['prim']:
                A['prim'] = r[0]
            V['arqs'][an] = V['arqs'].get(an, 0) + cota
            V['rt'] += rt
            MAT.setdefault(vn, {})
            MAT[vn][an] = MAT[vn].get(an, 0) + cota
    arqs = []
    for k in ordem_chaves_js(ARQ):
        o = ARQ[k]
        donos = sorted(ordem_chaves_js(o['vend']), key=lambda d: -o['vend'][d])
        arqs.append({'name': k, 'v': o['v'], 'rt': o['rt'], 'peds': len(o['peds']), 'clis': len(o['clis']),
                     'nVend': len(donos), 'dono': donos[0] if donos else None,
                     'shDono': o['vend'][donos[0]] / o['v'] if o['v'] else 0, 'exclusivo': len(donos) == 1,
                     'taxa': o['rt'] / o['v'] if o['v'] else 0, 'ticket': o['v'] / len(o['peds']) if o['peds'] else 0,
                     'r': _dif_meses(o['ult'], ym_max), 'vida': _dif_meses(o['prim'], o['ult'])})
    arqs = sorted((x for x in arqs if x['v'] > 0), key=lambda x: -x['v'])
    vend = []
    for k in ordem_chaves_js(VEND):
        o = VEND[k]
        arq_ord = sorted(({'a': a, 'v': o['arqs'][a]} for a in ordem_chaves_js(o['arqs'])), key=lambda x: -x['v'])
        n_pt, n_pa = len(o['pedsT']), len(o['pedsA'])
        vend.append({'name': k, 'v': o['v'], 'vArq': o['vArq'], 'vSem': o['v'] - o['vArq'],
                     'share': o['vArq'] / o['v'] if o['v'] else 0, 'nArq': len(arq_ord),
                     'k50': _quantos_para([x['v'] for x in arq_ord], .5),
                     'shTop': arq_ord[0]['v'] / o['vArq'] if o['vArq'] and arq_ord else 0,
                     'pedsT': n_pt, 'pedsA': n_pa,
                     'ticketA': o['vArq'] / n_pa if n_pa else 0,
                     'ticketS': (o['v'] - o['vArq']) / (n_pt - n_pa) if (n_pt - n_pa) else 0,
                     'rt': o['rt'], 'taxa': o['rt'] / o['vArq'] if o['vArq'] else 0})
    vend = sorted((x for x in vend if x['v'] > 0), key=lambda x: -x['v'])
    tot_v, tot_a = soma(x['v'] for x in vend), soma(x['vArq'] for x in vend)
    return {'arqs': arqs, 'vend': vend, 'mat': MAT, 'totV': tot_v, 'totA': tot_a,
            'share': tot_a / tot_v if tot_v else 0}


def segmenta_rfv(itens):
    """segmentaRFV() do app.js: itens com v (valor), f (frequência) e r (recência)."""
    L = [x for x in itens if x['v'] > 0]
    if len(L) < 5:
        return None

    def quintil(campo, alvo, inverso=False):
        ordem = sorted(L, key=(lambda x: x[campo]) if inverso else (lambda x: -x[campo]))
        n = len(ordem)
        for i, x in enumerate(ordem):
            x[alvo] = 5 - min(4, math.floor(i / (n / 5)))

    quintil('v', 'sv')
    quintil('f', 'sf')
    quintil('r', 'sr', True)
    for x in L:
        R, F, V = x['sr'], x['sf'], x['sv']
        x['seg'] = ('Campeões' if R >= 4 and F >= 4 and V >= 4 else
                    'Fiéis' if R >= 3 and F >= 3 else
                    'Em risco' if R <= 2 and V >= 4 else
                    'Hibernando' if R <= 2 and F >= 3 else
                    'Novos / únicos' if R >= 4 and F <= 2 else
                    'Perdidos' if R <= 2 else 'Ocasionais')
    agg = {s: {'n': 0, 'v': 0, 'f': 0, 'r': 0} for s in ORDEM_SEG}
    for x in L:
        a = agg[x['seg']]
        a['n'] += 1
        a['v'] += x['v']
        a['f'] += x['f']
        a['r'] += x['r']
    segs = [{'seg': s, 'n': agg[s]['n'], 'v': agg[s]['v'], 'f': agg[s]['f'] / agg[s]['n'], 'r': agg[s]['r'] / agg[s]['n']}
            for s in ORDEM_SEG if agg[s]['n']]
    return {'itens': L, 'segs': segs, 'total': soma(x['v'] for x in L)}


def _rfv(A):
    return segmenta_rfv([dict(x, f=x['peds']) for x in A['arqs']])


def calcular(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    janela, fim = _janela(params), C.maxym_vendas
    A = arq_agg(DATA, ym_shift(fim, -(janela - 1)), fim)
    out = {'arquitetos.abertura': {'janela': janela, 'fim': fim}}
    if not A['arqs']:
        out['arquitetos.abertura']['vazio'] = True
        return out
    exclusivos = [x for x in A['arqs'] if x['exclusivo']]
    rt = soma(x['rt'] for x in A['arqs'])
    out['aq-peso'] = {'janela': janela, 'fim': fim, 'totA': A['totA'], 'share': A['share'], 'n': len(A['arqs']),
                      'rt': rt, 'rt_pct': rt / A['totA'] if A['totA'] else 0,
                      'excl': len(exclusivos), 'excl_pct': len(exclusivos) / len(A['arqs']) if A['arqs'] else 0}
    out['aq-dependencia'] = {'nomes': [x['name'] for x in A['vend']], 'arq': [x['vArq'] for x in A['vend']],
                             'sem': [x['vSem'] for x in A['vend']], 'share': [x['share'] for x in A['vend']]}
    out['aq-quantos'] = {'linhas': [[x['name'], x['v'], x['share'], x['nArq'], x['k50'], x['shTop'],
                                     x['ticketA'] if x['pedsA'] else None,
                                     x['ticketS'] if (x['pedsT'] - x['pedsA']) > 0 else None] for x in A['vend']]}
    top_v = [x['name'] for x in A['vend'] if x['vArq'] > 0][:7]
    top_a = [x['name'] for x in A['arqs'][:7]]
    out['aq-matriz'] = {'linhas': top_v, 'colunas': top_a,
                        'mat': [[(A['mat'].get(vn) or {}).get(an) or 0 for an in top_a] for vn in top_v]}
    out['aq-lista'] = {'top': [[x['name'], x['v']] for x in A['arqs'][:14]], 'total': soma(x['v'] for x in A['arqs']),
                       'linhas': [[x['name'], x['v'], x['rt'], x['taxa'], x['peds'], x['clis'], x['dono'], x['shDono'], x['r']]
                                  for x in A['arqs'][:20]]}
    parados = sorted((x for x in A['arqs'] if x['r'] >= 6), key=lambda x: -x['v'])[:12]
    if parados:
        out['aq-parados'] = {'linhas': [[x['name'], x['v'], x['peds'], x['r'], x['dono']] for x in parados]}
    R = _rfv(A)
    if R:
        itens = R['itens']
        out['aq-rfv'] = {'total': R['total'], 'n': len(itens),
                         'segs': [[s['seg'], s['n'], s['n'] / len(itens), s['v'], s['v'] / R['total'], s['f'], s['r']]
                                  for s in R['segs']],
                         'f_medio': soma(x['f'] for x in itens) / len(itens),
                         'r_medio': soma(x['r'] for x in itens) / len(itens)}
        por = {}
        for x in itens:
            d = x['dono']
            if not d:
                continue
            o = por.get(d)
            if o is None:
                o = por[d] = {'n': 0, 'v': 0, 'bons': 0, 'vBons': 0, 'ruins': 0, 'vRuins': 0, 'peds': 0, 'r': 0}
            o['n'] += 1
            o['v'] += x['v']
            o['peds'] += x['f']
            o['r'] += x['r']
            if x['seg'] in SEG_BONS:
                o['bons'] += 1
                o['vBons'] += x['v']
            if x['seg'] in SEG_RUINS:
                o['ruins'] += 1
                o['vRuins'] += x['v']
        linhas = []
        for d in ordem_chaves_js(por):
            o = por[d]
            linhas.append({'d': d, 'n': o['n'], 'v': o['v'], 'bons': o['bons'], 'vBons': o['vBons'], 'ruins': o['ruins'],
                           'vRuins': o['vRuins'], 'shBons': o['vBons'] / o['v'] if o['v'] else 0,
                           'shRuins': o['vRuins'] / o['v'] if o['v'] else 0,
                           'pedArq': o['peds'] / o['n'] if o['n'] else 0, 'rMed': o['r'] / o['n'] if o['n'] else 0,
                           'ticket': o['v'] / o['peds'] if o['peds'] else 0})
        linhas = sorted((x for x in linhas if x['n'] >= 2), key=lambda x: -x['v'])
        if linhas:
            out['aq-perf'] = {
                'nomes': [x['d'] for x in linhas], 'bons': [x['vBons'] for x in linhas],
                'meio': [x['v'] - x['vBons'] - x['vRuins'] for x in linhas], 'ruins': [x['vRuins'] for x in linhas],
                'sub': [x['shBons'] for x in linhas],
                'linhas': [[x['d'], x['n'], x['v'], x['bons'], x['shBons'], x['ruins'], x['shRuins'], x['pedArq'],
                            x['ticket']] for x in linhas]}
    return out


def arquitetos_do_vendedor(C, params):
    """Detalhamento: a carteira de arquitetos de um vendedor (recurso 'detalhar')."""
    DATA = C.blob('DATA')
    janela, fim = _janela(params), C.maxym_vendas
    A = arq_agg(DATA, ym_shift(fim, -(janela - 1)), fim)
    vn = params.get('vend')
    m = A['mat'].get(vn) or {}
    porn = {x['name']: x for x in A['arqs']}
    lista = sorted(({'a': a, 'v': m[a], 'o': porn.get(a)} for a in ordem_chaves_js(m)), key=lambda x: -x['v'])
    tot = soma(x['v'] for x in lista)
    acc, linhas = 0, []
    for x in lista:
        acc += x['v']
        o = x['o']
        linhas.append([x['a'], x['v'], x['v'] / tot if tot else 0, acc / tot if tot else 0,
                       bool(o and o['exclusivo']), o['nVend'] if o else 1, o['taxa'] if o else 0,
                       o['r'] if o else None])
    return {'vend': vn, 'total': tot, 'linhas': linhas}


def arquitetos_do_segmento(C, params):
    """Detalhamento: arquitetos de um segmento do RFV (recurso 'detalhar')."""
    DATA = C.blob('DATA')
    janela, fim = _janela(params), C.maxym_vendas
    R = _rfv(arq_agg(DATA, ym_shift(fim, -(janela - 1)), fim))
    seg = params.get('seg')
    lista = sorted((x for x in (R['itens'] if R else []) if x['seg'] == seg), key=lambda x: -x['v'])
    tot = soma(x['v'] for x in lista)
    acc, linhas = 0, []
    for x in lista:
        acc += x['v']
        linhas.append([x['name'], x['v'], x['f'], x['r'], x['taxa'], x['dono'], x['exclusivo'], acc / tot if tot else 0])
    return {'seg': seg, 'total': tot, 'linhas': linhas}

# -*- coding: utf-8 -*-
"""Análise de Vendas (seção 'vendas') — porte de comercialAgg(), rfvClientes() e renderAnaliseVendas()
(app.js). Parâmetro: janela (6|12|24 meses). Os clientes de um segmento do RFV saem só por detalhamento."""
import math

from ..datas import ym_shift
from ..numeros import ordem_chaves_js, soma

CLS_FORA = ['CANCELADO', 'BONIFICACAO', 'PERMUTA', 'SHOWROOM', 'SHOW ROOM']
VEND_FORA = ['TROCA', 'BONIFICACAO', 'EXPORTACAO', 'REVENDA', 'NAO INFORMADO', 'NÃO INFORMADO']
ORDEM_SEG = ['Campeões', 'Fiéis', 'Em risco', 'Novos / únicos', 'Ocasionais', 'Hibernando', 'Perdidos']


def _linha_comercial(DATA, r):
    cls = (DATA['cls'][r[6]] or '').upper()
    if any(c in cls for c in CLS_FORA):
        return False
    vn = (DATA['vd'][r[3]] or '').upper()
    if any(p in vn for p in VEND_FORA):
        return False
    return r[1] > 0


def comercial_agg(DATA, ym_min, ym_max):
    V = {}
    for r in DATA['rows']:
        if r[0] < ym_min or r[0] > ym_max or not _linha_comercial(DATA, r):
            continue
        o = V.get(r[3])
        if o is None:
            o = V[r[3]] = {'v': 0, 'q': 0, 'peds': set(), 'clis': set(), 'com': 0, 'fam': {}}
        o['v'] += r[1]
        o['q'] += r[2]
        if r[15] >= 0:
            o['peds'].add(r[15])
        o['clis'].add(r[5])
        o['com'] += r[9] + r[10] + r[11] + r[12]
        fn = DATA['fam'][r[4]]
        o['fam'][fn] = o['fam'].get(fn, 0) + r[1]
    vend = []
    for k in ordem_chaves_js(V):
        o = V[k]
        peds, clis = len(o['peds']), len(o['clis'])
        vend.append({'name': DATA['vd'][k], 'v': o['v'], 'q': o['q'], 'peds': peds, 'clis': clis, 'com': o['com'],
                     'fam': o['fam'], 'ticket': o['v'] / peds if peds else 0, 'titem': o['v'] / o['q'] if o['q'] else 0,
                     'itensPed': o['q'] / peds if peds else 0, 'pedCli': peds / clis if clis else 0,
                     'vCli': o['v'] / clis if clis else 0, 'custop': o['com'] / o['v'] if o['v'] else 0})
    vend = sorted((x for x in vend if x['v'] > 0), key=lambda x: -x['v'])
    tot = soma(x['v'] for x in vend)
    for x in vend:
        x['share'] = x['v'] / tot if tot else 0
    return vend, tot


def _dif_meses(a, b):
    return (b // 100 - a // 100) * 12 + (b % 100) - (a % 100)


def rfv_clientes(DATA, ym_max, meses):
    ini = ym_shift(ym_max, -(meses - 1))
    C = {}
    for r in DATA['rows']:
        if r[0] < ini or r[0] > ym_max or not _linha_comercial(DATA, r):
            continue
        o = C.get(r[5])
        if o is None:
            o = C[r[5]] = {'v': 0, 'peds': set(), 'ult': 0, 'prim': 999999, 'vend': {}}
        o['v'] += r[1]
        if r[15] >= 0:
            o['peds'].add(r[15])
        if r[0] > o['ult']:
            o['ult'] = r[0]
        if r[0] < o['prim']:
            o['prim'] = r[0]
        vn = DATA['vd'][r[3]]
        o['vend'][vn] = o['vend'].get(vn, 0) + r[1]
    cli = []
    for k in ordem_chaves_js(C):
        o = C[k]
        donos = sorted(ordem_chaves_js(o['vend']), key=lambda x: -o['vend'][x])
        cli.append({'name': DATA['cl'][k], 'v': o['v'], 'f': len(o['peds']), 'r': _dif_meses(o['ult'], ym_max),
                    'vida': _dif_meses(o['prim'], o['ult']), 'dono': donos[0] if donos else None})
    cli = [x for x in cli if x['v'] > 0]
    if not cli:
        return None

    def quintil(campo, inverso=False):
        ordem = sorted(cli, key=(lambda x: x[campo]) if inverso else (lambda x: -x[campo]))
        n = len(ordem)
        for i, x in enumerate(ordem):
            x['s' + campo] = 5 - min(4, math.floor(i / (n / 5)))

    quintil('v')
    quintil('f')
    quintil('r', True)
    for x in cli:
        R, F, Vs = x['sr'], x['sf'], x['sv']
        x['seg'] = ('Campeões' if R >= 4 and F >= 4 and Vs >= 4 else
                    'Fiéis' if R >= 3 and F >= 3 else
                    'Em risco' if R <= 2 and Vs >= 4 else
                    'Hibernando' if R <= 2 and F >= 3 else
                    'Novos / únicos' if R >= 4 and F <= 2 else
                    'Perdidos' if R <= 2 else 'Ocasionais')
    segs = {s: {'n': 0, 'v': 0, 'f': 0, 'r': 0, 'rMin': 999, 'rMax': 0} for s in ORDEM_SEG}
    for x in cli:
        s = segs[x['seg']]
        s['n'] += 1
        s['v'] += x['v']
        s['f'] += x['f']
        s['r'] += x['r']
        if x['r'] < s['rMin']:
            s['rMin'] = x['r']
        if x['r'] > s['rMax']:
            s['rMax'] = x['r']
    # rMin/rMax: a faixa de recência do segmento — a régua de destaque escreve "pararam há quanto tempo"
    lista = [{'seg': s, 'n': segs[s]['n'], 'v': segs[s]['v'], 'f': segs[s]['f'] / segs[s]['n'],
              'r': segs[s]['r'] / segs[s]['n'],
              'rMin': 0 if segs[s]['rMin'] == 999 else segs[s]['rMin'], 'rMax': segs[s]['rMax']}
             for s in ORDEM_SEG if segs[s]['n']]
    return {'cli': cli, 'segs': lista, 'total': soma(x['v'] for x in cli), 'meses': meses}


def _janela(params):
    try:
        j = int(params.get('janela') or 12)
    except (TypeError, ValueError):
        j = 12
    return j if j in (6, 12, 24) else 12


def calcular(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    janela, fim = _janela(params), C.maxym_vendas
    ini = ym_shift(fim, -(janela - 1))
    vend, total = comercial_agg(DATA, ini, fim)
    out = {'vendas.abertura': {'janela': janela, 'fim': fim}}
    if not vend:
        out['vendas.abertura']['vazio'] = True
        return out
    lider, demais = vend[0], vend[1:]
    tot_demais = soma(x['v'] for x in demais)
    s_peds, s_q = soma(x['peds'] for x in demais), soma(x['q'] for x in demais)
    s_clis, s_com = soma(x['clis'] for x in demais), soma(x['com'] for x in demais)
    med = {'v': tot_demais / len(demais) if demais else 0, 'ticket': tot_demais / s_peds if s_peds else 0,
           'titem': tot_demais / s_q if s_q else 0, 'itensPed': s_q / s_peds if s_peds else 0,
           'pedCli': s_peds / s_clis if s_clis else 0, 'vCli': tot_demais / s_clis if s_clis else 0,
           'custop': s_com / tot_demais if tot_demais else 0}
    out['av-time'] = {'janela': janela, 'fim': fim, 'total': total, 'n': len(vend), 'lider': lider['name'],
                      'share': lider['share'], 'ticket': total / soma(x['peds'] for x in vend),
                      'custo': soma(x['com'] for x in vend) / total}
    campos = ['v', 'ticket', 'titem', 'itensPed', 'pedCli', 'vCli', 'custop']
    out['av-lider'] = {'lider': lider['name'], 'l': [lider[k] for k in campos], 'd': [med[k] for k in campos]}
    fatores = [['Clientes atendidos', lider['clis'], soma(x['clis'] for x in demais) / len(demais) if demais else 0],
               ['Pedidos por cliente', lider['pedCli'], med['pedCli']],
               ['Valor médio do pedido', lider['ticket'], med['ticket']]]
    out['av-diferenca'] = {'barras': [[f[0], f[1] / f[2] - 1 if f[2] else 0] for f in fatores]}
    top_v = [x['name'] for x in vend[:7]]
    fam_tot = {}
    for x in vend:
        for f in ordem_chaves_js(x['fam']):
            fam_tot[f] = fam_tot.get(f, 0) + x['fam'][f]
    top_f = sorted((f for f in ordem_chaves_js(fam_tot) if f != 'Frete/Serviço'), key=lambda f: -fam_tot[f])[:8]
    mat = []
    for vn in top_v:
        o = next((x for x in vend if x['name'] == vn), None)
        mat.append([(o['fam'].get(fn) if o else 0) or 0 for fn in top_f])
    out['av-mix'] = {'linhas': top_v, 'colunas': top_f, 'mat': mat}
    cen = []
    for x in demais:
        por_ticket = x['peds'] * lider['ticket'] - x['v']
        por_freq = (x['clis'] * lider['pedCli'] * x['ticket']) - x['v']
        cen.append({'name': x['name'], 'v': x['v'], 'porTicket': max(0, por_ticket), 'porFreq': max(0, por_freq)})
    ganho_ticket, ganho_freq = soma(x['porTicket'] for x in cen), soma(x['porFreq'] for x in cen)
    linhas = []
    for x in sorted(cen, key=lambda c: -c['porTicket']):
        o = next(y for y in vend if y['name'] == x['name'])
        linhas.append([x['name'], x['v'], o['ticket'], o['peds'] * lider['ticket'], x['porTicket']])
    out['av-jogo'] = {'ganho_ticket': ganho_ticket, 'ganho_freq': ganho_freq, 'tot_demais': tot_demais,
                      'n_demais': len(demais), 'linhas': linhas, 'lider': lider['name']}
    RF = rfv_clientes(DATA, fim, max(janela, 12))
    if RF:
        cli = RF['cli']
        out['av-rfv'] = {'meses': RF['meses'], 'fim': fim, 'total': RF['total'], 'n': len(cli),
                         'segs': [[s['seg'], s['n'], s['n'] / len(cli), s['v'], s['v'] / RF['total'], s['f'], s['r']]
                                  for s in RF['segs']],
                         'f_medio': soma(x['f'] for x in cli) / len(cli), 'r_medio': soma(x['r'] for x in cli) / len(cli)}
        risco = sorted((x for x in cli if x['seg'] in ('Em risco', 'Hibernando')), key=lambda x: -x['v'])[:15]
        if risco:
            out['av-parados'] = {'linhas': [[x['name'], x['v'], x['f'], x['r'], x['dono']] for x in risco]}
        donos = []
        for x in cli:
            if x['dono'] and x['dono'] not in donos:
                donos.append(x['dono'])
        qual = []
        for d in donos:
            meus = [x for x in cli if x['dono'] == d]
            camp = [x for x in meus if x['seg'] in ('Campeões', 'Fiéis')]
            perd = [x for x in meus if x['seg'] in ('Em risco', 'Hibernando', 'Perdidos')]
            qual.append({'d': d, 'n': len(meus), 'v': soma(x['v'] for x in meus), 'camp': len(camp),
                         'vcamp': soma(x['v'] for x in camp), 'perd': len(perd),
                         'rec': soma(x['f'] for x in meus) / len(meus)})
        qual = sorted((x for x in qual if x['n'] >= 3), key=lambda x: -x['v'])
        out['av-qualidade'] = {'linhas': [[x['d'], x['n'], x['v'], x['camp'], x['vcamp'] / x['v'] if x['v'] else 0,
                                           x['perd'], x['perd'] / x['n'], x['rec']] for x in qual]}
    return out


def clientes_do_segmento(C, params):
    """Detalhamento: clientes de um segmento do RFV (recurso 'detalhar')."""
    DATA = C.blob('DATA')
    janela = _janela(params)
    RF = rfv_clientes(DATA, C.maxym_vendas, max(janela, 12))
    seg = params.get('seg')
    lista = sorted((x for x in (RF['cli'] if RF else []) if x['seg'] == seg), key=lambda x: -x['v'])
    tot = soma(x['v'] for x in lista)
    acc, linhas = 0, []
    for x in lista:
        acc += x['v']
        linhas.append([x['name'], x['v'], x['f'], x['r'], x['vida'], x['dono'], acc / tot if tot else 0])
    return {'seg': seg, 'total': tot, 'linhas': linhas}

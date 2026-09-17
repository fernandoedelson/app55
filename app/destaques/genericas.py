# -*- coding: utf-8 -*-
"""Regras genéricas de destaque — porte de R.concentracao, R.rotatividade, R.serieOscilacao e do
motor R.auto (com as cinco leituras) do insights.js.

Cada regra devolve o destaque com os NÚMEROS; a frase é montada no navegador
(app/static/relatorio/destaques_texto.js), como no resto do porte."""
from ..calculo.numeros import ordem_chaves_js, soma
from .nucleo import argmax, argmin, clamp, destaque, media, nucleo_material, ordenar, quantos_para


def _itens(ctx):
    return ordenar([x for x in (ctx.get('itens') or []) if x and (x.get('v') or 0) > 0])


# ---------------------------------------------------------------- G1. concentração de um ranking
def concentracao(ctx):
    it = _itens(ctx)
    if len(it) < 5:
        return None
    vals = [x['v'] for x in it]
    tot = soma(vals)
    k50, k80 = quantos_para(vals, .5), quantos_para(vals, .8)
    sh = k50 / len(it)
    lim = ctx.get('limiar') or .25
    if sh > lim:
        return None
    p1 = vals[0] / tot
    cauda = len(it) - k80
    v_cauda = soma(vals[k80:])
    return destaque('concentracao', ctx, 'concentracao', (lim - sh) / lim * .55 + p1,
                    {'n': len(it), 'k50': k50, 'k80': k80, 'p1': p1, 'tot': tot, 'metade': tot / 2,
                     'maior': vals[0], 'nome1': it[0]['name'], 'cauda': cauda, 'v_cauda': v_cauda,
                     'sh': sh, 'lim': lim, 'escopo': ctx.get('escopo'), 'escopoPl': ctx.get('escopoPl'),
                     'universo': ctx.get('universo')},
                    tom='warn' if sh <= .12 else 'note',
                    labels=[x['name'] for x in it[:k50]])


# ---------------------------------------------------------------- G2. rotatividade entre recortes
def rotatividade(ctx):
    if not ctx.get('a') or not ctx.get('b'):
        return None
    ma, mb = {}, {}
    for x in ctx['a']:
        if x and (x.get('v') or 0) > 0:
            ma[x['name']] = ma.get(x['name'], 0) + x['v']
    for x in ctx['b']:
        if x and (x.get('v') or 0) > 0:
            mb[x['name']] = mb.get(x['name'], 0) + x['v']
    nomes = []
    for n in ordem_chaves_js(ma) + ordem_chaves_js(mb):
        if n not in nomes:
            nomes.append(n)
    if len(nomes) < 4:
        return None
    tot_a, tot_b = soma(ma.values()), soma(mb.values())
    if not tot_a or not tot_b:
        return None
    ganho = perda = 0
    novos, saidas = [], []
    for n in nomes:
        d = mb.get(n, 0) - ma.get(n, 0)
        if d > 0:
            ganho += d
            if not ma.get(n):
                novos.append([n, mb[n]])
        else:
            perda += -d
            if not mb.get(n):
                saidas.append([n, ma[n]])
    movido, d_tot = min(ganho, perda), tot_b - tot_a
    if not movido or movido < abs(d_tot) * .8 or movido / tot_a < .15:
        return None
    novos.sort(key=lambda x: -x[1])
    saidas.sort(key=lambda x: -x[1])
    return destaque('rotatividade', ctx, 'oculto', movido / tot_a * 1.6,
                    {'d_tot': d_tot, 'movido': movido, 'ganho': ganho, 'perda': perda, 'tot_a': tot_a,
                     'novos': len(novos), 'maior_novo': novos[0][1] if novos else 0,
                     'saidas': len(saidas), 'v_saidas': soma(x[1] for x in saidas),
                     'labelA': ctx.get('labelA') or 'antes', 'labelB': ctx.get('labelB') or 'agora',
                     'escopo': ctx.get('escopo'), 'escopoPl': ctx.get('escopoPl')},
                    tom='warn',
                    labels=[x[0] for x in novos[:2]] + [x[0] for x in saidas[:2]])


# ---------------------------------------------------------------- G3. oscilação de uma série mensal
def serie_oscilacao(ctx):
    v = [float(x or 0) for x in (ctx.get('vals') or [])]
    L = ctx.get('labels') or []
    if len(v) < 5:
        return None
    i_max, i_min = argmax(v), argmin(v)
    if not v[i_min]:
        return None
    amp = v[i_max] / v[i_min] - 1
    if amp < .4:
        return None
    m = media(v)
    abaixo = len([x for x in v if x < m])
    iq, qd = 1, 0
    for i in range(1, len(v)):
        d = v[i] - v[i - 1]
        if d < qd:
            qd, iq = d, i
    return destaque('serieOscilacao', ctx, 'padrao', amp / 2,
                    {'max': v[i_max], 'min': v[i_min], 'labMax': L[i_max] if i_max < len(L) else '',
                     'labMin': L[i_min] if i_min < len(L) else '', 'amp': amp, 'media': m,
                     'abaixo': abaixo, 'n': len(v), 'queda': qd, 'labQueda': L[iq] if iq < len(L) else '',
                     'fmt': ctx.get('fmt') or 'mi', 'verbo': ctx.get('verbo') or 'vendeu'},
                    labels=[L[i_max] if i_max < len(L) else None, L[i_min] if i_min < len(L) else None],
                    prefixo='serie-oscilacao')


# ---------------------------------------------------------------- motor automático (5 leituras)
def _divergencia(it, ctx):
    com_q = [x for x in it if (x.get('peds') or 0) > 0 or (x.get('q') or 0) > 0]
    if len(com_q) < 4:
        return None
    chave = 'peds' if (com_q[0].get('peds') or 0) > 0 else 'q'
    rotulo = 'pedidos' if chave == 'peds' else 'peças'
    nucleo = nucleo_material(com_q, 'v', .85, 4)
    por_valor = ordenar(nucleo, 'v')
    por_vol = sorted(nucleo, key=lambda x: -(x.get(chave) or 0))
    if por_valor[0]['name'] == por_vol[0]['name']:
        return None
    lv, lq = por_valor[0], por_vol[0]
    tk_v = lv['v'] / lv[chave] if lv.get(chave) else 0
    tk_q = lq['v'] / lq[chave] if lq.get(chave) else 0
    if not tk_v or not tk_q:
        return None
    razao = tk_v / tk_q
    if 0.8 < razao < 1.25:
        return None
    return {'fam': 'divergencia', 'score': clamp(abs(razao - 1), 0, 1), 'tom': 'note',
            'labels': [lv['name'], lq['name']], 'leitura': 'divergencia',
            'd': {'rotulo': rotulo, 'nomeV': lv['name'], 'nomeQ': lq['name'], 'vV': lv['v'], 'qV': lv[chave],
                  'vQ': lq['v'], 'qQ': lq[chave], 'tkV': tk_v, 'tkQ': tk_q, 'razao': razao}}


def _taxa_efetiva(it, ctx):
    com_extra = sorted([x for x in it if (x.get('extra') or 0) > 0 and x['v'] > 0], key=lambda x: -x['extra'])
    if len(com_extra) < 4:
        return None
    tot_extra = soma(x['extra'] for x in com_extra)
    tot_v = soma(x['v'] for x in com_extra)
    if not tot_extra or not tot_v:
        return None
    k80 = quantos_para([x['extra'] for x in com_extra], .8)
    nucleo = com_extra[:max(k80, 3)]
    if len(nucleo) < 2:
        return None
    taxas = sorted(({'name': x['name'], 't': x['extra'] / x['v']} for x in nucleo), key=lambda x: -x['t'])
    alta, baixa = taxas[0], taxas[-1]
    if not baixa['t']:
        return None
    razao = alta['t'] / baixa['t']
    if razao < 1.25:
        return None
    peso = soma(x['extra'] for x in nucleo) / tot_extra
    v_nucleo = soma(x['v'] for x in nucleo)
    return {'fam': 'oculto', 'score': clamp((razao - 1) / 2 + peso * .3, 0, 1), 'tom': 'note',
            'labels': [alta['name'], baixa['name']], 'leitura': 'taxa',
            'd': {'n': len(nucleo), 'peso': peso, 'tAlta': alta['t'], 'tBaixa': baixa['t'],
                  'nomeAlta': alta['name'], 'nomeBaixa': baixa['name'], 'razao': razao,
                  'media': tot_extra / tot_v, 'vNucleo': v_nucleo,
                  'custoDaDiferenca': v_nucleo * (alta['t'] - baixa['t']),
                  'escopoPl': ctx.get('escopoPl'), 'universo': ctx.get('universo'),
                  'rotuloExtra': ctx.get('rotuloExtra')}}


def _cauda(it, ctx):
    if len(it) < 8:
        return None
    vals = [x['v'] for x in it]
    tot = soma(vals)
    topo = min(5, len(it) // 3)
    v_topo = soma(vals[:topo])
    v_cauda = tot - v_topo
    n_cauda = len(it) - topo
    if v_cauda / tot < .35:
        return None
    medio_cauda, medio_topo = v_cauda / n_cauda, v_topo / topo
    if medio_topo / max(medio_cauda, 1) > 60:
        return None
    return {'fam': 'concentracao', 'score': clamp(v_cauda / tot, 0, 1), 'tom': 'note', 'leitura': 'cauda',
            'd': {'topo': topo, 'nCauda': n_cauda, 'vCauda': v_cauda, 'tot': tot, 'n': len(it),
                  'medioCauda': medio_cauda, 'medioTopo': medio_topo,
                  'escopoPl': ctx.get('escopoPl'), 'universo': ctx.get('universo')}}


def _concentracao_auto(it, ctx):
    if len(it) < 5:
        return None
    vals = [x['v'] for x in it]
    tot = soma(vals)
    k50, k80 = quantos_para(vals, .5), quantos_para(vals, .8)
    p1 = vals[0] / tot
    i80 = min(k80, len(it) - 1)
    queda1 = 1 - vals[k50] / vals[0]
    queda2 = 1 - vals[i80] / max(vals[k50], 1)
    if not queda1 > queda2 + .12:
        return None
    return {'fam': 'concentracao', 'score': clamp(p1, 0, .6), 'tom': 'note', 'leitura': 'estrutura',
            'labels': [x['name'] for x in it[:k50]],
            'd': {'n': len(it), 'k50': k50, 'k80': k80, 'p1': p1, 'primeiro': vals[0], 'corte': vals[k50],
                  'i80': i80, 'queda1': queda1, 'queda2': queda2,
                  'medioResto': soma(vals[k80:]) / max(len(it) - k80, 1),
                  'escopoPl': ctx.get('escopoPl'), 'universo': ctx.get('universo')}}


def _relacao(it, ctx):
    if len(it) < 3:
        return None
    vals = [x['v'] for x in it]
    tot = soma(vals)
    med = tot / len(it)
    if not med:
        return None
    razao = vals[0] / med
    return {'fam': 'concentracao', 'score': clamp((razao - 1) / 6, 0, .35), 'tom': 'note', 'leitura': 'relacao',
            'labels': [it[0]['name']],
            'd': {'nome': it[0]['name'], 'razao': razao, 'maior': vals[0], 'media': med, 'tot': tot,
                  'n': len(it), 'abaixo': len([v for v in vals if v < med]), 'segundo': vals[1] if len(vals) > 1 else 0,
                  'escopoPl': ctx.get('escopoPl'), 'universo': ctx.get('universo')}}


LEITURAS = {'divergencia': _divergencia, 'taxa': _taxa_efetiva, 'cauda': _cauda,
            'estrutura': _concentracao_auto, 'relacao': _relacao}
ORDEM_PADRAO = ['divergencia', 'taxa', 'cauda', 'estrutura', 'relacao']


def auto(ctx):
    it = _itens(ctx)
    if len(it) < 3:
        return None
    preferir = ctx.get('preferir') or []
    ordem, vistos, cand = list(preferir) + ORDEM_PADRAO, set(), []
    for k in ordem:
        if k in vistos or k not in LEITURAS:
            continue
        vistos.add(k)
        r = LEITURAS[k](it, ctx)
        if r:
            cand.append(r)
    if not cand:
        return None
    escolha = next((c for c in cand if c['leitura'] in preferir), None) if preferir else None
    if escolha is None:
        escolha = max(cand, key=lambda c: c['score'])  # o JS ordena por score desc (estável)
    return destaque('auto', ctx, escolha['fam'], escolha['score'], escolha['d'], tom=escolha['tom'],
                    labels=escolha.get('labels'), leitura=escolha['leitura'], prefixo='auto')


REGRAS = {'concentracao': concentracao, 'rotatividade': rotatividade, 'serieOscilacao': serie_oscilacao,
          'auto': auto}

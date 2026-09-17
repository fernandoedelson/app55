# -*- coding: utf-8 -*-
"""Análise por período — porte de renderPeriodo(), PRESETS e buildFilter() (app.js). Parâmetros: de, ate."""
from ..datas import ym_shift
from ..numeros import ordem_chaves_js
from ..vendas import PSEUDO_VEND, agregar, tabela_clientes

CLSMAP = {'CLIENTE': 'Cliente final', 'SHOWROOM': 'Showroom', 'SHOW ROOM': 'Showroom', 'Não informado': 'Não informado',
          'BONIFICACAO': 'Bonificação', 'CANCELADO': 'Cancelado'}


def _int(v, padrao):
    try:
        return int(v)
    except (TypeError, ValueError):
        return padrao


def filtro(C, params):
    valido = lambda v: v in (200001, 300000) or (200001 <= v <= 300000 and 1 <= v % 100 <= 12)
    ini = C.ano_v * 100 + 1
    a, b = _int(params.get('de'), ini), _int(params.get('ate'), C.maxym_vendas)
    a = a if valido(a) else ini
    b = b if valido(b) else C.maxym_vendas
    return (b, a) if a > b else (a, b)


def _carteira_hist(C, a_monthly):
    CH = (C.blob('DATA').get('carteira') or {}).get('hist')
    yms = sorted(a_monthly)
    if not (CH and CH['yms'] and len(yms) > 1):
        return None
    ym_a, ym_b = yms[0], yms[-1]
    hi = [i for i, y in enumerate(CH['yms']) if ym_a <= y <= ym_b]
    if len(hi) <= 1:
        return None
    DRE = C.blob('DRE') or {}
    hyms = [CH['yms'][i] for i in hi]
    hval = [CH['valor'][i] for i in hi]

    def mes_dre(ym):
        y, m = ym // 100, ym % 100 - 1
        d = DRE.get(str(y))
        return (d['months'][m] if m < len(d['months']) else 0) or 0 if d else 0

    def fat6m(ym):
        s = n = 0
        for k in range(6):
            v = mes_dre(ym_shift(ym, -k))
            if v:
                s += v
                n += 1
        return s / n if n else 0

    fat = [fat6m(y) for y in hyms]
    return {'yms': hyms, 'valor': hval, 'meses': [hval[i] / f if f > 0 else 0 for i, f in enumerate(fat)],
            'venda': [a_monthly.get(y, 0) for y in hyms], 'fat6m': fat}


def calcular(C, params=None):
    params = params or {}
    DATA = C.blob('DATA')
    a, b = filtro(C, params)
    g = agregar(DATA, a, b)
    out = {'periodo.abertura': {'a': a, 'b': b, 'ano_v': C.ano_v, 'maxym': C.maxym_vendas, 'minym': C.minym_vendas,
                                'anos_fechados': C.anos_fechados(C.ano_v),
                                'total': g['total'], 'peds': g['peds'], 'ticket': g['ticket'], 'qnt': g['qnt']}}
    ch = _carteira_hist(C, g['monthly'])
    if ch:
        out['pe-cart'] = ch
    vr = [x for x in g['vend'] if x['peds'] >= 1 and x['name'] not in PSEUDO_VEND]
    out['pe-vend'] = {'top': [[x['name'], x['v']] for x in vr[:10]],
                      'linhas': [[x['name'], x['v'], x['contrib'], x['peds'], x['ticket'], x['titem'], x['com'], x['custop']]
                                 for x in g['vend'] if x['v'] > 0 and x['name'] not in PSEUDO_VEND]}
    fams = [f for f in g['fams'] if f['name'] != 'Frete/Serviço']
    fam_tot = 0
    for f in fams:
        fam_tot += f['v']
    out['pe-cat'] = {'top': [[x['name'], x['v']] for x in fams[:12]], 'total': fam_tot, 'n': len(fams)}
    top_v = [x['name'] for x in vr[:6]]
    top_f = [x['name'] for x in fams[:8]]
    md = {vn: {fn: 0 for fn in top_f} for vn in top_v}
    for vi in ordem_chaves_js(g['VF']):
        vn = DATA['vd'][vi]
        if vn not in md:
            continue
        for fi in ordem_chaves_js(g['VF'][vi]):
            fn = DATA['fam'][fi]
            if fn in md[vn]:
                md[vn][fn] = g['VF'][vi][fi]
    out['pe-catvend'] = {'linhas': top_v, 'colunas': top_f, 'mat': [[md[vn][fn] for fn in top_f] for vn in top_v]}
    cagg = {}
    for x in g['clss']:
        k = CLSMAP.get(x['name'], x['name'])
        cagg[k] = cagg.get(k, 0) + x['v']
    cd = sorted(([k, cagg[k]] for k in ordem_chaves_js(cagg) if cagg[k] > 0), key=lambda e: -e[1])[:3]
    out['pe-canal'] = {'top': [[x['name'], x['v']] for x in g['clis'][:12]], 'canal': cd}
    tc = tabela_clientes(g['clis'], g['total'], maximo=25)
    tc['linhas'] = [{'name': x['name'], 'v': x['v']} for x in tc['linhas']]
    out['pe-cli'] = dict(tc, n_clis=len(g['clis']))
    out['pe-desig'] = {'top': [[x['name'], x['roy']] for x in g['desg'][:12]],
                       'linhas': [[x['name'], x['roy'], x['v'], x['roy'] / x['v'] if x['v'] else 0, x['peds']] for x in g['desg'][:15]]}
    out['pe-arq'] = {'top': [[x['name'], x['rt']] for x in g['arqs'][:12]],
                     'linhas': [[x['name'], x['rt'], x['v'], x['rt'] / x['v'] if x['v'] else 0, x['peds']] for x in g['arqs'][:15]]}
    c = g['comp']
    comp = [['RT arquitetos', c['rt']], ['Royalties designers', c['roy']], ['Comissão vendedor(a) (PF)', c['pf']],
            ['Prêmio', c['prem']], ['Comissão vendedor(a) (PJ)', c['pj']], ['Curadoria / RP', c['cur']], ['DSR', c['dsr']],
            ['Comissão gerente', c['ger']]]
    comp = sorted((x for x in comp if x[1] > 0), key=lambda x: -x[1])
    rep = 0
    for x in comp:
        rep += x[1]
    out['pe-repasses'] = {'comp': [[x[0], x[1], x[1] / g['total'] if g['total'] else None] for x in comp], 'total': rep,
                          'pct': rep / g['total'] if g['total'] else None}
    return out

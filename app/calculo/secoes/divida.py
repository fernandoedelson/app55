# -*- coding: utf-8 -*-
"""Dívida e endividamento — porte de renderDivida() (app.js). Sem filtros.

Blocos sem título próprio seguem a marcação do Kit: os indicadores de endividamento gerado vêm logo
depois da evolução ano a ano (dv-ano) quando há APORTES; sem APORTES, ficam na abertura."""
from ..dre import dre_agg
from ..numeros import soma


def _anos_aportes(AP):
    ult, meses = {}, {}
    for i, y in enumerate(AP['yms']):
        a = y // 100
        ult[a] = i
        meses[a] = meses.get(a, 0) + 1
    linhas = []
    saldo_ant = cor_ant = 0
    for a in sorted(ult):
        li = ult[a]
        saldo = AP['aporte'][li] + AP['correcao'][li]
        cor = AP['correcao'][li] - cor_ant
        rem = rec = 0
        for i, y in enumerate(AP['yms']):
            if y // 100 != a:
                continue
            rem += AP['remessas'][i]
            rec += AP['recebimentos'][i]
        linhas.append({'ano': a, 'meses': meses[a], 'ini': saldo_ant, 'rem': rem, 'rec': rec, 'liq': rem + rec,
                       'cor': cor, 'saldo': saldo})
        saldo_ant, cor_ant = saldo, AP['correcao'][li]
    return linhas


def _aportes_por_ano(AP):
    fim, por = {}, {}
    for i, y in enumerate(AP['yms']):
        ano = y // 100
        fim[ano] = AP['correcao'][i]
        o = por.setdefault(ano, {'aporte': 0})
        o['aporte'] += AP['remessas'][i] + AP['recebimentos'][i]
    for ano in fim:
        por.setdefault(ano, {'aporte': 0})['correcao'] = fim[ano] - (fim.get(ano - 1) or 0)
    return por


def calcular(C, params=None):
    DPNL, AP = C.blob('DPNL'), C.blob('APORTES')
    E = DPNL['CONSOLIDADO']
    D1 = C.ano_d
    D0 = D1 - 1
    maxym = C.maxym_dre
    yms, endv, jur = [], [], []
    for y in (D0, D1):
        yr = str(y)
        if yr not in E:
            continue
        for m in range(12):
            if y == D1 and m > (maxym % 100) - 1:
                break
            yms.append(y * 100 + m + 1)
            e, j = E[yr].get('endividamento'), E[yr].get('juros_passivos')
            endv.append((e[m] if e and m < len(e) else 0) or 0)
            jur.append((j[m] if j and m < len(j) else 0) or 0)
    ger = [-v for v in endv]
    cum, acc = [], 0
    for v in ger:
        acc += v
        cum.append(acc)
    jur_abs = [abs(v) for v in jur]
    g25 = dre_agg(DPNL, 'CONSOLIDADO', D0 * 100 + 1, D0 * 100 + 12)
    g26 = dre_agg(DPNL, 'CONSOLIDADO', D1 * 100 + 1, maxym)
    j23 = dre_agg(DPNL, 'CONSOLIDADO', (D0 - 2) * 100 + 1, (D0 - 2) * 100 + 12)
    j24 = dre_agg(DPNL, 'CONSOLIDADO', (D0 - 1) * 100 + 1, (D0 - 1) * 100 + 12)

    abertura = {'tem_ap': bool(AP)}
    out = {'divida.abertura': abertura}
    kpis_endiv = {'D0': D0, 'D1': D1, 'maxym': maxym, 'endiv0': -g25['endividamento'], 'endiv1': -g26['endividamento'],
                  'acum': cum[-1] if cum else None, 'juros0': abs(g25['juros_passivos'])}
    if AP:
        abertura['ap'] = {'saldo_atual': AP['saldo_atual'], 'ym_fim': AP['yms'][-1], 'ym_ini': AP['yms'][0],
                          'aporte_fim': AP['aporte'][-1], 'total_remessas': AP['total_remessas'],
                          'total_recebimentos': AP['total_recebimentos'], 'total_correcao': AP['total_correcao']}
        out['dv-saldo'] = {'yms': AP['yms'], 'aporte': AP['aporte'], 'correcao': AP['correcao'],
                           'total_remessas': AP['total_remessas'], 'total_recebimentos': AP['total_recebimentos'],
                           'saldo_atual': AP['saldo_atual'], 'total_correcao': AP['total_correcao']}
        linhas = _anos_aportes(AP)
        virada = next((o for o in linhas if o['cor'] > o['liq']), None)
        out['dv-ano'] = {'linhas': linhas, 'virada': virada, 'pico_liq': max(o['liq'] for o in linhas),
                         'total': [AP['total_remessas'], AP['total_recebimentos'], AP['total_correcao'], AP['saldo_atual']],
                         'kpis': kpis_endiv}
    else:
        abertura['kpis'] = kpis_endiv
    out['dv-endiv'] = {'yms': yms, 'cum': cum, 'D0': D0, 'tem_ap': bool(AP)}
    por = _aportes_por_ano(AP) if AP else {}
    ap_cel = lambda ano, k: (por.get(ano) or {}).get(k) or None
    out['dv-juros'] = {
        'yms': yms, 'juros': jur_abs, 'maxym': maxym,
        'linhas': [[str(D0 - 2), abs(j23['juros_passivos']), None, ap_cel(D0 - 2, 'aporte'), ap_cel(D0 - 2, 'correcao')],
                   [str(D0 - 1), abs(j24['juros_passivos']), None, ap_cel(D0 - 1, 'aporte'), ap_cel(D0 - 1, 'correcao')],
                   [str(D0), abs(g25['juros_passivos']), -g25['endividamento'], ap_cel(D0, 'aporte'), ap_cel(D0, 'correcao')],
                   [None, abs(g26['juros_passivos']), -g26['endividamento'], ap_cel(D1, 'aporte'), ap_cel(D1, 'correcao')]],
        'D1': D1,
    }
    out['dv-geracao'] = {'yms': yms, 'ger': ger, 'cum': cum, 'juros': jur_abs, 'D0': D0, 'D1': D1, 'maxym': maxym,
                         'jA': abs(j24['juros_passivos']), 'jB': abs(g25['juros_passivos']),
                         'endiv0': -g25['endividamento'], 'endiv1': -g26['endividamento'], 'tem_ap': bool(AP)}
    return out

# -*- coding: utf-8 -*-
"""Sumário executivo — porte do cálculo de renderSumario() (app.js)."""
from ..dre import dre_agg
from ..metas import metas_calc
from ..numeros import soma
from ..sazonalidade import titulo_crescimento
from ..vendas import agregar


def _ids_linha(r):
    """Identidade de relação: arquiteto quando a venda tem arquiteto, senão o cliente."""
    return ['a%s' % x[0] for x in r[16]] if r[16] else ['c%s' % r[5]]


def _identidades_unicas(DATA, a, b):
    pos = {}
    for r in DATA['rows']:
        if r[0] < a or r[0] > b:
            continue
        for k in _ids_linha(r):
            pos[k] = pos.get(k, 0) + r[1]
    return sum(1 for v in pos.values() if v > 0)


def calcular(C, params=None):
    DATA, DRE, DPNL = C.blob('DATA'), C.blob('DRE'), C.blob('DPNL')
    fim = C.maxym_vendas
    y1, y0 = C.ano_v, C.ano_v - 1
    i1 = y1 * 100 + 1
    A = agregar(DATA, 200001, 300000)
    c = A['comp']
    rep = c['pf'] + c['dsr'] + c['prem'] + c['pj'] + c['ger'] + c['cur'] + c['rt'] + c['roy']
    top10 = soma(x['v'] for x in A['clis'][:10])
    dtop = soma(x['roy'] for x in A['desg'][:2])
    dtot = soma(x['roy'] for x in A['desg'])

    antes, no_ano = set(), set()
    for r in DATA['rows']:
        ids = _ids_linha(r)
        if r[0] < i1:
            antes.update(ids)
        elif r[0] <= fim:
            no_ano.update(ids)
    novos = sum(1 for k in no_ano if k not in antes)
    H = agregar(DATA, i1, fim)

    g26 = dre_agg(DPNL, 'CONSOLIDADO', C.ano_d * 100 + 1, C.maxym_dre) if DPNL else None
    fat25ytd = dre_agg(DPNL, 'CONSOLIDADO', (C.ano_d - 1) * 100 + 1, C.maxym_dre - 100)['receita_bruta'] if DPNL else 0
    MP = metas_calc(C)
    base = {'maxym': fim, 'minym': C.minym_vendas, 'Y0': y0, 'Y1': y1}
    return {
        'resumo.abertura': dict(base, n_linhas=len(DATA['rows'])),
        'rs-hist': dict(base, total=A['total'], peds=A['peds'], ticket=A['ticket'],
                        rel_unicas=_identidades_unicas(DATA, 200001, 300000), n_designers=len(A['desg']),
                        dtop=dtop, dtot=dtot, ano_d_ant=C.ano_d - 1,
                        fat_ano_ant=(DRE.get(str(C.ano_d - 1)) or {}).get('annual') if DRE else None,
                        carteira=DATA['carteira']['total'], rep=rep, top10=top10),
        'rs-ytd': dict(base, total=H['total'], peds=H['peds'], ticket=H['ticket'],
                       orcado=MP['metaAteAgora'] if MP else None, realizado=MP['realAteAgora'] if MP else None,
                       dre={'fat': g26['receita_bruta'], 'fat_ant': fat25ytd, 'ebitda': g26['ebitda'], 'eb_pct': g26['eb_pct'],
                            'ebit': g26['ebitda'] + g26['deprec'], 'rl': g26['receita_liquida'] or 1,
                            'ano_d_ant': C.ano_d - 1} if g26 else None,
                       rel_unicas=_identidades_unicas(DATA, i1, fim), novos=novos),
        'rs-leitura': dict(base, titulo=titulo_crescimento(C), ano_ini=C.ano_ini_serie,
                           venda_ini=agregar(DATA, C.ano_ini_serie * 100 + 1, C.ano_ini_serie * 100 + 12)['total'],
                           venda_ant=agregar(DATA, y0 * 100 + 1, y0 * 100 + 12)['total'], venda_ano=H['total'],
                           orcado=MP['metaAteAgora'] if MP else None, realizado=MP['realAteAgora'] if MP else None,
                           dtop=dtop, dtot=dtot, rt=c['rt'], total=A['total'], top10=top10),
    }

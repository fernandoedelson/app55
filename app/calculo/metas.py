# -*- coding: utf-8 -*-
"""Meta × realizado — porte de metasCalc() (app.js). Usado pelo Sumário e pela Performance."""
from .datas import ym_lab
from .numeros import cagr, soma
from .sazonalidade import distribui_sazonal, fracao_decorrida, peso_mensal, venda_mensal_por_ano


def metas_calc(C):
    METAS, DATA = C.blob('METAS'), C.blob('DATA')
    if not METAS or not METAS.get('yms'):
        return None
    yms, meta = METAS['yms'], METAS['meta']
    ano = yms[0] // 100
    fim = min(C.maxym_vendas, yms[-1])
    real = {}
    for r in DATA['rows']:
        if yms[0] <= r[0] <= fim:
            real[r[0]] = real.get(r[0], 0) + r[1]
    realizado = [real.get(y, 0) if y <= fim else None for y in yms]
    i_ult = -1
    for i, y in enumerate(yms):
        if y <= fim:
            i_ult = i
    if i_ult < 0:
        return None
    meta_ate_agora = soma(meta[:i_ult + 1])
    real_ate_agora = soma((b or 0) for b in realizado[:i_ult + 1])
    gap_acum = meta_ate_agora - real_ate_agora
    restantes = len(yms) - 1 - i_ult
    meta_ano = soma(meta)

    v_mes = venda_mensal_por_ano(DATA)
    anos_saz = C.anos_fechados(C.ano_v)
    anos_fech = [y for y in anos_saz if y in v_mes and any(v > 0 for v in v_mes[y])]
    peso = peso_mensal(v_mes, anos_fech)
    mes_fim = yms[i_ult] % 100 - 1
    idx_rest = [yms[i] % 100 - 1 for i in range(i_ult + 1, len(yms))]
    frac = fracao_decorrida(peso, mes_fim)
    tot_proj_hist = real_ate_agora / frac if frac > 0 else None
    dist_hist = distribui_sazonal(tot_proj_hist - real_ate_agora, peso, idx_rest) if tot_proj_hist is not None else None
    dist_meta = distribui_sazonal(meta_ano - real_ate_agora, peso, idx_rest)
    ano_ant, base = ano - 1, anos_saz[0] if anos_saz else None
    cagr_v = cagr(soma(v_mes[ano_ant]), soma(v_mes[base]), ano_ant - base) if (ano_ant in v_mes and base in v_mes) else None
    tot_proj_cagr = soma(v_mes[ano_ant]) * (1 + cagr_v) if (cagr_v is not None and ano_ant in v_mes) else None
    dist_cagr = distribui_sazonal(tot_proj_cagr - real_ate_agora, peso, idx_rest) if tot_proj_cagr is not None else None

    def serie(dist):
        out = []
        for i, y in enumerate(yms):
            if i <= i_ult:
                out.append(realizado[i])
            else:
                v = dist[y % 100 - 1] if dist else None
                out.append(None if v is None else max(0, v))
        return out

    proj_hist, meta_saz, proj_cagr = serie(dist_hist), serie(dist_meta), serie(dist_cagr)
    gap = [meta[i] - realizado[i] if i <= i_ult else None for i in range(len(yms))]
    meta_acum, a = [], 0
    for v in meta:
        a += v
        meta_acum.append(a)
    real_acum, b = [], 0
    for v in realizado:
        if v is None:
            real_acum.append(None)
        else:
            b += v
            real_acum.append(b)
    return {'yms': yms, 'labels': [ym_lab(y) for y in yms], 'meta': meta, 'realizado': realizado,
            'metaAtual': meta_saz, 'projHist': proj_hist, 'metaSaz': meta_saz, 'projCagr': proj_cagr,
            'gap': gap, 'metaAcum': meta_acum, 'realAcum': real_acum, 'peso': peso, 'frac': frac, 'idxRest': idx_rest,
            'totProjHist': tot_proj_hist, 'totProjCagr': tot_proj_cagr, 'cagrV': cagr_v,
            'iUlt': i_ult, 'fim': fim, 'ano': ano, 'gapAcum': gap_acum, 'restantes': restantes, 'metaAno': meta_ano,
            'metaAteAgora': meta_ate_agora, 'realAteAgora': real_ate_agora, 'aRealizar': meta_ano - real_ate_agora}

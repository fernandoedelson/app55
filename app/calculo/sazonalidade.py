# -*- coding: utf-8 -*-
"""Sazonalidade e projeção — porte do bloco SAZONALIDADE E PROJEÇÃO do app.js.
Fonte única do peso histórico do mês (Evolutiva, Sumário, Performance)."""
from .numeros import soma


def peso_mensal(meses_por_ano, anos):
    w = [0] * 12
    n = 0
    for y in anos:
        m = meses_por_ano.get(y)
        if not m:
            continue
        tot = soma(m)
        if not tot:
            continue
        for i, v in enumerate(m):
            w[i] += v / tot
        n += 1
    return [x / n for x in w] if n else w


def venda_mensal_por_ano(DATA):
    out = {}
    for r in DATA['rows']:
        y, m = r[0] // 100, r[0] % 100 - 1
        out.setdefault(y, [0] * 12)[m] += r[1]
    return out


def fracao_decorrida(peso, mo):
    return soma(peso[:mo + 1]) if mo >= 0 else 0


def distribui_sazonal(total, peso, idx):
    s = soma(peso[m] for m in idx)
    out = [None] * 12
    for m in idx:
        out[m] = total * peso[m] / s if s > 0 else total / len(idx)
    return out


def lead_pico_anual(C):
    vy = venda_mensal_por_ano(C.blob('DATA'))
    anos = [y for y in C.anos_fechados(C.ano_v) if y in vy]
    if not anos:
        return ''
    tot = lambda y: soma(vy[y])
    pico = anos[0]
    for y in anos:
        if tot(y) > tot(pico):
            pico = y
    ate = [y for y in anos if y <= pico]
    subiu = all(i == 0 or tot(y) > tot(ate[i - 1]) for i, y in enumerate(ate))
    return ('Crescimento consistente até o pico de %d.' if subiu else 'Pico anual em %d.') % pico


def titulo_crescimento(C):
    f = lead_pico_anual(C)
    import re
    m = re.search(r'(\d{4})', f)
    if not m:
        return 'Evolução das vendas'
    return ('Crescimento forte até ' if f.startswith('Crescimento') else 'Pico de vendas em ') + m.group(1)

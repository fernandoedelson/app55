# -*- coding: utf-8 -*-
"""Regras de custo fixo, dívida e estudos — porte de R.cfComposicao, R.cfCategoriaContraFluxo,
R.cfConcentracao, R.cfPacoteVariacao, R.dividaCorrecao, R.dividaJuroAno e R.fabLojaLinhas."""
import math
import re
import unicodedata

from ..calculo.numeros import ordem_chaves_js, soma
from .nucleo import destaque, media


def _sinal(v):
    return (v > 0) - (v < 0)


def composicao(C, ctx=None):
    CF = C.blob('CF')
    if not CF or not CF.get('entidade'):
        return None
    cons = CF['entidade'].get('Consolidado')
    if not cons or len(cons) < 6:
        return None
    ini, fim = media(cons[:3]), media(cons[-3:])
    d_cons = fim / ini - 1
    if abs(d_cons) < .05:
        return None
    partes = []
    for k in ordem_chaves_js(CF['entidade']):
        if k == 'Consolidado':
            continue
        a = CF['entidade'][k]
        i0, i1 = media(a[:3]), media(a[-3:])
        partes.append({'nome': k, 'd': (i1 / i0 - 1) if i0 else 0, 'ini': i0, 'fim': i1, 'delta': i1 - i0})
    if len(partes) < 2:
        return None
    partes.sort(key=lambda x: x['d'])
    lider, parada = partes[0], partes[-1]
    if abs(parada['d']) > abs(d_cons) * .5:
        return None
    se_acompanhasse = parada['ini'] * (1 + lider['d'])
    return destaque('cfComposicao', ctx or {}, 'decomposicao',
                    abs(lider['delta'] / ((lider['delta'] + parada['delta']) or 1)),
                    {'dCons': d_cons, 'lider': lider['nome'], 'dLider': lider['d'], 'iniLider': lider['ini'],
                     'fimLider': lider['fim'], 'parada': parada['nome'], 'dParada': parada['d'],
                     'fimParada': parada['fim'], 'seAcompanhasse': se_acompanhasse,
                     'difAno': abs(parada['fim'] - se_acompanhasse) * 12},
                    tom='note' if d_cons < 0 else 'warn', labels=[lider['nome'], parada['nome']],
                    id_fixo='cf-composicao')


def categoria_contrafluxo(C, ctx):
    CF = C.blob('CF')
    if not CF:
        return None
    CAT = ctx.get('cats') or CF.get('categoria')
    if not CAT:
        return None
    cats = [k for k in ordem_chaves_js(CAT) if soma(CAT[k]) > 0]
    if len(cats) < 3:
        return None
    tot = [soma(CAT[k][i] for k in cats) for i in range(len(CAT[cats[0]]))]
    d_tot = media(tot[-3:]) / media(tot[:3]) - 1
    movs = []
    for k in cats:
        a = CAT[k]
        i0, i1 = media(a[:3]), media(a[-3:])
        peso = soma(a) / soma(tot)
        if peso >= .04:
            movs.append({'nome': k, 'd': (i1 / i0 - 1) if i0 else 0, 'ini': i0, 'fim': i1, 'peso': peso})
    contra = sorted((m for m in movs if _sinal(m['d']) != _sinal(d_tot) and abs(m['d']) >= .15),
                    key=lambda m: -abs(m['d'] * m['peso']))
    if not contra:
        return None
    m = contra[0]
    custo = soma(c['fim'] - c['ini'] * (1 + d_tot) for c in contra)
    ent = ctx.get('entidade')
    sufixo = ('-' + ent.lower()) if ent and ent != 'CONSOLIDADO' else ''
    return destaque('cfCategoriaContraFluxo', ctx, 'divergencia', abs(m['d']) * m['peso'] * 6,
                    {'soUma': len(contra) == 1, 'nome': m['nome'], 'd': m['d'], 'ini': m['ini'],
                     'fim': m['fim'], 'peso': m['peso'], 'dTot': d_tot, 'custo': abs(custo),
                     'contra': [{'nome': c['nome'], 'd': c['d']} for c in contra]},
                    tom='warn' if d_tot < 0 else 'note', labels=[c['nome'] for c in contra],
                    id_fixo='cf-categoria-contrafluxo' + sufixo)


def concentracao_cf(C, ctx):
    CF = C.blob('CF')
    CAT = ctx.get('cats') or (CF or {}).get('categoria')
    if not CAT:
        return None
    itens = sorted(({'nome': k, 'v': soma(CAT[k])} for k in ordem_chaves_js(CAT) if soma(CAT[k]) > 0),
                   key=lambda o: -o['v'])
    if len(itens) < 4:
        return None
    tot = soma(o['v'] for o in itens)
    if not tot:
        return None
    duas = (itens[0]['v'] + itens[1]['v']) / tot
    if duas < .6:
        return None
    cauda = itens[2:]
    v_cauda = soma(o['v'] for o in cauda)
    meses = len((CF or {}).get('meses') or []) or 12
    ent = ctx.get('entidade')
    sufixo = ('-' + ent.lower()) if ent and ent != 'CONSOLIDADO' else ''
    return destaque('cfConcentracao', dict(ctx, tabela=True), 'concentracao', (duas - .4) * 2,
                    {'n1': itens[0]['nome'], 'v1': itens[0]['v'], 'n2': itens[1]['nome'], 'v2': itens[1]['v'],
                     'duas': duas, 'nCauda': len(cauda), 'vCauda': v_cauda, 'tot': tot, 'meses': meses},
                    labels=[itens[0]['nome'], itens[1]['nome']], id_fixo='cf-concentracao' + sufixo)


def pacote_variacao(ctx):
    rows = [r for r in (ctx.get('rows') or []) if r[1] or r[2]]
    if len(rows) < 3:
        return None
    tot_a, tot_p = soma(r[1] for r in rows), soma(r[2] for r in rows)
    if not tot_p:
        return None
    d_tot = tot_a - tot_p
    ordem = sorted(rows, key=lambda r: -abs(r[3]))
    maior = ordem[0]
    if not d_tot:
        return None
    domina = abs(maior[3]) / abs(d_tot)
    if domina < 1.15:
        return None
    contra = sorted((r for r in ordem if r[3] * maior[3] < 0), key=lambda r: -abs(r[3]))
    contra = contra[0] if contra else None
    return destaque('cfPacoteVariacao', ctx, 'oculto', domina - 1,
                    {'dTot': d_tot, 'totA': tot_a, 'totP': tot_p, 'maior': maior[0], 'dMaior': maior[3],
                     'contra': contra[0] if contra else None, 'dContra': contra[3] if contra else None,
                     'resto': d_tot - maior[3], 'domina': domina},
                    labels=[maior[0], contra[0]] if contra else [maior[0]], id_fixo='cf-pacote-variacao')


def divida_correcao(C, ctx=None):
    A = C.blob('APORTES')
    if not A or not A.get('saldo_atual'):
        return None
    sh = A['total_correcao'] / A['saldo_atual']
    if sh < .25:
        return None
    liq = A['total_remessas'] + A['total_recebimentos']
    n = len(A['correcao'])
    cor12 = A['correcao'][n - 1] - A['correcao'][n - 13] if n > 12 else None
    return destaque('dividaCorrecao', ctx or {}, 'decomposicao', sh * 1.6,
                    {'saldo': A['saldo_atual'], 'liq': liq, 'correcao': A['total_correcao'],
                     'remessas': A['total_remessas'], 'recebimentos': A['total_recebimentos'],
                     'cor12': cor12, 'sh': sh},
                    tom='warn', labels=['Correção/juros acumulados'], id_fixo='divida-correcao')


def divida_juro_ano(ctx):
    A = [o for o in (ctx.get('anos') or []) if o['saldo']]
    if len(A) < 3:
        return None
    ult = A[-1]
    cheios = [o for o in A if o['meses'] == 12]
    virada = next((o for o in cheios if o['cor'] > o['liq']), None)
    if not virada:
        return None
    ref = cheios[-1] if cheios else ult
    taxa = ref['cor'] / ((ref['saldo'] - ref['cor']) or ref['saldo']) if ref['saldo'] else 0
    dobra = math.log(2) / math.log(1 + taxa) if taxa > 0 else None
    antes = [o for o in cheios if o['ano'] < virada['ano']]
    pico_liq = max((o['liq'] for o in antes), default=None)
    return destaque('dividaJuroAno', ctx, 'padrao', max(min(virada['cor'] / (virada['liq'] or 1) / 4, 1), .3),
                    {'ano': virada['ano'], 'cor': virada['cor'], 'liq': virada['liq'],
                     'picoLiq': pico_liq, 'ultLiq': ult['liq'], 'saldo': ult['saldo'],
                     'dobra': dobra if (dobra is not None and dobra < 25) else None},
                    tom='warn', labels=[str(virada['ano'])], id_fixo='divida-juro-ano')


_ACENTO = re.compile(r'[̀-ͯ]')
_norm2 = lambda t: _ACENTO.sub('', unicodedata.normalize('NFD', str(t or ''))).upper()
_RE_ROL = re.compile(r'^\(=\)\s*RECEITA OPERACIONAL LIQUIDA')
_RE_MC = re.compile(r'^\(=\)\s*MARGEM DE CONTRIBUICAO')


def fabloja_linhas(C, ctx=None):
    F = C.blob('FABLOJA')
    if not F or not F.get('blocos'):
        return None
    bl = {b['chave']: b for b in F['blocos']}
    ano = str(C.ano_d) if str(C.ano_d) in (F.get('anos') or []) else F.get('ano_padrao')
    B = ((bl.get('FABRICA') or {}).get('anos') or {}).get(ano) or (bl.get('FABRICA') or {}).get('linhas') or []
    if not B:
        return None
    acha = lambda rx: next((l for l in B if rx.match(_norm2(l[0]))), None)
    rl, mc = acha(_RE_ROL), acha(_RE_MC)
    if not rl or not mc or rl[2] is None or mc[2] is None or not rl[2]:
        return None
    marg_nova = mc[2] / rl[2]
    marg_antiga = (mc[1] / rl[1]) if (rl[1] and mc[1] is not None) else None
    if marg_antiga is None or abs(marg_nova - marg_antiga) < .05:
        return None
    return destaque('fabLojaLinhas', dict(ctx or {}, tabela=True), 'oculto',
                    abs(marg_antiga - marg_nova) * 1.5,
                    {'margNova': marg_nova, 'margAntiga': marg_antiga, 'rl': rl[2], 'mc': mc[2]},
                    id_fixo='fabloja-linhas')

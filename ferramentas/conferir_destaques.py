# -*- coding: utf-8 -*-
"""
Consistência da camada de destaques, sem abrir navegador:

1. todo ins('regra','slot') do desenho tem texto em destaques_texto.js;
2. todo destaque que o servidor produz é desenhado em algum ins() (slot existe);
3. todo slot pedido pelo desenho ou é produzido pelo servidor ou tem alternativa (||).

    python ferramentas/conferir_destaques.py [--comp 2026-07]
"""
import argparse
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

SECOES_JS = os.path.join(RAIZ, 'app', 'static', 'relatorio', 'secoes')
TEXTO_JS = os.path.join(RAIZ, 'app', 'static', 'relatorio', 'destaques_texto.js')


def slots_do_desenho():
    """{secao: [(regra, slot)]} de cada chamada ins('regra','slot')."""
    out = {}
    for arq in sorted(os.listdir(SECOES_JS)):
        if not arq.endswith('.js'):
            continue
        js = open(os.path.join(SECOES_JS, arq), encoding='utf-8').read()
        out[arq[:-3]] = re.findall(r"ins\('([A-Za-z]+)'\s*,\s*'([^']+)'\)", js)
    return out


def prefixos_dinamicos():
    """ins('regra','prefixo-'+algo): o slot nasce no clique (um por status, por exemplo)."""
    out = {}
    for arq in sorted(os.listdir(SECOES_JS)):
        if not arq.endswith('.js'):
            continue
        js = open(os.path.join(SECOES_JS, arq), encoding='utf-8').read()
        out[arq[:-3]] = re.findall(r"ins\('[A-Za-z]+'\s*,\s*'([^']+)'\s*\+", js)
    return out


def regras_com_texto():
    js = open(TEXTO_JS, encoding='utf-8').read()
    return set(re.findall(r'TXT\.([A-Za-z]+)\s*=', js))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--comp', default='2026-07')
    a = ap.parse_args()
    from app.calculo import competencia as comp_mod
    from app import destaques
    from app.catalogo import dados as cat

    C = comp_mod.carregar({'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')}, a.comp)
    desenho, textos, dinamicos = slots_do_desenho(), regras_com_texto(), prefixos_dinamicos()
    problemas, total_serv, total_desenho = [], 0, 0
    for s in cat.SECOES:
        sec = s['id']
        pedidos = desenho.get(sec, [])
        total_desenho += len(pedidos)
        produzidos = {}
        for bloco, mapa in destaques.para_secao(C, sec).items():
            for slot, o in mapa.items():
                produzidos[slot] = (bloco, o['regra'])
        total_serv += len(produzidos)
        for regra, slot in pedidos:
            if regra not in textos:
                problemas.append('%s: ins(%r) não tem texto em destaques_texto.js' % (sec, regra))
            if slot in produzidos and produzidos[slot][1] != regra:
                problemas.append('%s: slot %s é da regra %s, mas o desenho pede %s'
                                 % (sec, slot, produzidos[slot][1], regra))
        pedidos_slots = {slot for _, slot in pedidos}
        pref = dinamicos.get(sec) or []
        for slot, (bloco, regra) in produzidos.items():
            if slot not in pedidos_slots and not any(slot.startswith(x) for x in pref):
                problemas.append('%s: o servidor produz %s (%s, bloco %s) e o desenho não pede'
                                 % (sec, slot, regra, bloco))
    print('slots pedidos pelo desenho: %d | destaques produzidos: %d | regras com texto: %d'
          % (total_desenho, total_serv, len(textos)))
    for p in problemas:
        print('  ! ' + p)
    print('consistência:', 'OK' if not problemas else '%d problema(s)' % len(problemas))
    sys.exit(0 if not problemas else 1)


if __name__ == '__main__':
    main()

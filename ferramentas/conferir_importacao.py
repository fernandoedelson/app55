# -*- coding: utf-8 -*-
"""
Critério de pronto da fase 5: importar as MESMAS planilhas tem de reproduzir, base a base, os dados
da competência já publicada (que vieram do gabarito).

    python ferramentas/conferir_importacao.py [--fontes <pasta>] [--comp 2026-07]

Saída: _revisao/importacao_<comp>.md
"""
import argparse
import io
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
REVISAO = os.path.join(RAIZ, '_revisao')


def _caminhos(o, prefixo=''):
    """Achata o blob em caminho -> valor, para apontar a diferença no lugar exato."""
    if isinstance(o, dict):
        for k in o:
            yield from _caminhos(o[k], '%s.%s' % (prefixo, k))
    elif isinstance(o, list):
        yield prefixo + '[]', len(o)
        for i, v in enumerate(o[:5000]):
            yield from _caminhos(v, '%s[%d]' % (prefixo, i))
    else:
        yield prefixo, o


def comparar(novo, velho, limite=12):
    if novo == velho:
        return []
    a, b = dict(_caminhos(novo)), dict(_caminhos(velho))
    difs = []
    for k in list(a)[:200000]:
        if k not in b:
            difs.append('só na importação: %s = %r' % (k, a[k]))
        elif a[k] != b[k]:
            difs.append('%s: importado %r, publicado %r' % (k, a[k], b[k]))
        if len(difs) >= limite:
            return difs
    for k in b:
        if k not in a:
            difs.append('só no publicado: %s = %r' % (k, b[k]))
        if len(difs) >= limite:
            break
    return difs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fontes', default=os.path.join(KIT, 'fontes'))
    ap.add_argument('--base', default=KIT)
    ap.add_argument('--comp', default='2026-07')
    a = ap.parse_args()
    from app.importacao import motor

    publicada = os.path.join(RAIZ, 'data', 'competencias', a.comp)
    print('importando %s ...' % a.fontes)
    blobs = motor.processar(a.fontes, base=a.base)
    linhas, iguais, difs_tot = [], 0, 0
    for nome in motor.BLOBS:
        arq = os.path.join(publicada, nome + '.json')
        velho = json.load(open(arq, encoding='utf-8')) if os.path.exists(arq) else None
        difs = comparar(blobs.get(nome), velho)
        if not difs:
            iguais += 1
            print('%-22s OK' % nome)
            continue
        difs_tot += 1
        print('%-22s DIF (%d)' % (nome, len(difs)))
        linhas.append('### %s\n\n```\n%s\n```' % (nome, '\n'.join(difs)))
    os.makedirs(REVISAO, exist_ok=True)
    io.open(os.path.join(REVISAO, 'importacao_%s.md' % a.comp), 'w', encoding='utf-8').write(
        '# Importação x competência publicada (%s)\n\n- bases iguais: %d de %d\n\n%s\n'
        % (a.comp, iguais, len(motor.BLOBS), '\n\n'.join(linhas)))
    print('\nbases iguais: %d de %d' % (iguais, len(motor.BLOBS)))
    sys.exit(0 if not difs_tot else 1)


if __name__ == '__main__':
    main()

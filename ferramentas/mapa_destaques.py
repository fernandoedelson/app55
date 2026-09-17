# -*- coding: utf-8 -*-
"""Lista toda chamada ins(...) do app.js congelado, com a seção, o bloco e o contexto.

É o mapa do porte da fase 4: cada linha vira um destaque em app/destaques/secoes/<secao>.py.

    python ferramentas/mapa_destaques.py [secao ...]
"""
import os
import re
import subprocess
import sys

KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
TAG = 'gabarito-v1'


def trechos(js):
    """Cada chamada ins('regra', {...}) com o H3/bloco mais próximo acima."""
    fora = []
    bloco = None
    for m in re.finditer(r"H3\([^;]*?'([a-z0-9_\-]+)'\s*\)|ins\('([A-Za-z]+)'((?:[^()]|\([^()]*\))*)\)", js):
        if m.group(1):
            bloco = m.group(1)
            continue
        regra = m.group(2)
        ctx = re.sub(r'\s+', ' ', (m.group(3) or '')).strip(' ,')
        fora.append((bloco, regra, ctx[:400]))
    return fora


def main():
    js = subprocess.run(['git', '-C', KIT, 'show', TAG + ':app.js'], capture_output=True, text=True,
                        encoding='utf-8').stdout
    # o corpo de cada seção: da função render/draw até a próxima de nível zero
    secoes = {}
    for m in re.finditer(r'^function (render|draw)([A-Za-z0-9_]+)\(', js, re.M):
        nome = m.group(2)
        fim = js.find('\nfunction ', m.end())
        secoes[m.group(1) + nome] = js[m.start():fim if fim > 0 else len(js)]
    alvo = [s.lower() for s in sys.argv[1:]]
    for nome, corpo in secoes.items():
        if alvo and not any(a in nome.lower() for a in alvo):
            continue
        linhas = trechos(corpo)
        if not linhas:
            continue
        print('\n=== %s (%d chamadas)' % (nome, len(linhas)))
        for bloco, regra, ctx in linhas:
            print('  [%-22s] %-26s %s' % (bloco or '?', regra, ctx))


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""
Ferramentas do gabarito para o porte (fase 3).

    python ferramentas/gabarito.py sem-destaques [2026-07]
        Gera, na pasta do gabarito do Kit, relatorio_sem_destaques.html (o aprovado sem o script
        de destaques) e retrato_sem_destaques.json. É a régua da fase 3: os destaques só chegam
        na fase 4, então o cálculo portado é comparado sem as réguas.

    python ferramentas/gabarito.py importar [2026-07]
        Extrai os dados (blobs window.X) do relatório do gabarito para
        data/competencias/<aaaa-mm>/<NOME>.json — a competência que a aplicação lê.
"""
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'


def pasta_gabarito(comp):
    return os.path.join(KIT, '_referencia', 'gabarito', comp)


def blobs_do_html(html):
    m = re.search(r'<script>(window\.DATA=.*?)</script>', html, re.S)
    corpo, out, pos, dec = m.group(1), [], 0, json.JSONDecoder()
    for mm in re.finditer(r'window\.([A-Z_]+)=', corpo):
        if mm.start() < pos:
            continue
        val, fim = dec.raw_decode(corpo, mm.end())
        out.append((mm.group(1), val))
        pos = fim
    return out


def sem_destaques(comp):
    g = pasta_gabarito(comp)
    html = io.open(os.path.join(g, 'relatorio.html'), encoding='utf-8').read()
    scripts = list(re.finditer(r'<script>(.*?)</script>', html, re.S))
    alvo = [s for s in scripts if 'camada de destaques' in s.group(1)[:300]]
    if len(alvo) != 1:
        sys.exit('não achei exatamente um script de destaques (%d)' % len(alvo))
    s = alvo[0]
    novo = html[:s.start()] + html[s.end():]
    saida = os.path.join(g, 'relatorio_sem_destaques.html')
    io.open(saida, 'w', encoding='utf-8', newline='').write(novo)
    sys.path.insert(0, os.path.join(KIT, 'ferramentas'))
    import retrato
    r = retrato.extrair(retrato.renderizar(saida))
    json.dump(r, open(os.path.join(g, 'retrato_sem_destaques.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('retrato sem destaques: %d blocos -> %s' % (len(r['ordem']), g))


def importar(comp):
    g = pasta_gabarito(comp)
    html = io.open(os.path.join(g, 'relatorio.html'), encoding='utf-8').read()
    destino = os.path.join(RAIZ, 'data', 'competencias', comp)
    os.makedirs(destino, exist_ok=True)
    for nome, val in blobs_do_html(html):
        json.dump(val, open(os.path.join(destino, nome + '.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, separators=(',', ':'))
    print('competência %s importada: %s' % (comp, ', '.join(sorted(os.listdir(destino)))))


if __name__ == '__main__':
    acao = sys.argv[1] if len(sys.argv) > 1 else ''
    comp = sys.argv[2] if len(sys.argv) > 2 else '2026-07'
    {'sem-destaques': sem_destaques, 'importar': importar}.get(acao, lambda c: sys.exit(__doc__))(comp)

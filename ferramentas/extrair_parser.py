# -*- coding: utf-8 -*-
"""
Copia do Kit congelado (tag gabarito-v1) a LEITURA DAS PLANILHAS do gerar_relatorio.py para
app/importacao/kit_parser.py — o mesmo código que produziu o gabarito, agora rodando dentro do app
na importação mensal.

O que não vem: a montagem do HTML (montar_html/montar_doc/main), que é do Kit, não do app.
O que muda: as pastas deixam de ser fixas ao lado do script e passam por definir_pastas(), porque
cada competência tem a sua.

    python ferramentas/extrair_parser.py
"""
import os
import re
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
TAG = 'gabarito-v1'
DESTINO = os.path.join(RAIZ, 'app', 'importacao', 'kit_parser.py')

CABECALHO = '''# -*- coding: utf-8 -*-
"""Leitura das planilhas — GERADO por ferramentas/extrair_parser.py a partir do gerar_relatorio.py
do Kit na tag %s. Não editar à mão: é o mesmo código que leu as fontes do gabarito.

A montagem do HTML não vem junto (isso é do Kit). As pastas de cada competência entram por
definir_pastas(); o resto do arquivo é cópia literal.
"""
import calendar
import datetime
import difflib
import glob
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict

import openpyxl
from openpyxl.utils.datetime import to_excel

# pastas da competência em processamento (definir_pastas troca as três de uma vez)
AQUI = os.path.dirname(os.path.abspath(__file__))
FONTES = os.path.join(AQUI, 'fontes')
FONTES_CUSTOS = os.path.join(FONTES, 'Custos')
SAIDA = None


def definir_pastas(fontes, custos=None, base=None):
    """Aponta o parser para as fontes de uma competência. `base` é onde ficam config_apresentacao.json
    e o Modelo_Gerencial_Fabrica_Loja (o "ao lado do script" do Kit)."""
    global AQUI, FONTES, FONTES_CUSTOS
    FONTES = fontes
    FONTES_CUSTOS = custos or os.path.join(fontes, 'Custos')
    AQUI = base or fontes


''' % TAG


def main():
    py = subprocess.run(['git', '-C', KIT, 'show', TAG + ':gerar_relatorio.py'], capture_output=True,
                        text=True, encoding='utf-8').stdout
    corte = py.index('def montar_html(')
    corpo = py[:corte]
    # o cabeçalho original (docstring, imports e as pastas fixas) é substituído pelo nosso
    i = corpo.index("def achar_estrito(")
    corpo = corpo[i:]
    # comentário que pertencia às constantes removidas
    corpo = re.sub(r'^# .*\n(?=def achar_estrito)', '', corpo)
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, 'w', encoding='utf-8') as f:
        f.write(CABECALHO + corpo.rstrip() + '\n')
    linhas = corpo.count('\n')
    funcs = len(re.findall(r'^def ', corpo, re.M))
    print('kit_parser.py: %d funções, %d linhas (do gerar_relatorio.py na tag %s)' % (funcs, linhas, TAG))


if __name__ == '__main__':
    main()

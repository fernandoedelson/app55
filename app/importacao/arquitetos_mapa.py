# -*- coding: utf-8 -*-
"""Escritórios de arquitetura das carteiras dos vendedores, localizados por cidade para a camada "Arquitetos" do Mapa de vendas.

Cada vendedor mantém uma planilha de carteira (aba CARTEIRA, e CARTEIRA B quando existir) com o escritório, o contato e o endereço.
Daqui sai só o que o mapa usa: o escritório, o vendedor e a cidade — telefone, e-mail, CPF e o plano de ação ficam de fora de propósito.
A cidade vira um ponto (latitude, longitude) pela tabela de municípios do IBGE (dados/municipios_br.json, gerada por
ferramentas/gerar_municipios_br.py). O que não der para localizar (cidade vazia, "SP" no lugar da cidade, nome que não existe naquela UF)
fica contado em `sem_cidade` e não vira ponto.

Blob ARQUITETOS_MAPA:
    {'fonte': [arquivos], 'cidades': {'SP|SAO PAULO': ['São Paulo', 'SP', -23.55, -46.63]},
     'escritorios': [[escritório, vendedor, 'SP|SAO PAULO' ou None, UF ou None]], 'sem_cidade': n}
"""
import glob
import json
import os
import re
import unicodedata

import openpyxl

_MUN = None
UFS = {'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
       'RO', 'RR', 'SC', 'SP', 'SE', 'TO'}


def _municipios():
    global _MUN
    if _MUN is None:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dados', 'municipios_br.json'), encoding='utf-8') as f:
            _MUN = json.load(f)
    return _MUN


def chave(texto):
    s = unicodedata.normalize('NFD', str(texto or '')).encode('ascii', 'ignore').decode().upper()
    return ' '.join(re.sub(r'[^A-Z0-9]+', ' ', s).split())


def _cidade(cidade, uf):
    """(chave 'UF|CIDADE', nome, uf, lat, lon) ou None."""
    mun, c = _municipios(), chave(cidade)
    if not c or c in UFS:                                  # vazio, ou a sigla da UF digitada no lugar da cidade
        return None
    uf = chave(uf)
    ufs = [uf] if uf in UFS else [u for u in mun if c in mun[u]]
    achados = [(u, mun[u][c]) for u in ufs if u in mun and c in mun[u]]
    if len(achados) != 1:                                  # inexistente na UF, ou ambígua sem UF
        return None
    u, (lat, lon, nome) = achados[0]
    return u + '|' + c, nome, u, lat, lon


def _linhas(ws):
    """(cabeçalho normalizado -> posição, linhas de dados), ou None se a aba não for uma carteira."""
    it = ws.iter_rows(values_only=True)
    cab = next(it, None)
    if not cab:
        return None
    pos = {}
    for i, v in enumerate(cab):
        n = chave(v)
        if n and n not in pos:
            pos[n] = i
    if 'ESCRITORIO' not in pos or not ({'CIDADE', 'ESTADO'} & set(pos)):
        return None
    return pos, it


def ler(pasta):
    """Blob ARQUITETOS_MAPA das planilhas de carteira da pasta, ou None se não houver nenhuma."""
    arquivos = sorted(f for f in glob.glob(os.path.join(pasta, '*.xlsx')) if not os.path.basename(f).startswith('~$'))
    cidades, escritorios, vistos, sem_cidade, usados = {}, [], set(), 0, []
    for f in arquivos:
        base = os.path.basename(f)
        m = re.search(r'-\s*([^.]+)\.xlsx$', base)
        vend_arquivo = chave(m.group(1)) if m else chave(os.path.splitext(base)[0])
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        try:
            achou = False
            for ws in wb.worksheets:
                if 'CARTEIRA' not in chave(ws.title):
                    continue
                lido = _linhas(ws)
                if not lido:
                    continue
                achou = True
                pos, it = lido
                g = lambda r, k: r[pos[k]] if k in pos and pos[k] < len(r) else None
                for r in it:
                    nome = str(g(r, 'ESCRITORIO') or '').strip()
                    if not nome:
                        continue
                    vend = chave(g(r, 'VENDEDOR')) or vend_arquivo
                    k = (chave(nome), vend)
                    if k in vistos:
                        continue
                    vistos.add(k)
                    loc = _cidade(g(r, 'CIDADE'), g(r, 'ESTADO'))
                    if loc:
                        cidades.setdefault(loc[0], [loc[1], loc[2], loc[3], loc[4]])
                        escritorios.append([nome, vend, loc[0], loc[2]])
                    else:
                        sem_cidade += 1
                        escritorios.append([nome, vend, None, None])
            if achou:
                usados.append(base)
        finally:
            wb.close()
    if not escritorios:
        return None
    return {'fonte': usados, 'cidades': cidades, 'escritorios': escritorios, 'sem_cidade': sem_cidade}

# -*- coding: utf-8 -*-
"""Mapa de vendas: a leitura da aba MPP DB do Painel, o payload da seção e a página."""
import datetime
import os

import openpyxl

from app.calculo.secoes import mapa
from app.importacao import mapa_vendas

CAB = ['COD EMP', 'PEDIDO', 'NUM NF', 'DT EMIS', 'COD CLI', 'DESCRICAO CLIENTE', 'UF', 'DESC TECNICA', 'QTDE', 'UMP', 'Personalizar',
       'ROB', 'ROB Produto', 'Mês', 'Ano']


def _painel(tmp_path, linhas):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'MPP DB'
    ws.append(CAB)
    for i, (ped, cli, uf, prod, q, rob, dt) in enumerate(linhas, start=1):
        ws.append([1, ped, 100 + i, dt, 1, cli, uf, prod, q, 'PC', 'CLIENTE', rob, rob, dt.month, dt.year])
    caminho = str(tmp_path / 'Painel Resultado.xlsx')
    wb.save(caminho)
    return caminho


D = datetime.datetime
LINHAS = [(1201, 'CLIENTE A', 'SP', 'SOFA', 2, 1000.0, D(2026, 1, 7)),
          (1201, 'CLIENTE A', 'SP', 'SOFA', 1, 500.0, D(2026, 1, 20)),        # mesmo pedido, produto e mês: soma
          (1202, 'CLIENTE B', 'EX', 'MESA', 1, 300.0, D(2026, 2, 3)),
          (1203, 'CLIENTE C', None, 'CADEIRA', 4, 200.0, D(2026, 3, 9)),
          (1204, 'CLIENTE D', 'RJ', 'POLTRONA', 1, 900.0, D(2026, 4, 1))]


def test_le_a_aba_e_soma_as_linhas_iguais(tmp_path):
    b = mapa_vendas.ler(_painel(tmp_path, LINHAS))
    assert b['ate'] == 202604 and len(b['rows']) == 4
    sofa = [r for r in b['rows'] if r[4] == 'SOFA'][0]
    assert sofa == [202601, 'SP', '1201', 'CLIENTE A', 'SOFA', 3.0, 1500.0]
    assert {r[1] for r in b['rows']} == {'SP', 'EX', 'ND', 'RJ'}            # exterior e sem UF ficam identificados


def test_corta_o_que_vem_depois_do_mes_processado(tmp_path):
    b = mapa_vendas.ler(_painel(tmp_path, LINHAS), ate_ym=202602)
    assert b['ate'] == 202602 and {r[0] for r in b['rows']} == {202601, 202602}


def test_sem_a_aba_nao_ha_blob(tmp_path):
    wb = openpyxl.Workbook()
    wb.active.title = 'OUTRA'
    caminho = str(tmp_path / 'x.xlsx')
    wb.save(caminho)
    assert mapa_vendas.ler(caminho) is None


class _C:
    def __init__(self, blobs):
        self.b = blobs

    def blob(self, nome):
        return self.b.get(nome)


def test_payload_leva_as_linhas_e_os_padroes_de_pr():
    blob = {'fonte': 'Painel.xlsm', 'ate': 202609, 'rows': [[202609, 'SP', '1', 'SEARA ALIMENTOS', 'SOFA', 1.0, 10.0]]}
    p = mapa.calcular(_C({'MAPAVENDAS': blob, 'PARTES_RELACIONADAS': ['SEARA']}))
    assert p['mapa-uf']['rows'] == blob['rows'] and p['mapa-uf']['pr_padroes'] == ['SEARA']
    assert p['mapa.abertura'] == {'fonte': 'Painel.xlsm', 'ate': 202609, 'n': 1}


def test_sem_blob_a_secao_avisa_em_vez_de_quebrar():
    p = mapa.calcular(_C({}))
    assert p['mapa-uf'] == {'ausente': True} and p['mapa.abertura'] == {'ausente': True}


def test_a_pagina_do_mapa_abre_e_carrega_o_desenho(app, admin):
    r = admin.get('/biblioteca/mapa')
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert 'relatorio/mapa_br.js' in html and 'relatorio/secoes/mapa.js' in html


def test_o_desenho_do_brasil_tem_os_27_estados():
    js = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'static', 'relatorio', 'mapa_br.js'),
              encoding='utf-8').read()
    for uf in ('SP', 'AM', 'DF', 'RS', 'AC'):
        assert '"%s":"M' % uf in js


# ---------------------------------------------------------------- camada Arquitetos (escritórios das carteiras)
def _carteira(tmp_path, nome, linhas):
    from app.importacao import arquitetos_mapa  # noqa: F401  (garante o módulo importável)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'CARTEIRA '
    ws.append(['ORIGEM', 'VENDEDOR', 'ESCRITÓRIO', 'NOME', 'TELEFONE ', 'E-MAIL', 'ENDEREÇO', 'CIDADE ', 'ESTADO', 'CEP', 'CPF'])
    for esc, vend, cidade, uf in linhas:
        ws.append(['X', vend, esc, 'Fulano', '11 99999-9999', 'a@b.com', 'RUA A', cidade, uf, '01000-000', '123.456.789-00'])
    outra = wb.create_sheet('ANIVERSÁRIO')
    outra.append(['MÊS', 'VENDEDOR', 'ESCRITÓRIO'])
    pasta = tmp_path / 'carteiras'
    pasta.mkdir(exist_ok=True)
    wb.save(str(pasta / nome))
    return str(pasta)


def test_localiza_o_escritorio_pela_cidade_e_nao_leva_dado_pessoal(tmp_path):
    from app.importacao import arquitetos_mapa
    pasta = _carteira(tmp_path, 'CARTEIRA 2026 - ANA.xlsx', [
        ('ESCRITORIO UM', 'ANA', 'SÃO PAULO', 'SP'), ('ESCRITORIO DOIS', 'ANA', 'Sao Paulo ', 'sp'),
        ('ESCRITORIO TRES', 'ANA', 'SP', 'SP'),                 # sigla no lugar da cidade: não localiza
        ('ESCRITORIO QUATRO', 'ANA', 'CIDADE QUE NAO EXISTE', 'RJ'), ('ESCRITORIO CINCO', 'ANA', 'Rio de Janeiro', 'RJ')])
    b = arquitetos_mapa.ler(pasta)
    assert b['fonte'] == ['CARTEIRA 2026 - ANA.xlsx'] and b['sem_cidade'] == 2 and len(b['escritorios']) == 5
    assert set(b['cidades']) == {'SP|SAO PAULO', 'RJ|RIO DE JANEIRO'}
    lat, lon = b['cidades']['SP|SAO PAULO'][2:]
    assert -24 < lat < -23 and -47 < lon < -46               # o ponto é mesmo o de São Paulo
    texto = str(b)
    assert '99999' not in texto and '123.456' not in texto and 'a@b.com' not in texto   # telefone, CPF e e-mail ficam de fora


def test_o_mesmo_escritorio_no_mesmo_vendedor_conta_uma_vez(tmp_path):
    from app.importacao import arquitetos_mapa
    pasta = _carteira(tmp_path, 'CARTEIRA 2026 - ANA.xlsx', [('ESC', 'ANA', 'CAMPINAS', 'SP'), ('ESC', 'ANA', 'CAMPINAS', 'SP')])
    assert len(arquitetos_mapa.ler(pasta)['escritorios']) == 1


def test_sem_planilha_de_carteira_nao_ha_blob(tmp_path):
    from app.importacao import arquitetos_mapa
    assert arquitetos_mapa.ler(str(tmp_path)) is None


def test_payload_do_mapa_leva_a_camada_quando_ha_blob():
    blob = {'fonte': ['x.xlsx'], 'cidades': {}, 'escritorios': [], 'sem_cidade': 0}
    p = mapa.calcular(_C({'MAPAVENDAS': {'fonte': 'P', 'ate': 202609, 'rows': [[202609, 'SP', '1', 'C', 'S', 1.0, 1.0]]}, 'ARQUITETOS_MAPA': blob}))
    assert p['mapa-uf']['arq'] == blob
    p2 = mapa.calcular(_C({'MAPAVENDAS': {'fonte': 'P', 'ate': 202609, 'rows': [[202609, 'SP', '1', 'C', 'S', 1.0, 1.0]]}}))
    assert p2['mapa-uf']['arq'] is None                       # sem as carteiras, o mapa segue só com as vendas

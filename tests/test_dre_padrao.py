# -*- coding: utf-8 -*-
"""DRE no padrão da empresa (aba DRE DINÂMICO): payload do servidor, recorte e o avaliador de fórmulas."""
import json
import os
import shutil
import subprocess

import pytest

from app.calculo import competencia as comp_mod
from app.calculo.secoes import dre
from app.importacao import recorte

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
precisa_dados = pytest.mark.skipif(not os.path.isfile(os.path.join(REAL, 'DREDIN.json')),
                                   reason='sem a competência 2026-07 (com DREDIN) nesta máquina')


def _blob():
    meses = [1.0] * 12
    return {'molde': {}, 'unidades': ['CONSOLIDADO'], 'anos': [2025, 2026, 2027],
            'dados': {'REAL': {'2025': {'CONSOLIDADO': {'1': meses}}, '2026': {'CONSOLIDADO': {'1': [5.0] * 12}},
                               '2027': {'CONSOLIDADO': {'1': meses}}},
                      'ORÇADO': {'2026': {'CONSOLIDADO': {'1': [7.0] * 12}}, '2027': {'CONSOLIDADO': {'1': meses}}}}}


def test_recorte_da_dre_no_padrao_zera_o_real_depois_do_corte_e_mantem_o_orcado():
    c = recorte.dredin(_blob(), 202608)
    assert c['anos'] == [2025, 2026] and '2027' not in c['dados']['REAL']
    assert c['dados']['REAL']['2026']['CONSOLIDADO']['1'] == [5.0] * 8 + [0] * 4
    assert c['dados']['REAL']['2025']['CONSOLIDADO']['1'] == [1.0] * 12          # ano anterior inteiro
    assert c['dados']['ORÇADO']['2026']['CONSOLIDADO']['1'] == [7.0] * 12        # orçamento é plano, não realizado
    assert '2027' in c['dados']['ORÇADO']
    b = _blob()
    assert recorte.dredin(b, None) is b


@precisa_dados
def test_servidor_manda_o_molde_e_so_os_numeros_da_unidade_e_do_ano():
    C = comp_mod.Competencia('2026-07', REAL)
    t = dre.calcular(C, {})['dre-tabela']
    assert t['padrao'] == {'unidade': 'CONSOLIDADO', 'ano': 2026, 'mes': 7} and t['molde']['linhas']
    assert set(t['dados']['REAL']) == {'2025', '2026'} and set(t['dados']['ORÇADO']) == {'2026'}
    assert set(t['dados']['REAL']['2026']) == {'CONSOLIDADO'}
    d = dre.calcular(C, {'dd_un': '55 DESIGN', 'dd_ano': '2025'})
    assert d['dre-snap']['padrao']['unidade'] == '55 DESIGN' and d['dre-snap']['padrao']['ano'] == 2025
    assert set(d['dre-snap']['dados']['REAL']['2025']) == {'55 DESIGN'}
    # entradas inválidas caem no padrão
    r = dre.calcular(C, {'dd_un': 'XYZ', 'dd_ano': '1999'})['dre-tabela']['padrao']
    assert (r['unidade'], r['ano']) == ('CONSOLIDADO', 2026)


@precisa_dados
@pytest.mark.skipif(shutil.which('node') is None, reason='sem node para rodar o avaliador')
def test_avaliador_fecha_com_a_dre_lida_por_outro_caminho():
    """A receita bruta acumulada que o avaliador calcula (fórmulas da aba + SUMIF por conta) tem de ser a soma dos meses
    da DRE que a aplicação já lia (parse_dre → DPNL), por outro caminho de leitura."""
    dpnl = json.load(open(os.path.join(REAL, 'DPNL.json'), encoding='utf-8'))
    esperado = sum(dpnl['CONSOLIDADO']['2026']['receita_bruta'][:7])
    js = r"""
global.window = {}; global.document = {getElementById(){return null}, createElement(){return {}}, head:{appendChild(){}}, addEventListener(){}};
const fs = require('fs');
const U = require(%r);
const D = JSON.parse(fs.readFileSync(%r, 'utf8'));
const g = U.grade(D.molde, D.dados, {unidade: 'CONSOLIDADO', ano: 2026, mes: 7});
console.log(JSON.stringify({K10: g.K(10), E10: g.E(10), F10: g.F(10)}));
""" % (os.path.join(RAIZ, 'app', 'static', 'relatorio', 'dredin.js').replace('\\', '/'),
       os.path.join(REAL, 'DREDIN.json').replace('\\', '/'))
    saida = subprocess.run(['node', '-e', js], capture_output=True, text=True, encoding='utf-8', timeout=60)
    assert saida.returncode == 0, saida.stderr
    v = json.loads(saida.stdout.strip().splitlines()[-1])
    assert abs(v['K10'] - esperado) < 1
    assert v['F10'] > 0 and v['E10'] > 0                                          # orçamento e mês do ano também chegam


def test_desenho_da_dre_usa_o_componente():
    js = open(os.path.join(RAIZ, 'app', 'static', 'relatorio', 'secoes', 'dre.js'), encoding='utf-8').read()
    assert 'dd-host' in js and 'DREDIN_UI.montar' in js and 'dd_un' in js
    assert os.path.isfile(os.path.join(RAIZ, 'app', 'static', 'relatorio', 'dredin.js'))
    assert os.path.isfile(os.path.join(RAIZ, 'app', 'importacao', 'dre_dinamico_molde.json'))


@precisa_dados
def test_apresentacao_em_atos_leva_o_componente_da_dre():
    """O gerador do Atos monta os scripts por conta própria: sem o dredin.js os blocos da DRE saíam vazios."""
    from app.apresentacao import kit_atos
    html = kit_atos.gerar(REAL)
    assert 'window.DREDIN_UI' in html and 'class="dd-host"' in html and 'window.DREDIN=' in html

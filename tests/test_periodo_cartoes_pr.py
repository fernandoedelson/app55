# -*- coding: utf-8 -*-
"""Cartões da Análise por período (tabela mês a mês), memória de cálculo e legenda de parte relacionada."""
import os

import pytest

from app.calculo import competencia as comp_mod
from app.calculo.secoes import carteira, periodo

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
precisa_dados = pytest.mark.skipif(not os.path.isfile(os.path.join(REAL, 'DATA.json')),
                                   reason='sem a competência 2026-07 nesta máquina')


@precisa_dados
def test_periodo_manda_o_mes_a_mes_que_fecha_com_os_cartoes():
    C = comp_mod.Competencia('2026-07', REAL)
    ab = periodo.calcular(C, {})['periodo.abertura']
    meses = ab['mensal']
    assert meses and [m[0] for m in meses] == sorted(m[0] for m in meses)
    assert abs(sum(m[1] for m in meses) - ab['total']) < 1            # venda: a soma dos meses é o total
    assert abs(sum(m[3] for m in meses) - ab['qnt']) < 0.01           # quantidade idem
    # pedido que atravessa meses conta em cada um; o total conta uma vez só
    assert sum(m[2] for m in meses) >= ab['peds']


@precisa_dados
def test_carteiras_mandam_as_partes_relacionadas():
    C = comp_mod.Competencia('2026-07', REAL)
    assert carteira.calcular_carteira(C, {})['ce-peds']['pr'] == carteira._partes_relacionadas(C)
    assert 'pr' in carteira.calcular_dinamica(C, {})['cd-peds']
    assert 'JJMB' in carteira._partes_relacionadas(C)


def test_kit_tem_memoria_de_calculo_e_legenda_pr():
    kit = open(os.path.join(RAIZ, 'app', 'static', 'relatorio', 'kit.js'), encoding='utf-8').read()
    assert 'const MEMORIA=' in kit and 'memAttr(memoria(h))' in kit        # cabeçalhos de tabela
    assert 'function prLegenda' in kit and 'function peKpiLigar' in kit
    css = open(os.path.join(RAIZ, 'app', 'static', 'relatorio', 'style2.css'), encoding='utf-8').read()
    assert '.pe-kpi-tab' in css and '.pr-tag' in css

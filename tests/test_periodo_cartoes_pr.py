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


@precisa_dados
def test_carteiras_mandam_o_valor_de_pr_por_status_faixa_vendedor_e_mes():
    C = comp_mod.Competencia('2026-07', REAL)
    base = carteira.calcular_carteira(C, {})
    assert base['carteira.abertura']['pr']['total'] > 0
    st = base['ce-status']
    assert len(st['pr_stat']) == len(st['stat']) and abs(sum(st['pr_stat']) - st['pr_total']) < 1
    assert isinstance(base['ce-vend']['pr'], dict) and set(st['pr_base']['aging']) <= {x[0] for x in st['aging']}
    din = carteira.calcular_dinamica(C, {})
    assert abs(sum(din['cd-status']['pr_status']) - din['carteira_dinamica.abertura']['pr_total']) < 1
    assert len(din['cd-evol']['pr'][0]) == len(din['cd-evol']['evol']['yms'])
    assert len(din['cd-adiados']['pr'][0]) == len(din['cd-adiados']['evol']['yms'])
    assert len(din['cd-previsao']['pr'][0]) == len(din['cd-previsao']['evol']['yms'])
    # PR nunca passa do total de cada recorte
    assert all(p <= v + 0.01 for p, v in zip(din['cd-evol']['pr'][0], din['cd-evol']['evol']['vendas']))


def test_kit_desenha_o_pr_nos_graficos():
    kit = open(os.path.join(RAIZ, 'app', 'static', 'relatorio', 'kit.js'), encoding='utf-8').read()
    for nome in ('prTom', 'prRect', 'prCap', 'prSoma', 'partes=null'):
        assert nome in kit


def test_grafico_anual_leva_a_projecao_e_a_previa_do_pilotar_filtra_o_bloco(app, admin):
    kit = open(os.path.join(RAIZ, 'app', 'static', 'relatorio', 'secoes', 'evolutiva.js'), encoding='utf-8').read()
    assert 'proj:_pj?E.anos.length:null' in kit
    # a prévia é a mesma página da seção, com ?previa=<bloco> (sem barra e sem camada de comentário)
    r = admin.get('/biblioteca/resumo?comp=2026-07&previa=rs-hist')
    if r.status_code == 200:
        html = r.get_data(as_text=True)
        assert 'class="previa"' in html and 'header class="rb"' not in html and 'PREV=' in html
    js = open(os.path.join(RAIZ, 'app', 'static', 'pilotar.js'), encoding='utf-8').read()
    assert 'data-previa' in js and 'previa=' in js

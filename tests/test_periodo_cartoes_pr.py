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


@precisa_dados
def test_grafico_em_andamento_por_mes_fecha_com_a_previsao_de_faturamento():
    C = comp_mod.Competencia('2026-07', REAL)
    din = carteira.calcular_dinamica(C, {})
    an, prev = din['cd-andamento'], din['cd-previsao']['evol']
    assert an['yms'] == prev['yms']                                   # mesmos meses de entrega
    assert all(abs(a - b) < 1 for a, b in zip(an['valor'], prev['valor']))   # mesmo valor por mês (a soma dos itens)
    assert all(q > 0 for q in an['qtd'])
    assert an['qtd_pr'] is None or all(0 <= p <= q + 1e-9 for p, q in zip(an['qtd_pr'], an['qtd']))


def test_novo_bloco_esta_no_catalogo_e_na_migracao_de_permissoes():
    from app import catalogo as C
    from app.db import MIGRACOES
    assert 'cd-andamento' in C.BLOCO and C.BLOCO['cd-andamento']['secao'] == 'carteira_dinamica'
    assert any('bloco:cd-andamento' in v for m in MIGRACOES for v in m.values())


@precisa_dados
def test_barras_de_entrega_trazem_os_pedidos_do_mes_que_fecham_com_o_grafico():
    C = comp_mod.Competencia('2026-07', REAL)
    din = carteira.calcular_dinamica(C, {})
    an = din['cd-andamento']
    assert set(an['pedidos']) == {str(y) for y in an['yms']}
    for i, y in enumerate(an['yms']):
        lista = an['pedidos'][str(y)]
        assert abs(sum(p[3] for p in lista) - an['qtd'][i]) < 1e-6          # peças do mês = soma dos pedidos
        assert abs(sum(p[4] for p in lista) - an['valor'][i]) < 1           # valor do mês = soma dos pedidos
        assert [p[4] for p in lista] == sorted((p[4] for p in lista), reverse=True)
    assert din['cd-previsao']['pedidos'] == an['pedidos']                    # o gráfico de previsão usa os mesmos pedidos

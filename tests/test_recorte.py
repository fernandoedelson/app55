# -*- coding: utf-8 -*-
"""Competência reconstruída: planilhas de um mês posterior recortadas no fim do mês pedido."""
from conftest import csrf, post

from app.importacao import recorte


def test_sem_recorte_nada_muda():
    for f, blob in ((recorte.dpnl, {'X': 1}), (recorte.cf_mensal, {'yms': [1]}), (recorte.custos, {'cpv': []}),
                    (recorte.aportes, {'yms': [1]}), (recorte.sem_foto, {'a': 1})):
        assert f(blob, None) is blob
    assert recorte.teto(202609, None) == 202609


def test_dpnl_zera_meses_seguintes_e_derruba_anos_depois():
    d = {'CONSOLIDADO': {'2025': {'receita_bruta': [1] * 12},
                         '2026': {'receita_bruta': list(range(1, 13)), 'volume': list(range(1, 13))},
                         '2027': {'receita_bruta': [9] * 12}}}
    c = recorte.dpnl(d, 202608)['CONSOLIDADO']
    assert sorted(c) == ['2025', '2026']
    assert c['2025']['receita_bruta'] == [1] * 12
    assert c['2026']['receita_bruta'] == [1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0]
    assert c['2026']['volume'] == list(range(1, 13))                 # previsão de produção não é realizado


def test_custos_corta_linhas_com_o_mes_na_coluna_certa():
    b = {'cpv': [[202607, 'A', 1], [202608, 'A', 2], [202609, 'A', 3]],
         'nz_ordens': [['BDC', 202608, 'x'], ['BDC', 202609, 'y']],
         'nz_produtos': [['300104', 'ALMOFADA']], 'rotulos_cta': {'A': 'B'}, 'grupos': ['X']}
    c = recorte.custos(b, 202608)
    assert [r[0] for r in c['cpv']] == [202607, 202608]
    assert c['nz_ordens'] == [['BDC', 202608, 'x']]
    assert c['nz_produtos'] == b['nz_produtos'] and c['rotulos_cta'] == b['rotulos_cta'] and c['grupos'] == b['grupos']


def test_aportes_refaz_os_totais_no_fim_do_mes():
    b = {'yms': [202607, 202608, 202609], 'aporte': [10.0, 20.0, 30.0], 'correcao': [1.0, 2.0, 3.0],
         'remessas': [10.0, 10.0, 10.0], 'recebimentos': [0, -1.0, 0], 'saldo_atual': 33.0,
         'total_remessas': 30.0, 'total_recebimentos': -1.0, 'total_correcao': 3.0}
    c = recorte.aportes(b, 202608)
    assert c['yms'] == [202607, 202608] and c['saldo_atual'] == 22.0
    assert (c['total_remessas'], c['total_recebimentos'], c['total_correcao']) == (20.0, -1.0, 2.0)
    assert recorte.aportes(b, 202606) is None


def test_cf_mensal_e_foto_do_dia():
    b = {'yms': [202607, 202608, 202609], 'rows': [['F', 202608, 'x'], ['F', 202609, 'y']]}
    c = recorte.cf_mensal(b, 202608)
    assert c['yms'] == [202607, 202608] and c['rows'] == [['F', 202608, 'x']]
    assert recorte.sem_foto({'total': 1}, 202608) is None
    assert recorte.teto(202609, 202608) == 202608 and recorte.teto(None, 202608) == 202608


def test_marcar_e_desmarcar_reconstruida(app, admin):
    from app.db import get_db
    post(admin, '/fechamento/nova', codigo='2026-08')
    pagina = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'Marcar como reconstruída' in pagina
    post(admin, '/fechamento/2026-08/reconstruida', ativo='1')
    with app.app_context():
        assert get_db().execute("SELECT reconstruida FROM competencias WHERE codigo='2026-08'").fetchone()[0] == 1
    assert '(reconstruída)' in admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert '(reconstruída)' in admin.get('/fechamento/').get_data(as_text=True)
    post(admin, '/fechamento/2026-08/reconstruida', ativo='0')
    with app.app_context():
        assert get_db().execute("SELECT reconstruida FROM competencias WHERE codigo='2026-08'").fetchone()[0] == 0

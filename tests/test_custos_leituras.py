# -*- coding: utf-8 -*-
"""Custos: o servidor manda os agregados no formato do Kit para o motor de leitura (leituras.js), o teto do
período é o último mês de TODAS as bases e os destaques de custo fixo caem no motor automático como no Kit."""
import json
import os

import pytest

from app.calculo import competencia as comp_mod
from app.calculo.secoes import custosx

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
precisa_dados = pytest.mark.skipif(not os.path.isfile(os.path.join(REAL, 'CUSTOS.json')),
                                   reason='sem a competência 2026-07 nesta máquina')


@precisa_dados
def test_executivo_manda_os_agregados_do_kit():
    C = comp_mod.Competencia('2026-07', REAL)
    out = custosx.calcular(C, {})
    ab = out['custosx.abertura']
    assert 'pontos' not in ab                                  # os números do texto antigo saíram
    a, prev = ab['agg']['a'], ab['agg']['prev']
    for chave in ('ymMin', 'ymMax', 'total', 'grupos', 'produtos', 'materiais', 'materiaisTop', 'cc', 'ccTotal',
                  'retrabalho', 'assistencia'):
        assert chave in a and (prev is None or chave in prev)
    assert set(ab['janela']) == {'materiais_item', 'cpp', 'cpv'}
    assert all(r[1] == 'MATERIAIS' for r in ab['janela']['cpv'])
    assert 'ta' in out['cx-grp'] and 'tb' in out['cx-grp']
    assert len(out['cx-grupos']['grupos']) >= len(out['cx-grupos']['top'])
    json.dumps(out)                                            # tudo vai para o navegador como JSON


@precisa_dados
def test_detalhe_do_driver_manda_todos_os_produtos_do_grupo():
    C = comp_mod.Competencia('2026-07', REAL)
    grp = custosx.calcular(C, {})['cx-drivers']['grupos'][0][0]
    r = custosx.produtos_do_driver(C, {'grp': grp})
    assert r['n'] == len(r['produtos']) and r['n'] > 0         # antes só os 3 a 5 maiores; agora o desenho escolhe
    assert all(len(p) == 5 for p in r['produtos'])
    assert r['grupo']['grp'] == grp


def test_teto_dos_custos_e_o_ultimo_mes_de_todas_as_bases(tmp_path):
    cu = {'cpv': [[202607, 'A', 1, 1, 1, 1, 1]], 'cpp': [[202607, 'A', 1, 1, 1, 1, 1], [202606, 'A', 1, 1, 1, 1, 1]],
          'materiais': [[202607, 'x', 1]], 'cta': [[202607, 'PRODUTIVO', 'x', 1]], 'cc': [[202607, 'x', 1, 1, 1]],
          'horas': [[202607, 'x', 1]]}
    (tmp_path / 'CUSTOS.json').write_text(json.dumps(cu), encoding='utf-8')
    C = comp_mod.Competencia('2026-07', str(tmp_path))
    assert C.minym_custos == 202607
    assert C.maxym_custos == 202607                            # todas as bases chegam a julho
    cu['cpp'] = [[202606, 'A', 1, 1, 1, 1, 1]]                 # o CPP atrasou um mês
    (tmp_path / 'CUSTOS.json').write_text(json.dumps(cu), encoding='utf-8')
    C = comp_mod.Competencia('2026-07', str(tmp_path))
    assert C.maxym_custos == 202606                            # o teto recua para o último mês que todas têm


def test_custo_fixo_sem_leitura_especifica_cai_no_motor_automatico(tmp_path):
    from app.destaques.secoes import custofixo
    meses = ['Jan/26', 'Feb/26', 'Mar/26', 'Apr/26', 'May/26', 'Jun/26']
    cats = {c: [100.0] * 6 for c in ('Pessoal', 'Facilities', 'Consumo', 'Marketing', 'Terceiros', 'Outros')}
    CF = {'meses': meses, 'cat_fabrica': cats, 'cat_loja': cats, 'categoria': cats,
          'entidade': {'Consolidado': [900, 910, 905, 915, 910, 905], 'Fábrica': [500, 520, 400, 300, 700, 505],
                       'Loja': [400, 390, 505, 615, 210, 400]}}
    (tmp_path / 'CF.json').write_text(json.dumps(CF), encoding='utf-8')
    C = comp_mod.Competencia('2026-07', str(tmp_path))
    blocos = {b: d for b, _lidos, d in custofixo.montar_cf(C, {})}
    # a série consolidada é estável (a leitura de composição não dispara): o Kit cai no motor automático
    assert blocos['cf-ent'] is not None and blocos['cf-ent']['id'].startswith('auto-')

# -*- coding: utf-8 -*-
import json
import os

import pytest

from app import catalogo as C

GABARITO = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design\_referencia\gabarito\2026-07\retrato.json'


def test_ids_unicos_e_secoes_validas():
    ids = [b['id'] for b in C.BLOCOS]
    assert len(ids) == len(set(ids))
    assert all(b['secao'] in C.SECAO for b in C.BLOCOS)
    assert all(C.blocos_da_secao(s['id']) for s in C.SECOES)


def test_titulos_sem_data_do_mes():
    # título é estrutura: não pode carregar ano nem mês de um fechamento
    import re
    for b in C.BLOCOS:
        assert not re.search(r'20\d\d|/2\d\b', b['titulo']), b


@pytest.mark.skipif(not os.path.exists(GABARITO), reason='gabarito do Kit não disponível nesta máquina')
def test_todo_bloco_do_gabarito_esta_no_catalogo():
    ret = json.load(open(GABARITO, encoding='utf-8'))
    faltam = []
    for k in ret['ordem']:
        sid, blk = k.split('/', 1)
        alvo = sid + '.abertura' if blk == '__abre' else blk
        if alvo not in C.BLOCO:
            faltam.append(k)
    assert not faltam


def test_limpar_permissoes_descarta_inventadas():
    assert C.limpar_permissoes(['bloco:dre-ponte', 'bloco:nao-existe', 'recurso:voar', 'admin']) == ['admin', 'bloco:dre-ponte']


def test_fechar_dependencias(monkeypatch):
    monkeypatch.setitem(C.BLOCO['av-rfv'], 'depende_de', ['av-diferenca'])
    monkeypatch.setitem(C.BLOCO['av-diferenca'], 'depende_de', ['av-lider'])
    final, acres = C.fechar_dependencias({'bloco:av-rfv'})
    assert {'bloco:av-rfv', 'bloco:av-diferenca', 'bloco:av-lider'} == final
    assert acres == {'av-rfv': ['av-diferenca'], 'av-diferenca': ['av-lider']}

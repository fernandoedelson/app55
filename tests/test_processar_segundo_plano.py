# -*- coding: utf-8 -*-
"""Processar as bases leva minutos: roda em segundo plano e a tela acompanha (sem requisição presa)."""
import threading
import time

from conftest import post


def _esperar(admin, url, final, limite=10):
    fim = time.time() + limite
    while time.time() < fim:
        d = admin.get(url).get_json()
        if d['estado'] == final:
            return d
        time.sleep(0.05)
    raise AssertionError('o estado %r não chegou: %r' % (final, admin.get(url).get_json()))


def test_processar_nao_prende_a_requisicao(app, admin, monkeypatch):
    from app.importacao import servico
    solta = threading.Event()

    def lento(codigo, login, config_de=None):
        solta.wait(10)                      # simula a leitura das planilhas, que demora
    monkeypatch.setattr(servico, 'processar', lento)
    monkeypatch.setattr(servico, 'faltando', lambda codigo: [])
    monkeypatch.setattr(servico, 'mudou_o_passado', lambda codigo: [])
    post(admin, '/fechamento/nova', codigo='2026-08')

    t0 = time.time()
    r = post(admin, '/fechamento/2026-08/processar')
    assert r.status_code == 302 and time.time() - t0 < 3     # voltou na hora, mesmo com a leitura em curso
    assert admin.get('/fechamento/2026-08/processar/estado').get_json()['estado'] == 'processando'
    html = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'id="proc-andamento"' in html and 'data-ativo="1"' in html and 'processar.js' in html
    # um segundo clique não dispara outra leitura
    post(admin, '/fechamento/2026-08/processar')

    solta.set()
    _esperar(admin, '/fechamento/2026-08/processar/estado', 'ok')
    pagina = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'Dados gerados' in pagina                         # o resultado aparece uma vez, como mensagem
    assert 'Dados gerados' not in admin.get('/fechamento/2026-08').get_data(as_text=True)


def test_erro_na_leitura_aparece_na_tela(app, admin, monkeypatch):
    from app.importacao import servico

    def quebra(codigo, login, config_de=None):
        raise RuntimeError('planilha corrompida')
    monkeypatch.setattr(servico, 'processar', quebra)
    monkeypatch.setattr(servico, 'faltando', lambda codigo: [])
    post(admin, '/fechamento/nova', codigo='2026-08')
    post(admin, '/fechamento/2026-08/processar')
    d = _esperar(admin, '/fechamento/2026-08/processar/estado', 'erro')
    assert 'planilha corrompida' in d['msg']
    assert 'Falha ao ler as planilhas' in admin.get('/fechamento/2026-08').get_data(as_text=True)


def test_sem_as_obrigatorias_avisa_na_hora(app, admin):
    post(admin, '/fechamento/nova', codigo='2026-08')
    r = post(admin, '/fechamento/2026-08/processar')
    assert r.status_code == 302
    assert 'faltam bases obrigatórias' in admin.get('/fechamento/2026-08').get_data(as_text=True)

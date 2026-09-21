# -*- coding: utf-8 -*-
"""Toda tela abre. O painel da Administração quebrou (bloco de template duplicado) e nenhum teste
percebeu, porque nenhum abria a página. Aqui cada template é compilado e cada tela é aberta."""
import os
import shutil

import pytest

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = os.path.join(RAIZ, 'data', 'competencias', '2026-07')


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', 'Inicial12345')
    if os.path.isdir(REAL):
        shutil.copytree(REAL, str(tmp_path / 'competencias' / '2026-07'))
    from app import criar_app
    return criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 't.db'),
                      'SECRET_KEY': 't', 'COMPETENCIAS_DIR': str(tmp_path / 'competencias')})


def test_todos_os_templates_compilam(app):
    env = app.jinja_env
    nomes = [n for n in env.list_templates() if n.endswith('.html')]
    assert nomes
    for nome in nomes:
        env.get_template(nome)          # erro de sintaxe (bloco duplicado, tag aberta) estoura aqui


def test_todas_as_telas_abrem_para_o_administrador(app, admin):
    from app import catalogo as C
    comp = '2026-07' if os.path.isdir(REAL) else None
    admin.get('/fechamento/%s' % comp if comp else '/')          # registra o mês importado
    urls = ['/', '/admin/', '/admin/usuarios', '/admin/usuarios/novo', '/admin/usuarios/1', '/admin/perfis',
            '/admin/perfis/1', '/admin/auditoria', '/fechamento/', '/comentarios/', '/trocar-senha',
            '/como-usar', '/como-usar?perfil=loja', '/como-usar?perfil=controladoria']
    if comp:
        urls += ['/fechamento/%s' % comp, '/fechamento/%s/mudancas' % comp, '/apresentacao/%s' % comp,
                 '/apresentacao/%s/encaminhamentos' % comp, '/apresentacao/', '/apresentacao/%s/pilotar' % comp]
        urls += ['/biblioteca/%s' % s['id'] for s in C.SECOES]
    falhas = []
    for u in urls:
        r = admin.get(u)
        if r.status_code >= 400:
            falhas.append('%s -> %d' % (u, r.status_code))
    assert not falhas, falhas


def test_como_usar_mostra_o_guia_da_area(app, admin):
    """Cada perfil lê só os capítulos do que faz; o administrador confere o guia de qualquer área."""
    from conftest import criar_usuario, entrar, post
    prov = criar_usuario(app, admin, 'lojaguia', ['loja'])
    c = app.test_client()
    entrar(c, 'lojaguia', prov)
    post(c, '/trocar-senha', new_password='LojaGuia2026abc', confirm_password='LojaGuia2026abc')
    g = c.get('/como-usar').get_data(as_text=True)
    assert 'O guia de <b>Loja</b>' in g and 'Comentar um gráfico pela sua área' in g
    assert 'Fechar o mês' not in g and 'Montar a reunião' not in g and 'Administração</h2>' not in g
    assert 'Ver o guia de' not in g                                   # só o administrador troca de perfil
    ctrl = admin.get('/como-usar?perfil=controladoria').get_data(as_text=True)
    assert 'Fechar o mês' in ctrl and 'Montar a reunião (pilotar)' in ctrl and 'Administração</h2>' not in ctrl
    assert 'Administração</h2>' in admin.get('/como-usar').get_data(as_text=True)

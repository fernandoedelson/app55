# -*- coding: utf-8 -*-
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SENHA_ADMIN = 'Inicial12345'
SENHA_NOVA = 'NovaSenha2026'


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', SENHA_ADMIN)
    from app import criar_app
    a = criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 'teste.db'),
                   'SECRET_KEY': 'chave-de-teste', 'LIMITE_IP_TENTATIVAS': 15})
    return a


@pytest.fixture
def client(app):
    return app.test_client()


def csrf(client):
    """Garante um token de CSRF na sessão do cliente e devolve o valor."""
    client.get('/entrar')
    with client.session_transaction() as s:
        return s['_csrf']


def entrar(client, login, senha):
    return client.post('/entrar', data={'username': login, 'password': senha, 'csrf_token': csrf(client)})


def post(client, url, **dados):
    dados['csrf_token'] = csrf(client)
    return client.post(url, data=dados)


@pytest.fixture
def admin(client):
    """Cliente logado como administrador, já com a senha provisória trocada."""
    entrar(client, 'admin', SENHA_ADMIN)
    r = post(client, '/trocar-senha', new_password=SENHA_NOVA, confirm_password=SENHA_NOVA)
    assert r.status_code == 302
    return client


def criar_usuario(app, admin_client, login, perfis_codigos):
    """Cria usuário pela tela de admin e devolve a senha provisória mostrada ao admin."""
    from app.db import get_db
    with app.app_context():
        ids = [get_db().execute('SELECT id FROM perfis WHERE codigo=?', (c,)).fetchone()['id'] for c in perfis_codigos]
    dados = {'login': login, 'nome': login.title(), 'email': login + '@exemplo.com', 'csrf_token': csrf(admin_client)}
    r = admin_client.post('/admin/usuarios/novo', data={**dados, 'perfis': [str(i) for i in ids]}, follow_redirects=True)
    texto = r.get_data(as_text=True)
    import re
    m = re.search(r'Senha provisória de %s: (\S+) —' % re.escape(login), texto)
    assert m, texto[:2000]
    return m.group(1)

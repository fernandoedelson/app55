# -*- coding: utf-8 -*-
"""A Biblioteca só entrega os blocos que o perfil pode ver — o dado dos outros nem sai do servidor."""
import json
import os
import re

import pytest

from conftest import criar_usuario, csrf, entrar, post

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMP = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
pytestmark = pytest.mark.skipif(not os.path.isdir(COMP), reason='competência 2026-07 não importada nesta máquina')


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', 'Inicial12345')
    from app import criar_app
    return criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 't.db'),
                      'SECRET_KEY': 't', 'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')})


def _payload(html):
    m = re.search(r'<script type="application/json" id="payload">(.*?)</script>', html, re.S)
    return json.loads(m.group(1))


def _perfil_com(app, admin, nome, perms):
    admin.post('/admin/perfis/novo', data={'nome': nome, 'csrf_token': csrf(admin)})
    from app.db import get_db
    with app.app_context():
        pid = get_db().execute('SELECT id FROM perfis WHERE nome=?', (nome,)).fetchone()['id']
        codigo = get_db().execute('SELECT codigo FROM perfis WHERE id=?', (pid,)).fetchone()['codigo']
    admin.post('/admin/perfis/%d' % pid, data={'nome': nome, 'perm': perms, 'csrf_token': csrf(admin)})
    return codigo


def test_payload_so_com_blocos_permitidos(app, admin):
    codigo = _perfil_com(app, admin, 'Só a curva', ['bloco:ytd-linha'])
    prov = criar_usuario(app, admin, 'curva', [codigo])
    c = app.test_client()
    entrar(c, 'curva', prov)
    post(c, '/trocar-senha', new_password='Curva2026abcd', confirm_password='Curva2026abcd')
    r = c.get('/biblioteca/ytd?comp=2026-07')
    assert r.status_code == 200
    p = _payload(r.get_data(as_text=True))
    assert set(p) == {'ytd-linha'}
    # a tabela por vendedor (nomes e valores) não saiu do servidor
    assert 'LUCIANA' not in r.get_data(as_text=True)


def test_secao_sem_nenhum_bloco_liberado_e_403(app, admin):
    codigo = _perfil_com(app, admin, 'Nada de YTD', ['bloco:mn-evol'])
    prov = criar_usuario(app, admin, 'semytd', [codigo])
    c = app.test_client()
    entrar(c, 'semytd', prov)
    post(c, '/trocar-senha', new_password='SemYtd2026abcd', confirm_password='SemYtd2026abcd')
    assert c.get('/biblioteca/ytd?comp=2026-07').status_code == 403


def test_admin_recebe_todos_os_blocos_da_secao(admin):
    p = _payload(admin.get('/biblioteca/ytd?comp=2026-07').get_data(as_text=True))
    assert set(p) == {'ytd.abertura', 'ytd-kpi', 'ytd-linha', 'ytd-ind', 'ytd-vendedor'}


def test_filtro_de_mes_pela_api(admin):
    r = admin.get('/api/biblioteca/mensal?comp=2026-07&ym=202606')
    assert r.status_code == 200
    p = r.get_json()
    assert p['mensal.abertura']['ym'] == 202606 and p['mn-evol']['meses'][-1] == 202606
    # mês fora da base cai no último mês disponível, nunca em erro
    assert admin.get('/api/biblioteca/mensal?comp=2026-07&ym=199901').get_json()['mensal.abertura']['ym'] == 202607


def test_detalhe_exige_recurso_detalhar(app, admin):
    p = admin.get('/api/biblioteca/mensal?comp=2026-07').get_json()
    cli = p['mn-cli']['linhas'][0]['idx']
    ok = admin.get('/api/biblioteca/mensal/detalhe/itens?comp=2026-07&ym=202607&cli=%d' % cli)
    assert ok.status_code == 200 and ok.get_json()['itens']
    codigo = _perfil_com(app, admin, 'Mensal sem detalhe', ['bloco:mn-cli', 'bloco:mensal.abertura'])
    prov = criar_usuario(app, admin, 'semdetalhe', [codigo])
    c = app.test_client()
    entrar(c, 'semdetalhe', prov)
    post(c, '/trocar-senha', new_password='SemDetalhe2026x', confirm_password='SemDetalhe2026x')
    assert c.get('/api/biblioteca/mensal?comp=2026-07').status_code == 200
    assert c.get('/api/biblioteca/mensal/detalhe/itens?comp=2026-07&ym=202607&cli=%d' % cli).status_code == 403


def test_api_respeita_blocos_permitidos(app, admin):
    codigo = _perfil_com(app, admin, 'Só evolução mensal', ['bloco:mn-evol'])
    prov = criar_usuario(app, admin, 'soevol', [codigo])
    c = app.test_client()
    entrar(c, 'soevol', prov)
    post(c, '/trocar-senha', new_password='SoEvol2026abcd', confirm_password='SoEvol2026abcd')
    assert set(c.get('/api/biblioteca/mensal?comp=2026-07&ym=202605').get_json()) == {'mn-evol'}

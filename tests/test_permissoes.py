# -*- coding: utf-8 -*-
"""Permissões, vazamento entre perfis, "ver como perfil" e proteção do último administrador."""
import re

from app import catalogo as C
from conftest import SENHA_NOVA, criar_usuario, csrf, entrar, post


def _perfil_id(app, codigo):
    from app.db import get_db
    with app.app_context():
        return get_db().execute('SELECT id FROM perfis WHERE codigo=?', (codigo,)).fetchone()['id']


def _salvar_perfil(admin, pid, perms, confirmado=False):
    dados = {'nome': 'Teste', 'descricao': '', 'perm': perms, 'csrf_token': csrf(admin)}
    if confirmado:
        dados['confirmado'] = '1'
    return admin.post('/admin/perfis/%d' % pid, data=dados)


def _logar_trocando(app, login, prov):
    c = app.test_client()
    entrar(c, login, prov)
    post(c, '/trocar-senha', new_password='Pessoal2026ab', confirm_password='Pessoal2026ab')
    return c


def test_nao_admin_nao_entra_na_administracao(app, admin):
    prov = criar_usuario(app, admin, 'loja1', ['loja'])
    c = _logar_trocando(app, 'loja1', prov)
    for url in ('/admin/', '/admin/usuarios', '/admin/perfis', '/admin/auditoria'):
        assert c.get(url).status_code == 403
    assert post(c, '/admin/perfis/novo', nome='Invasor').status_code == 403


def test_perfil_ve_so_os_blocos_liberados(app, admin):
    admin.post('/admin/perfis/novo', data={'nome': 'Só um bloco', 'csrf_token': csrf(admin)})
    pid = _perfil_id(app, 'so_um_bloco')
    assert _salvar_perfil(admin, pid, ['bloco:mn-evol']).status_code == 302
    prov = criar_usuario(app, admin, 'restrito', ['so_um_bloco'])
    c = _logar_trocando(app, 'restrito', prov)
    html = c.get('/').get_data(as_text=True)
    # a página inicial leva só à seção do bloco liberado, e diz que o acesso é parcial
    total = len([b for b in C.blocos_da_secao('mensal') if not b.get('so_apresentacao')])
    assert 'vê 1 de %d partes desta seção' % total in html
    assert '/biblioteca/mensal"' in html
    assert not any('/biblioteca/%s"' % s['id'] in html for s in C.SECOES if s['id'] != 'mensal')
    assert c.get('/biblioteca/dre').status_code == 403


def test_permissao_inventada_nao_e_gravada(app, admin):
    pid = _perfil_id(app, 'loja')
    _salvar_perfil(admin, pid, ['bloco:mn-evol', 'bloco:inventado', 'admin:tudo'])
    from app.db import get_db
    with app.app_context():
        perms = {r['recurso'] for r in get_db().execute('SELECT recurso FROM perfil_permissoes WHERE perfil_id=?', (pid,))}
    assert perms == {'bloco:mn-evol'}


def test_cascata_pede_confirmacao(app, admin, monkeypatch):
    monkeypatch.setitem(C.BLOCO['av-rfv'], 'depende_de', ['av-diferenca'])
    pid = _perfil_id(app, 'loja')
    r = _salvar_perfil(admin, pid, ['bloco:av-rfv'])
    assert r.status_code == 200 and 'Confirme' in r.get_data(as_text=True)
    r = _salvar_perfil(admin, pid, ['bloco:av-rfv'], confirmado=True)
    assert r.status_code == 302
    from app.db import get_db
    with app.app_context():
        perms = {x['recurso'] for x in get_db().execute('SELECT recurso FROM perfil_permissoes WHERE perfil_id=?', (pid,))}
    assert perms == {'bloco:av-rfv', 'bloco:av-diferenca'}


def test_ver_como_perfil_e_so_leitura(app, admin):
    pid = _perfil_id(app, 'fabrica')
    r = post(admin, '/admin/ver-como', perfil_id=str(pid))
    assert r.status_code == 302
    home = admin.get('/').get_data(as_text=True)
    assert 'só leitura' in home
    # como Fábrica: só as duas seções de custo aparecem como link
    assert '/biblioteca/custosx"' in home and '/biblioteca/custos"' in home
    assert '/biblioteca/dre"' not in home and '/biblioteca/vendas"' not in home
    assert admin.get('/admin/usuarios').status_code == 403               # sem poderes de admin
    assert post(admin, '/trocar-senha', current_password=SENHA_NOVA, new_password='Xx12345678901',
                confirm_password='Xx12345678901').status_code == 403     # escrita bloqueada
    assert post(admin, '/admin/ver-como/sair').status_code == 302
    assert admin.get('/admin/usuarios').status_code == 200
    aud = admin.get('/admin/auditoria').get_data(as_text=True)
    assert 'ver_como_inicio' in aud and 'ver_como_fim' in aud


def test_ultimo_admin_nao_pode_se_desativar(app, admin):
    from app.db import get_db
    with app.app_context():
        uid = get_db().execute("SELECT id FROM usuarios WHERE login='admin'").fetchone()['id']
    pid_admin = _perfil_id(app, 'administrador')
    r = admin.post('/admin/usuarios/%d' % uid, data={'nome': 'Adm', 'email': 'adm@exemplo.com',
                                                      'perfis': [str(pid_admin)], 'csrf_token': csrf(admin)},
                   follow_redirects=True)                                   # sem "ativo" = desativar
    assert 'sem nenhum administrador' in r.get_data(as_text=True)
    with app.app_context():
        assert get_db().execute('SELECT ativo FROM usuarios WHERE id=?', (uid,)).fetchone()['ativo'] == 1
    r = _salvar_perfil(admin, pid_admin, ['bloco:mn-evol'])
    assert r.status_code == 302
    with app.app_context():
        perms = {x['recurso'] for x in get_db().execute('SELECT recurso FROM perfil_permissoes WHERE perfil_id=?', (pid_admin,))}
    assert 'admin' in perms


def test_desativar_usuario_derruba_sessao(app, admin):
    prov = criar_usuario(app, admin, 'saindo', ['loja'])
    c = _logar_trocando(app, 'saindo', prov)
    assert c.get('/').status_code == 200
    from app.db import get_db
    with app.app_context():
        uid = get_db().execute("SELECT id FROM usuarios WHERE login='saindo'").fetchone()['id']
    admin.post('/admin/usuarios/%d' % uid, data={'nome': 'x', 'email': 'saindo@exemplo.com',
                                                  'perfis': [str(_perfil_id(app, 'loja'))], 'csrf_token': csrf(admin)})
    r = c.get('/')
    assert r.status_code == 302 and '/entrar' in r.headers['Location']


def test_auditoria_registra_alteracao_de_permissao(app, admin):
    _salvar_perfil(admin, _perfil_id(app, 'loja'), ['bloco:dre-ponte'])      # a Loja não tinha a DRE
    aud = admin.get('/admin/auditoria?acao=permissoes_alteradas').get_data(as_text=True)
    assert 'permissoes_alteradas' in aud and 'bloco:dre-ponte' in aud

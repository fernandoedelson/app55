# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from conftest import SENHA_ADMIN, SENHA_NOVA, criar_usuario, csrf, entrar, post


def test_cabecalhos_de_seguranca(client):
    r = client.get('/entrar')
    for h in ('Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy',
              'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy'):
        assert h in r.headers
    assert r.headers['Cache-Control'] == 'no-store'


def test_sem_login_redireciona(client):
    for url in ('/', '/admin/', '/admin/usuarios', '/trocar-senha'):
        r = client.get(url)
        assert r.status_code == 302 and '/entrar' in r.headers['Location']


def test_post_sem_csrf_recusado(client):
    r = client.post('/entrar', data={'username': 'admin', 'password': SENHA_ADMIN})
    assert r.status_code == 400


def test_login_errado_mensagem_generica(client):
    r1 = entrar(client, 'admin', 'errada')
    r2 = entrar(client, 'nao-existe', 'errada')
    assert r1.status_code == r2.status_code == 401
    assert 'Usuário ou senha inválidos' in r1.get_data(as_text=True)
    assert 'Usuário ou senha inválidos' in r2.get_data(as_text=True)


def test_bloqueio_apos_5_falhas(client):
    for _ in range(5):
        entrar(client, 'admin', 'errada')
    r = entrar(client, 'admin', SENHA_ADMIN)
    assert r.status_code == 401


def test_limite_por_ip(app, client):
    app.config['LIMITE_IP_TENTATIVAS'] = 3
    for _ in range(3):
        entrar(client, 'x', 'y')
    assert entrar(client, 'x', 'y').status_code == 429


def test_primeiro_acesso_obriga_troca(client):
    entrar(client, 'admin', SENHA_ADMIN)
    r = client.get('/')
    assert r.status_code == 302 and '/trocar-senha' in r.headers['Location']
    fraca = post(client, '/trocar-senha', new_password='curta', confirm_password='curta')
    assert 'no mínimo' in fraca.get_data(as_text=True)
    ok = post(client, '/trocar-senha', new_password=SENHA_NOVA, confirm_password=SENHA_NOVA)
    assert ok.status_code == 302
    assert client.get('/').status_code == 200


def test_troca_de_senha_derruba_outros_aparelhos(app, admin):
    outro = app.test_client()
    entrar(outro, 'admin', SENHA_NOVA)
    assert outro.get('/').status_code == 200
    post(admin, '/trocar-senha', current_password=SENHA_NOVA, new_password='OutraSenha2026', confirm_password='OutraSenha2026')
    assert admin.get('/').status_code == 200          # quem trocou continua
    r = outro.get('/')
    assert r.status_code == 302 and '/entrar' in r.headers['Location']


def test_inatividade_encerra_sessao(admin):
    with admin.session_transaction() as s:
        s['la'] = (datetime.now() - timedelta(minutes=241)).isoformat(timespec='seconds')
    r = admin.get('/')
    assert r.status_code == 302 and '/entrar' in r.headers['Location']


def test_prazo_absoluto_de_8_horas(admin):
    with admin.session_transaction() as s:
        s['iat'] = (datetime.now() - timedelta(hours=8, minutes=1)).isoformat(timespec='seconds')
    r = admin.get('/')
    assert r.status_code == 302 and '/entrar' in r.headers['Location']


def test_logout_so_por_post(admin):
    assert admin.get('/sair').status_code == 405
    assert post(admin, '/sair').status_code == 302
    assert admin.get('/').status_code == 302


def test_redirecionamento_aberto_bloqueado(client):
    token = csrf(client)
    r = client.post('/entrar?next=//malicioso.com', data={'username': 'admin', 'password': SENHA_ADMIN, 'csrf_token': token})
    assert r.status_code == 302 and 'malicioso' not in r.headers['Location']


def test_esqueci_senha_nao_revela_nem_mostra_link(app, admin):
    criar_usuario(app, admin, 'maria', ['loja'])
    c = app.test_client()
    r1 = post(c, '/esqueci-senha', identifier='maria')
    t1 = c.get(r1.headers['Location']).get_data(as_text=True)
    r2 = post(c, '/esqueci-senha', identifier='ninguem')
    t2 = c.get(r2.headers['Location']).get_data(as_text=True)
    assert 'redefinir-senha/' not in t1 and 'redefinir-senha/' not in t2
    assert 'Se o usuário existir' in t1 and 'Se o usuário existir' in t2


def test_token_de_reset_uso_unico(app, admin):
    criar_usuario(app, admin, 'joao', ['fabrica'])
    from app.seguranca import reset as R
    from app.seguranca import usuarios as U
    with app.test_request_context():
        uid = U.por_login('joao')['id']
        token = R.criar(uid)
    c = app.test_client()
    r = post(c, '/redefinir-senha/' + token, new_password='JoaoNova2026x', confirm_password='JoaoNova2026x')
    assert r.status_code == 302 and '/entrar' in r.headers['Location']
    assert entrar(c, 'joao', 'JoaoNova2026x').status_code == 302
    r2 = app.test_client().get('/redefinir-senha/' + token)
    assert '/esqueci-senha' in r2.headers['Location']


def test_senha_gigante_nao_trava(client):
    r = entrar(client, 'admin', 'A' * 100000)
    assert r.status_code == 401


# ---- entrar com o usuário OU com o e-mail ----
def _usuario_com_senha_trocada(app, admin, login):
    """Cria o usuário, faz ele trocar a senha provisória e devolve (login, senha_nova)."""
    prov = criar_usuario(app, admin, login, ['gestao_comercial'])
    c = app.test_client()
    entrar(c, login, prov)
    assert post(c, '/trocar-senha', new_password=SENHA_NOVA, confirm_password=SENHA_NOVA).status_code == 302
    return login, SENHA_NOVA


def test_entrar_pelo_email(app, admin):
    login, senha = _usuario_com_senha_trocada(app, admin, 'ana.souza')
    for ident in ('ana.souza@exemplo.com', 'ANA.Souza@Exemplo.com', '  ana.souza@exemplo.com '):
        c = app.test_client()
        assert entrar(c, ident, senha).status_code == 302, ident
        assert c.get('/').status_code == 200
    assert entrar(app.test_client(), login, senha).status_code == 302      # o usuário continua valendo


def test_email_errado_ou_senha_errada_mesma_mensagem(app, admin):
    login, senha = _usuario_com_senha_trocada(app, admin, 'ana.souza')
    for ident, sn in (('ana.souza@exemplo.com', 'errada'), ('ninguem@exemplo.com', senha)):
        r = entrar(app.test_client(), ident, sn)
        assert r.status_code == 401 and 'Usuário ou senha inválidos' in r.get_data(as_text=True)


def test_email_repetido_nao_entra(app, admin):
    from app.db import get_db
    _usuario_com_senha_trocada(app, admin, 'ana.souza')
    login2, senha2 = _usuario_com_senha_trocada(app, admin, 'ana.souza2')
    with app.app_context():
        db = get_db()
        db.execute("UPDATE usuarios SET email='ana.souza@exemplo.com' WHERE login='ana.souza2'")
        db.commit()
    # dois usuários com o mesmo e-mail: pelo e-mail ninguém entra (ambíguo); pelo usuário, sim
    assert entrar(app.test_client(), 'ana.souza@exemplo.com', senha2).status_code == 401
    assert entrar(app.test_client(), login2, senha2).status_code == 302


def test_email_de_usuario_desativado_nao_entra(app, admin):
    from app.db import get_db
    login, senha = _usuario_com_senha_trocada(app, admin, 'ana.souza')
    with app.app_context():
        db = get_db()
        db.execute("UPDATE usuarios SET ativo=0 WHERE login='ana.souza'")
        db.commit()
    assert entrar(app.test_client(), 'ana.souza@exemplo.com', senha).status_code == 401


def test_tres_horas_parado_ainda_vale(admin):
    with admin.session_transaction() as s:
        s['la'] = (datetime.now() - timedelta(hours=3)).isoformat(timespec='seconds')
    assert admin.get('/').status_code == 200

# -*- coding: utf-8 -*-
"""Excluir a competência inteira, em qualquer situação (só o administrador, digitando o código)."""
import io
import os

from conftest import criar_usuario, csrf, entrar, post


def _estado(app, codigo):
    from app.db import get_db
    with app.app_context():
        db = get_db()
        n = lambda t, col='competencia': db.execute('SELECT COUNT(*) FROM %s WHERE %s=?' % (t, col), (codigo,)).fetchone()[0]
        return {'registro': n('competencias', 'codigo'), 'arquivos': n('competencia_arquivos'),
                'reuso': n('competencia_reuso'), 'roteiro': n('apresentacao_roteiro'),
                'pasta_fontes': os.path.isdir(os.path.join(app.config['DATA_DIR'], 'fontes', codigo))}


def _montar(app, admin, codigo='2026-08'):
    """Um mês com planilha enviada, reaproveitamento, roteiro e já aberto às áreas."""
    from app.db import get_db
    post(admin, '/fechamento/nova', codigo=codigo)
    admin.post('/fechamento/%s/upload' % codigo, data={
        'csrf_token': csrf(admin), 'data_posicao': '2026-08-31', 'base': 'metas',
        'arquivo': (io.BytesIO(b'x'), 'Metas Vendas 2026.xlsx')}, follow_redirects=True)
    post(admin, '/fechamento/%s/situacao' % codigo, status='disponibilizada', prazo_comentarios='2026-12-01')
    with app.app_context():
        db = get_db()
        db.execute("INSERT INTO competencia_reuso (competencia, base, usar, marcado_em) VALUES (?, 'aportes', 1, 'x')", (codigo,))
        db.execute("INSERT INTO apresentacao_roteiro (competencia, rascunho, atualizado_em) VALUES (?, '{}', 'x')", (codigo,))
        db.commit()


def test_excluir_apaga_tudo_do_mes_mesmo_aberto_as_areas(app, admin):
    _montar(app, admin)
    antes = _estado(app, '2026-08')
    assert antes['registro'] == 1 and antes['arquivos'] == 1 and antes['reuso'] == 1 and antes['roteiro'] == 1
    assert antes['pasta_fontes']
    html = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'Excluir esta competência' in html
    r = post(admin, '/fechamento/2026-08/excluir', confirmar='2026-08')
    assert r.status_code == 302
    depois = _estado(app, '2026-08')
    assert depois == {'registro': 0, 'arquivos': 0, 'reuso': 0, 'roteiro': 0, 'pasta_fontes': False}
    assert admin.get('/fechamento/2026-08').status_code == 404
    # e dá para criar de novo, limpo
    post(admin, '/fechamento/nova', codigo='2026-08')
    assert _estado(app, '2026-08')['registro'] == 1 and _estado(app, '2026-08')['arquivos'] == 0


def test_excluir_exige_o_codigo_digitado(app, admin):
    _montar(app, admin)
    for errado in ('', '2026-07', 'sim'):
        post(admin, '/fechamento/2026-08/excluir', confirmar=errado)
        assert _estado(app, '2026-08')['registro'] == 1
    assert 'digite o código do mês' in admin.get('/fechamento/2026-08').get_data(as_text=True)


def test_excluir_competencia_da_importacao_inicial(app, admin):
    """O mês que chegou pronto (sem planilhas na app), que antes nem dava para descartar, também sai."""
    pasta = os.path.join(app.config['COMPETENCIAS_DIR'], '2026-06')
    os.makedirs(pasta)
    open(os.path.join(pasta, 'DATA.json'), 'w').write('{}')
    assert admin.get('/fechamento/2026-06').status_code == 200          # registra como importação inicial
    r = post(admin, '/fechamento/2026-06/excluir', confirmar='2026-06')
    assert r.status_code == 302
    assert not os.path.isdir(pasta) and _estado(app, '2026-06')['registro'] == 0


def test_so_administrador_exclui(app, admin):
    from app.db import get_db
    _montar(app, admin)
    admin.post('/admin/perfis/novo', data={'nome': 'Fecha', 'csrf_token': csrf(admin)})
    with app.app_context():
        perfil = get_db().execute("SELECT id, codigo FROM perfis WHERE nome='Fecha'").fetchone()
        get_db().execute("INSERT INTO perfil_permissoes (perfil_id, recurso) VALUES (?, 'recurso:fechamento')", (perfil['id'],))
        get_db().commit()
    prov = criar_usuario(app, admin, 'fechador', [perfil['codigo']])
    c = app.test_client()
    entrar(c, 'fechador', prov)
    post(c, '/trocar-senha', new_password='Fechador2026ab', confirm_password='Fechador2026ab')
    assert c.get('/fechamento/2026-08').status_code == 200              # quem fecha o mês entra...
    assert 'Excluir esta competência' not in c.get('/fechamento/2026-08').get_data(as_text=True)
    assert post(c, '/fechamento/2026-08/excluir', confirmar='2026-08').status_code == 403   # ...mas não exclui
    assert _estado(app, '2026-08')['registro'] == 1

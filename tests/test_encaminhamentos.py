# -*- coding: utf-8 -*-
"""Encaminhamentos: o responsável é um usuário (não um perfil), só ele marca feito, e o atraso gera
um e-mail por dia até a conclusão."""
from conftest import criar_usuario, csrf, entrar, post


def _api(c, **corpo):
    return c.post('/apresentacao/2026-07/encaminhamentos/api', json=corpo, headers={'X-CSRF-Token': csrf(c)})


def _competencia(app):
    import os
    from app.calculo import competencia as comp_mod
    from app.db import get_db
    os.makedirs(os.path.join(comp_mod.pasta_competencias(app.config), '2026-07'), exist_ok=True)
    with app.app_context():
        get_db().execute("INSERT OR IGNORE INTO competencias (codigo, status, criada_em) VALUES ('2026-07','disponibilizada','2026-08-01')")
        get_db().commit()


def _usuario(app, admin, login, perfis):
    prov = criar_usuario(app, admin, login, perfis)
    c = app.test_client()
    entrar(c, login, prov)
    post(c, '/trocar-senha', new_password='Senha2026abcd', confirm_password='Senha2026abcd')
    return c


def test_responsavel_e_usuario_e_so_ele_marca_feito(app, admin):
    from app.apresentacao import encaminhamentos as E
    from app.db import get_db
    _competencia(app)
    gerente = _usuario(app, admin, 'gerente1', ['loja'])
    outro = _usuario(app, admin, 'outro1', ['loja'])
    # responsável tem de ser um usuário; um código de perfil não serve
    assert _api(admin, acao='criar', texto='x', responsavel='loja').status_code == 400
    r = _api(admin, acao='criar', texto='Trazer o plano de recompra.', responsavel='gerente1',
             prazo='2026-09-10', ato=4, bloco='av-jogo')
    assert r.status_code == 200
    item = r.get_json()['itens'][0]
    assert item['responsavel'] == 'gerente1' and item['ato'].startswith('Ato 4')
    assert item['bloco'] == 'O que está em jogo' or item['bloco']
    # quem não cura não registra; quem não é o responsável não marca feito
    assert _api(gerente, acao='criar', texto='y', responsavel='gerente1').status_code == 403
    assert _api(outro, acao='feito', id=item['id'], resposta='fiz').status_code == 400
    # o responsável vê em Pendências e marca feito
    assert 'Trazer o plano de recompra.' in gerente.get('/comentarios/').get_data(as_text=True)
    r = _api(gerente, acao='feito', id=item['id'], resposta='Plano enviado.')
    assert r.status_code == 200 and r.get_json()['itens'][0]['status'] == 'feito'
    assert _api(admin, acao='confirmar', id=item['id']).get_json()['itens'][0]['status'] == 'confirmado'
    with app.app_context():
        assert get_db().execute('SELECT responsavel FROM encaminhamentos').fetchone()[0] == 'gerente1'
        assert E.meus('gerente1') == []


def test_atrasado_gera_um_email_por_dia_ate_concluir(app, admin, monkeypatch):
    from app.apresentacao import encaminhamentos as E
    from app.seguranca import email as EM
    _competencia(app)
    _usuario(app, admin, 'gerente2', ['loja'])
    _api(admin, acao='criar', texto='Revisar custo fixo.', responsavel='gerente2', prazo='2026-09-10')
    enviados = []
    monkeypatch.setattr(EM, 'configurado', lambda: True)
    monkeypatch.setattr(EM, 'enviar', lambda para, assunto, texto: enviados.append((para, assunto, texto)) or True)
    with app.app_context():
        assert E.avisar_atrasados('2026-09-10') == 0           # no dia do prazo ainda não está atrasado
        assert E.avisar_atrasados('2026-09-11') == 1
        assert E.avisar_atrasados('2026-09-11') == 0           # o mesmo dia não repete
        assert E.avisar_atrasados('2026-09-12') == 1           # o dia seguinte, sim
    assert enviados[0][0] == 'gerente2@exemplo.com' and '1 dia de atraso' in enviados[0][2]
    assert '2 dias de atraso' in enviados[1][2]
    with app.app_context():
        from app.db import get_db
        eid = get_db().execute('SELECT id FROM encaminhamentos').fetchone()[0]
        E.marcar_feito(eid, 'gerente2', 'feito')
        assert E.avisar_atrasados('2026-09-13') == 0           # concluído: para de avisar

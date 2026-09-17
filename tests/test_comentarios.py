# -*- coding: utf-8 -*-
"""Fase 6 — comentário da área: quem escreve, quem envia, quem aprova e quem enxerga."""
import pytest

from conftest import criar_usuario, csrf, entrar, post

SENHA = 'AreaSenha2026xy'


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', 'Inicial12345')
    from app import criar_app
    return criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 't.db'),
                      'SECRET_KEY': 't', 'COMPETENCIAS_DIR': str(tmp_path / 'competencias')})


def competencia_disponivel(app, codigo='2026-08', prazo='31/12/2026'):
    from app.db import agora, get_db
    with app.app_context():
        con = get_db()
        con.execute('INSERT INTO competencias (codigo, status, criada_em, criada_por, processada_em, '
                    "disponibilizada_em, prazo_comentarios) VALUES (?,'disponibilizada',?,'admin',?,?,?)",
                    (codigo, agora(), agora(), agora(), prazo))
        con.commit()
    return codigo


def usuario(app, admin, login, perfis):
    prov = criar_usuario(app, admin, login, perfis)
    c = app.test_client()
    entrar(c, login, prov)
    post(c, '/trocar-senha', new_password=SENHA, confirm_password=SENHA)
    return c


def bloco_da_area(app, area):
    from app import comentarios as M
    with app.app_context():
        return M.blocos_da_area(area)[0]['id']


def test_area_escreve_responsavel_envia_controladoria_aprova(app, admin):
    cod = competencia_disponivel(app)
    bloco = bloco_da_area(app, 'fabrica')
    fab = usuario(app, admin, 'fabrica1', ['fabrica'])
    # quem não é responsável escreve, mas não envia
    r = post(fab, '/comentarios/%s/fabrica/%s' % (cod, bloco), texto='Retrabalho caiu por causa do lote X.')
    assert r.status_code == 302
    r = post(fab, '/comentarios/%s/fabrica/%s/enviar' % (cod, bloco))
    assert r.status_code == 403

    from app import comentarios as M
    with app.app_context():
        assert M.obter(cod, bloco, 'fabrica')['status'] == 'rascunho'

    # a Controladoria (que tem consolidar e curar) é quem aprova; o responsável da área envia
    admin.post('/admin/perfis/novo', data={'nome': 'Responsavel Fabrica', 'csrf_token': csrf(admin)})
    from app.db import get_db
    with app.app_context():
        p = get_db().execute("SELECT id, codigo FROM perfis WHERE nome='Responsavel Fabrica'").fetchone()
        get_db().execute('INSERT INTO perfil_permissoes (perfil_id, recurso) VALUES (?,?)',
                         (p['id'], 'recurso:consolidar'))
        get_db().commit()
        codigo_resp = p['codigo']
    chefe = usuario(app, admin, 'chefefabrica', ['fabrica', codigo_resp])
    post(chefe, '/comentarios/%s/fabrica/%s' % (cod, bloco), texto='Retrabalho caiu por causa do lote X.')
    r = post(chefe, '/comentarios/%s/fabrica/%s/enviar' % (cod, bloco))
    assert r.status_code == 302
    with app.app_context():
        assert M.obter(cod, bloco, 'fabrica')['status'] == 'enviado'

    r = post(admin, '/comentarios/%s/curadoria/decidir' % cod, area='fabrica', bloco=bloco, acao='aprovar',
             texto='Retrabalho caiu por causa do lote X (ajustado).', na_apresentacao='1')
    assert r.status_code == 302
    with app.app_context():
        c = M.obter(cod, bloco, 'fabrica')
        assert c['status'] == 'aprovado' and c['na_apresentacao'] == 1
        assert c['texto_area'] == 'Retrabalho caiu por causa do lote X.'   # o texto da área não se perde
        assert [h['acao'] for h in M.historico(c['id'])] == ['escrever', 'escrever', 'enviar', 'ajustar']


def test_recusa_exige_motivo_e_devolve_para_reescrever(app, admin):
    cod = competencia_disponivel(app)
    bloco = bloco_da_area(app, 'loja')
    from app import comentarios as M
    with app.app_context():
        M.escrever(cod, bloco, 'loja', 'Texto curto.', 'admin')
        M.enviar(cod, bloco, 'loja', 'admin')
        with pytest.raises(ValueError):
            M.decidir(cod, bloco, 'loja', 'recusar', 'admin', motivo='')
        M.decidir(cod, bloco, 'loja', 'recusar', 'admin', motivo='Explique a queda de ticket.')
        assert M.obter(cod, bloco, 'loja')['status'] == 'recusado'
        M.escrever(cod, bloco, 'loja', 'Texto novo, com a explicação.', 'admin')   # recusado volta a rascunho
        c = M.obter(cod, bloco, 'loja')
        assert c['status'] == 'rascunho' and c['motivo'] == ''


def test_area_so_ve_os_seus_e_so_comenta_o_que_enxerga(app, admin):
    cod = competencia_disponivel(app)
    bloco_fab = bloco_da_area(app, 'fabrica')
    from app import comentarios as M
    with app.app_context():
        M.escrever(cod, bloco_fab, 'fabrica', 'Só a fábrica vê isto.', 'admin')
    loja = usuario(app, admin, 'loja1', ['loja'])
    # a loja não comenta pela fábrica
    assert post(loja, '/comentarios/%s/fabrica/%s' % (cod, bloco_fab), texto='x').status_code == 403
    # e o rascunho da fábrica não aparece na tela da loja
    assert 'Só a fábrica vê isto' not in loja.get('/comentarios/?comp=%s' % cod).get_data(as_text=True)
    # nem no relatório: rascunho não é comentário aprovado
    with app.app_context():
        assert M.aprovados(cod) == []
    # bloco que a área não enxerga é recusado
    with app.app_context():
        fora = next(b['id'] for b in __import__('app').catalogo.BLOCOS
                    if b['id'] not in {x['id'] for x in M.blocos_da_area('loja')})
        with pytest.raises(ValueError):
            M.escrever(cod, fora, 'loja', 'não devia entrar', 'admin')


def test_fora_da_janela_ninguem_escreve(app, admin):
    from app import comentarios as M
    cod = competencia_disponivel(app, '2026-09', prazo='01/01/2020')
    bloco = bloco_da_area(app, 'loja')
    with app.app_context():
        aberto, motivo = M.prazo_aberto(cod)
        assert not aberto and 'prazo' in motivo
        with pytest.raises(ValueError):
            M.escrever(cod, bloco, 'loja', 'atrasado', 'admin')
    # competência em rascunho também não recebe comentário
    from app.db import agora, get_db
    with app.app_context():
        get_db().execute("INSERT INTO competencias (codigo, status, criada_em) VALUES ('2026-10','rascunho',?)",
                         (agora(),))
        get_db().commit()
        aberto, motivo = M.prazo_aberto('2026-10')
        assert not aberto and 'disponibilizada' in motivo


def test_aprovado_aparece_para_quem_enxerga_o_bloco(app, admin):
    cod = competencia_disponivel(app)
    bloco = bloco_da_area(app, 'loja')
    from app import comentarios as M
    with app.app_context():
        M.escrever(cod, bloco, 'loja', 'Carteira cresceu com a campanha.', 'admin')
        M.enviar(cod, bloco, 'loja', 'admin')
        M.decidir(cod, bloco, 'loja', 'aprovar', 'admin')
        aprov = M.aprovados(cod)
        assert len(aprov) == 1 and aprov[0]['texto'] == 'Carteira cresceu com a campanha.'
        # quem não enxerga o bloco não recebe o comentário
        from app.seguranca import usuarios as U
        ctx_vazio = {'admin': False, 'permissoes': set(), 'perfis': []}
        assert M.por_bloco(cod, ctx_vazio) == {}
        assert U.pode(ctx_vazio, 'bloco:' + bloco) is False

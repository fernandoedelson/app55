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


def test_banco_antigo_ganha_as_permissoes_de_comentario_uma_vez(app, tmp_path):
    """Banco criado antes da fase 6: a migração concede o comentário às áreas, uma única vez."""
    import sqlite3
    from app import criar_app
    from app.db import MIGRACOES
    db = str(tmp_path / 't.db')
    con = sqlite3.connect(db)
    con.execute("DELETE FROM perfil_permissoes WHERE recurso IN ('recurso:comentar','recurso:consolidar',"
                "'recurso:curar_comentarios')")
    con.execute('PRAGMA user_version=0')
    con.commit()
    con.close()
    criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': db, 'SECRET_KEY': 't'})
    con = sqlite3.connect(db)
    q = ("SELECT p.codigo FROM perfis p JOIN perfil_permissoes pp ON pp.perfil_id=p.id "
         "WHERE pp.recurso='recurso:comentar' ORDER BY p.codigo")
    assert [r[0] for r in con.execute(q)] == ['controladoria', 'fabrica', 'gestao_comercial', 'loja']
    assert con.execute('PRAGMA user_version').fetchone()[0] == len(MIGRACOES)
    # o administrador tira a permissão da Loja: reiniciar não devolve
    con.execute("DELETE FROM perfil_permissoes WHERE recurso='recurso:comentar' AND perfil_id="
                "(SELECT id FROM perfis WHERE codigo='loja')")
    con.commit()
    con.close()
    criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': db, 'SECRET_KEY': 't'})
    con = sqlite3.connect(db)
    assert 'loja' not in [r[0] for r in con.execute(q)]
    con.close()


def test_mes_da_importacao_inicial_pode_ser_aberto_e_disponibilizado(app, admin):
    import os
    import shutil
    real = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'competencias', '2026-07')
    if not os.path.isdir(real):
        pytest.skip('sem a competência 2026-07 nesta máquina')
    # uma cópia: descartar por engano, aqui, nunca alcançaria os dados de verdade
    shutil.copytree(real, os.path.join(app.config['COMPETENCIAS_DIR'], '2026-07'))
    cod = '2026-07'
    r = admin.get('/fechamento/%s' % cod)
    assert r.status_code == 200 and 'importação inicial' in r.get_data(as_text=True)
    post(admin, '/fechamento/%s/situacao' % cod, status='disponibilizada', prazo_comentarios='31/12/2099')
    from app import comentarios as M
    with app.app_context():
        assert M.competencia_aberta() == cod
    # a área comenta em cima do gráfico: a página da seção traz a camada com os blocos dela
    import json
    import re
    loja = usuario(app, admin, 'lojaabre', ['loja'])
    html = loja.get('/biblioteca/mensal').get_data(as_text=True)
    m = re.search(r'<script type="application/json" id="cmt-config"[^>]*>(.*?)</script>', html, re.S)
    assert m, 'a página da seção não trouxe a camada de comentário'
    cfg = json.loads(m.group(1))
    assert cfg['aberto'] and [a['codigo'] for a in cfg['areas']] == ['loja']
    assert 'mn-evol' in cfg['areas'][0]['blocos']
    # quem só lê e não tem nada aprovado não carrega camada nenhuma (a página é o relatório aprovado)
    leitor = usuario(app, admin, 'diretor', ['gestao55'])
    assert 'cmt-config' not in leitor.get('/biblioteca/mensal').get_data(as_text=True)
    # o endereço antigo do comentário leva ao gráfico, com o painel aberto
    r = loja.get('/comentarios/%s/loja/mn-evol' % cod)
    assert r.status_code == 302 and '/biblioteca/mensal' in r.location and 'comentar=mn-evol' in r.location
    # descartar nunca apaga os dados do mês importado
    post(admin, '/fechamento/%s/situacao' % cod, status='rascunho')
    r = admin.post('/fechamento/%s/descartar' % cod, data={'csrf_token': csrf(admin)}, follow_redirects=True)
    assert 'não pode ser descartada' in r.get_data(as_text=True)


def _api(c, cod, bloco, **corpo):
    return c.post('/comentarios/api/%s/%s' % (cod, bloco), json=corpo, headers={'X-CSRF-Token': csrf(c)})


def test_painel_do_grafico_escreve_envia_e_cura(app, admin):
    """O ciclo inteiro pelo painel lateral, sem sair do gráfico."""
    cod = competencia_disponivel(app)
    admin.post('/admin/perfis/novo', data={'nome': 'Resp Loja', 'csrf_token': csrf(admin)})
    from app.db import get_db
    with app.app_context():
        p = get_db().execute("SELECT id, codigo FROM perfis WHERE nome='Resp Loja'").fetchone()
        get_db().execute("INSERT INTO perfil_permissoes (perfil_id, recurso) VALUES (?, 'recurso:consolidar')", (p['id'],))
        get_db().commit()
    vend = usuario(app, admin, 'vendedora', ['loja'])
    chefe = usuario(app, admin, 'gerenteloja', ['loja', p['codigo']])

    # sem o token de CSRF não grava
    assert vend.post('/comentarios/api/%s/mn-evol' % cod, json={'acao': 'escrever', 'area': 'loja', 'texto': 'x'}).status_code == 400
    r = _api(vend, cod, 'mn-evol', acao='escrever', area='loja', texto='A feira puxou setembro.')
    assert r.status_code == 200 and r.get_json()['minhas'][0]['comentario']['status'] == 'rascunho'
    assert _api(vend, cod, 'mn-evol', acao='enviar', area='loja').status_code == 403       # só o responsável
    assert _api(vend, cod, 'mn-evol', acao='escrever', area='fabrica', texto='x').status_code == 403  # área alheia
    r = _api(chefe, cod, 'mn-evol', acao='enviar', area='loja', texto='A feira de design puxou setembro.')
    assert r.status_code == 200 and r.get_json()['minhas'][0]['comentario']['status'] == 'enviado'
    # a Controladoria vê o que curar no mesmo painel, e aprova com ajuste
    d = admin.get('/comentarios/api/%s/mn-evol' % cod).get_json()
    assert [c['area'] for c in d['curar']] == ['loja']
    r = _api(admin, cod, 'mn-evol', acao='recusar', area='loja', motivo='')
    assert r.status_code == 400 and 'recusando' in r.get_json()['erro']
    r = _api(admin, cod, 'mn-evol', acao='aprovar', area='loja', texto='A feira de design puxou setembro de 2025.',
             na_apresentacao=True)
    assert r.status_code == 200 and r.get_json()['aprovados'][0]['texto'].endswith('2025.')
    # quem só lê vê o aprovado no gráfico, e não vê o painel de outro bloco que não enxerga
    leitor = usuario(app, admin, 'leitora', ['gestao55'])
    assert leitor.get('/comentarios/api/%s/mn-evol' % cod).get_json()['aprovados'][0]['area'] == 'Loja'
    fab = usuario(app, admin, 'fabrica9', ['fabrica'])
    assert fab.get('/comentarios/api/%s/mn-evol' % cod).status_code == 404
    # e a pendência some da caixa de quem escreveu, e o aprovado passa a "já enviados"
    html = vend.get('/comentarios/').get_data(as_text=True)
    assert 'Já enviados' in html and 'Rascunhos para enviar' not in html


def test_ver_como_testa_o_ciclo_da_area(app, admin):
    """No "ver como perfil" o administrador vê a tela exatamente como a área (é assim que ele testa),
    mas nada é gravado: o painel avisa e o servidor recusa."""
    import json
    import os
    import re
    import shutil
    real = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'competencias', '2026-07')
    if not os.path.isdir(real):
        pytest.skip('sem a competência 2026-07 nesta máquina')
    shutil.copytree(real, os.path.join(app.config['COMPETENCIAS_DIR'], '2026-07'))
    admin.get('/fechamento/2026-07')
    post(admin, '/fechamento/2026-07/situacao', status='disponibilizada', prazo_comentarios='2099-12-31')
    from app.db import get_db
    with app.app_context():
        pid = get_db().execute("SELECT id FROM perfis WHERE codigo='fabrica'").fetchone()['id']
    post(admin, '/admin/ver-como', perfil_id=str(pid))
    html = admin.get('/biblioteca/custosx').get_data(as_text=True)
    cfg = json.loads(re.search(r'id="cmt-config"[^>]*>(.*?)</script>', html, re.S).group(1))
    assert cfg['ver_como'] is True and [a['codigo'] for a in cfg['areas']] == ['fabrica']
    assert 'Vendo como <b>Fábrica</b>' in html and 'Sair do modo' in html     # o modo à vista no relatório
    assert 'setupLaser()' in html                                              # o laser da ampliação
    assert 'cx-grp' in cfg['areas'][0]['blocos']                      # o botão aparece como para a Fábrica
    # 1) como a Fábrica: escreve e envia (como área não se aprova)
    r = _api(admin, '2026-07', 'cx-grp', acao='escrever', area='fabrica', texto='Teste do admin como Fábrica.')
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    assert _api(admin, '2026-07', 'cx-grp', acao='enviar', area='fabrica').status_code == 200
    assert _api(admin, '2026-07', 'cx-grp', acao='aprovar', area='fabrica').status_code == 403
    assert post(admin, '/fechamento/2026-07/situacao', status='fechada').status_code == 403   # o resto é só leitura
    with app.app_context():
        aud = get_db().execute("SELECT como_perfil FROM auditoria WHERE acao='comentario.escrever'").fetchone()
        assert aud['como_perfil']                     # a auditoria diz que foi no modo "ver como"
    # 2) como Controladoria: vê o que curar e aprova
    post(admin, '/admin/ver-como/sair')
    with app.app_context():
        pid_c = get_db().execute("SELECT id FROM perfis WHERE codigo='controladoria'").fetchone()['id']
        pid_d = get_db().execute("SELECT id FROM perfis WHERE codigo='gestao55'").fetchone()['id']
    post(admin, '/admin/ver-como', perfil_id=str(pid_c))
    d = admin.get('/comentarios/api/2026-07/cx-grp').get_json()
    assert [c['area'] for c in d['curar']] == ['fabrica']
    assert _api(admin, '2026-07', 'cx-grp', acao='aprovar', area='fabrica').status_code == 200
    # 3) como a Diretoria: o aprovado aparece no gráfico
    post(admin, '/admin/ver-como/sair')
    post(admin, '/admin/ver-como', perfil_id=str(pid_d))
    html = admin.get('/biblioteca/custosx').get_data(as_text=True)
    cfg = json.loads(re.search(r'id="cmt-config"[^>]*>(.*?)</script>', html, re.S).group(1))
    assert cfg['blocos']['cx-grp']['aprovados'][0]['texto'] == 'Teste do admin como Fábrica.'


def test_area_edita_ate_a_aprovacao(app, admin):
    cod = competencia_disponivel(app)
    bloco = bloco_da_area(app, 'loja')
    from app import comentarios as M
    with app.app_context():
        M.escrever(cod, bloco, 'loja', 'Primeira versão.', 'admin')
        M.enviar(cod, bloco, 'loja', 'admin')
        M.escrever(cod, bloco, 'loja', 'Versão corrigida depois de enviar.', 'admin')   # ainda não aprovado
        c = M.obter(cod, bloco, 'loja')
        assert c['status'] == 'enviado' and c['texto'] == 'Versão corrigida depois de enviar.'
        assert [h['acao'] for h in M.historico(c['id'])][-1] == 'editar'
        M.decidir(cod, bloco, 'loja', 'aprovar', 'admin')
        with pytest.raises(ValueError):                                                # aprovado não muda
            M.escrever(cod, bloco, 'loja', 'Tarde demais.', 'admin')


def test_solicitar_informacao_a_uma_area(app, admin):
    cod = competencia_disponivel(app)
    bloco = bloco_da_area(app, 'loja')
    r = post(admin, '/comentarios/%s/curadoria/pedir' % cod, area='loja', bloco=bloco,
             observacao='Por que o ticket caiu em julho?')
    assert r.status_code == 302
    html = admin.get('/comentarios/?comp=%s' % cod).get_data(as_text=True)
    assert 'Solicitar informação' in html and 'Por que o ticket caiu em julho?' in html
    assert 'Aguardando a área' in html
    loja = usuario(app, admin, 'lojasol', ['loja'])
    assert 'Pediram informação à sua área' in loja.get('/comentarios/?comp=%s' % cod).get_data(as_text=True)
    from app import comentarios as M
    with app.app_context():
        M.escrever(cod, bloco, 'loja', 'Promoção de junho antecipou vendas.', 'lojasol')
        M.enviar(cod, bloco, 'loja', 'lojasol')
    assert 'Respondida' in admin.get('/comentarios/?comp=%s' % cod).get_data(as_text=True)
    post(admin, '/comentarios/%s/curadoria/pedir/cancelar' % cod, area='loja', bloco=bloco)
    with app.app_context():
        assert M.pedidos(cod) == []


def test_area_solicita_informacao_a_outra_area(app, admin):
    """Qualquer área pergunta à Controladoria ou a outra área, direto no gráfico."""
    cod = competencia_disponivel(app)
    comum = next(b['id'] for b in __import__('app').catalogo.BLOCOS
                 if b['id'] == 'mn-evol')                       # a Loja e a Gestão Comercial enxergam
    loja = usuario(app, admin, 'lojapergunta', ['loja'])
    d = loja.get('/comentarios/api/%s/%s' % (cod, comum)).get_json()
    destinos = [a['codigo'] for a in d['areas_para_pedir']]
    assert 'controladoria' in destinos and 'loja' not in destinos       # a si mesma não se pede
    r = _api(loja, cod, comum, acao='pedir', area='gestao_comercial', observacao='A meta de julho mudou?')
    assert r.status_code == 200
    assert _api(loja, cod, comum, acao='pedir', area='controladoria', observacao='').status_code == 400
    com = usuario(app, admin, 'comercialresp', ['gestao_comercial'])
    html = com.get('/comentarios/?comp=%s' % cod).get_data(as_text=True)
    assert 'Pediram informação à sua área' in html and 'Loja pergunta:' in html
    # a Loja acompanha o que pediu na tela dela e pode cancelar
    assert 'A meta de julho mudou?' in loja.get('/comentarios/?comp=%s' % cod).get_data(as_text=True)
    assert post(loja, '/comentarios/%s/curadoria/pedir/cancelar' % cod, area='gestao_comercial', bloco=comum).status_code == 302
    from app import comentarios as M
    with app.app_context():
        assert M.pedidos(cod) == []

# -*- coding: utf-8 -*-
"""Fase 5 — o mês entra pela tela: subir base, processar, ver o que mudou e publicar por bloco."""
import io
import os
import shutil

import pytest

from conftest import criar_usuario, csrf, entrar, post

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
FONTES_KIT = os.path.join(KIT, 'fontes')
pytestmark = pytest.mark.skipif(not os.path.isdir(FONTES_KIT), reason='fontes do Kit não estão nesta máquina')


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', 'Inicial12345')
    from app import criar_app
    return criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 't.db'),
                      'SECRET_KEY': 't', 'COMPETENCIAS_DIR': str(tmp_path / 'competencias')})


def test_so_quem_tem_o_recurso_entra(app, admin):
    assert admin.get('/fechamento/').status_code == 200
    from app.db import get_db
    admin.post('/admin/perfis/novo', data={'nome': 'So le', 'csrf_token': csrf(admin)})
    with app.app_context():
        r = get_db().execute("SELECT codigo FROM perfis WHERE nome='So le'").fetchone()
    prov = criar_usuario(app, admin, 'soleitura', [r['codigo']])
    c = app.test_client()
    entrar(c, 'soleitura', prov)
    post(c, '/trocar-senha', new_password='SoLeitura2026ab', confirm_password='SoLeitura2026ab')
    assert c.get('/fechamento/').status_code == 403


def test_arquivo_que_nao_e_de_nenhuma_base_e_recusado(app, admin):
    post(admin, '/fechamento/nova', codigo='2026-08')
    r = admin.post('/fechamento/2026-08/upload', data={
        'csrf_token': csrf(admin), 'data_posicao': '31/08/2026',
        'arquivo': (io.BytesIO(b'x'), 'Planilha Qualquer.xlsx')}, follow_redirects=True)
    assert 'não reconheci a base' in r.get_data(as_text=True)


def test_base_sem_data_de_posicao_e_recusada(app, admin):
    post(admin, '/fechamento/nova', codigo='2026-08')
    r = admin.post('/fechamento/2026-08/upload', data={
        'csrf_token': csrf(admin), 'data_posicao': '',
        'arquivo': (io.BytesIO(b'x'), 'Controle ADM de Vendas 55 Atualizada.xlsx')}, follow_redirects=True)
    assert 'declare a data de posição' in r.get_data(as_text=True)


def test_ciclo_completo_reproduz_os_dados_da_competencia(app, admin, tmp_path):
    """Subir as mesmas planilhas do gabarito e processar tem de gerar os mesmos dados."""
    post(admin, '/fechamento/nova', codigo='2026-08')
    for nome in ('Controle ADM de Vendas 55 Atualizada.xlsx', 'Painel Resultado 55 Design.xlsm'):
        with open(os.path.join(FONTES_KIT, nome), 'rb') as f:
            admin.post('/fechamento/2026-08/upload', data={
                'csrf_token': csrf(admin), 'data_posicao': '31/07/2026',
                'arquivo': (io.BytesIO(f.read()), nome)}, follow_redirects=True)
    # as demais fontes entram direto na pasta (o teste não precisa exercitar cada upload)
    from app.importacao import servico
    with app.app_context():
        destino = servico.pasta_fontes('2026-08')
        for nome in os.listdir(FONTES_KIT):
            org = os.path.join(FONTES_KIT, nome)
            alvo = os.path.join(destino, nome)
            if os.path.isdir(org):
                shutil.copytree(org, alvo, dirs_exist_ok=True)
            elif not os.path.exists(alvo):
                shutil.copy2(org, alvo)
        shutil.copytree(os.path.join(KIT, 'Modelo_Gerencial_Fabrica_Loja'),
                        os.path.join(destino, 'Modelo_Gerencial_Fabrica_Loja'), dirs_exist_ok=True)
        cfg = os.path.join(str(tmp_path), 'config')
        os.makedirs(cfg, exist_ok=True)
        shutil.copy2(os.path.join(KIT, 'config_apresentacao.json'), cfg)
    r = admin.post('/fechamento/2026-08/processar', data={'csrf_token': csrf(admin)}, follow_redirects=True)
    assert 'Dados gerados' in r.get_data(as_text=True)
    import json
    gerado = json.load(open(os.path.join(str(tmp_path), 'competencias', '2026-08', 'DATA.json'), encoding='utf-8'))
    publicado = json.load(open(os.path.join(RAIZ, 'data', 'competencias', '2026-07', 'DATA.json'), encoding='utf-8'))
    assert gerado == publicado
    # publicação por bloco fica registrada
    admin.post('/fechamento/2026-08/publicar', data={'csrf_token': csrf(admin), 'bloco': ['ytd-kpi', 'ytd-linha']},
               follow_redirects=True)
    with app.app_context():
        assert servico.blocos_publicados('2026-08') == {'ytd-kpi', 'ytd-linha'}

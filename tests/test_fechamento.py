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


def _subir(admin, comp, caminho, nome=None, base=None, data='2026-08-31'):
    with open(caminho, 'rb') as f:
        dados = {'csrf_token': csrf(admin), 'data_posicao': data, 'arquivo': (io.BytesIO(f.read()), nome or os.path.basename(caminho))}
    if base:
        dados['base'] = base
    return admin.post('/fechamento/%s/upload' % comp, data=dados, follow_redirects=True)


def test_bases_sobem_aos_poucos_e_o_arquivo_novo_substitui_o_antigo(app, admin):
    from app.importacao import servico
    post(admin, '/fechamento/nova', codigo='2026-08')
    _subir(admin, '2026-08', os.path.join(FONTES_KIT, 'Metas Vendas 2026.xlsx'))
    with app.app_context():
        assert servico.faltando('2026-08') == ['comercial', 'painel']      # guardado; processar ainda trava
    # outro dia, a mesma base com outro nome: fica só a nova
    _subir(admin, '2026-08', os.path.join(FONTES_KIT, 'Metas Vendas 2026.xlsx'), nome='Metas Vendas 2026 rev2.xlsx')
    with app.app_context():
        metas = [a['arquivo'] for a in servico.arquivos('2026-08') if a['base'] == 'metas']
        assert metas == ['Metas Vendas 2026 rev2.xlsx']
        assert sorted(f for f in os.listdir(servico.pasta_fontes('2026-08')) if f.startswith('Metas')) == metas


def test_usar_do_mes_anterior(app, admin):
    """Base que não muda todo mês: a opção vem ligada, o mês lê a planilha do anterior sem copiá-la e o
    envio fica desabilitado; desligar libera o envio; ligar de novo descarta o arquivo do mês."""
    from app.importacao import servico
    post(admin, '/fechamento/nova', codigo='2026-08')
    _subir(admin, '2026-08', os.path.join(FONTES_KIT, 'Designers.xlsx'))
    post(admin, '/fechamento/nova', codigo='2026-09')
    tela = admin.get('/fechamento/2026-09').get_data(as_text=True)
    assert 'Usar a do mês anterior (2026-08)' in tela and 'Usando a planilha de 2026-08' in tela
    with app.app_context():
        r = servico.reuso('2026-09')['designers']
        assert r['usar'] and r['origem'] == '2026-08' and [a['arquivo'] for a in r['arquivos']] == ['Designers.xlsx']
        assert servico.arquivos('2026-09') == []                                   # nada copiado
        assert not os.path.exists(os.path.join(servico.pasta_fontes('2026-09'), 'Designers.xlsx'))
        # o processamento monta as fontes com a planilha do mês anterior e depois a descarta
        fontes, tmp = servico._montar_fontes('2026-09')
        assert os.path.isfile(os.path.join(fontes, 'Designers.xlsx'))
        import shutil as sh
        sh.rmtree(tmp)
        # a busca desce até o mês que tem o arquivo: outubro também lê o de agosto
        servico.criar('2026-10', 'admin')
        assert servico.reuso('2026-10')['designers']['origem'] == '2026-08'
    # desligar: o envio volta
    post(admin, '/fechamento/2026-09/reuso', base='designers', usar='0')
    with app.app_context():
        assert not servico.reuso('2026-09')['designers']['usar']
    _subir(admin, '2026-09', os.path.join(FONTES_KIT, 'Designers.xlsx'))
    # ligar de novo descarta o arquivo do mês
    post(admin, '/fechamento/2026-09/reuso', base='designers', usar='1')
    with app.app_context():
        assert servico.reuso('2026-09')['designers']['usar'] and servico.arquivos('2026-09') == []
    # base que muda todo mês não tem a opção
    r = admin.post('/fechamento/2026-09/reuso', data={'csrf_token': csrf(admin), 'base': 'comercial', 'usar': '1'},
                   follow_redirects=True)
    assert 'muda todo mês' in r.get_data(as_text=True)


def test_carteira_de_fechamento_e_carteira_dinamica_sao_arquivos_separados(app, admin):
    from app.importacao import servico
    post(admin, '/fechamento/nova', codigo='2026-08')
    vl = os.path.join(FONTES_KIT, 'VENDAS LOJA 2025.xlsx')
    _subir(admin, '2026-08', vl, base='carteira_fech', data='2026-08-31')
    _subir(admin, '2026-08', vl, base='carteira', data='2026-09-15')
    with app.app_context():
        por_base = {a['base']: a for a in servico.arquivos('2026-08')}
        assert por_base['carteira_fech']['data_posicao'] == '2026-08-31'
        assert por_base['carteira']['data_posicao'] == '2026-09-15'
        fontes = servico.pasta_fontes('2026-08')
        assert os.path.isfile(os.path.join(fontes, 'Carteira_Fechamento', 'VENDAS LOJA 2025.xlsx'))
        assert os.path.isfile(os.path.join(fontes, 'VENDAS LOJA 2025.xlsx'))


def test_carteira_dinamica_atualiza_o_mes_ja_publicado(app, admin, tmp_path):
    """No mês publicado (até fechado), a dinâmica nova vale na hora, com a posição declarada."""
    import json
    real = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
    if not os.path.isdir(real):
        pytest.skip('sem a competência 2026-07 nesta máquina')
    shutil.copytree(real, os.path.join(str(tmp_path), 'competencias', '2026-07'))
    assert admin.get('/fechamento/2026-07').status_code == 200            # registra o mês importado (fechado)
    r = _subir(admin, '2026-07', os.path.join(FONTES_KIT, 'VENDAS LOJA 2025.xlsx'), base='carteira', data='2026-09-15')
    assert 'Carteira dinâmica atualizada' in r.get_data(as_text=True)
    cd = json.load(open(os.path.join(str(tmp_path), 'competencias', '2026-07', 'CARTDIN.json'), encoding='utf-8'))
    assert cd['data_base'] == '15/09/2026'
    # as outras bases do mês fechado continuam travadas
    r = _subir(admin, '2026-07', os.path.join(FONTES_KIT, 'Designers.xlsx'))
    assert 'competência fechada' in r.get_data(as_text=True)

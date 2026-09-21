# -*- coding: utf-8 -*-
"""A apresentação da reunião é o documento do Kit, idêntico ao aprovado — e só vai para quem vê tudo.

O Kit é gerado byte a byte igual ao aprovado. Ao servir, uma troca só: o atos.js do Kit vira o
atos_app.js (o roteiro pilotado na aplicação). Fora dessa troca, o documento é o aprovado."""
import io
import json
import os
import shutil

import pytest

from conftest import criar_usuario, entrar, post

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
GABARITO = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design\_referencia\gabarito\2026-07\relatorio_atos.html'
pytestmark = pytest.mark.skipif(not (os.path.isdir(REAL) and os.path.exists(GABARITO)),
                                reason='sem a competência 2026-07 ou o gabarito nesta máquina')


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', 'Inicial12345')
    shutil.copytree(REAL, str(tmp_path / 'competencias' / '2026-07'))
    from app import criar_app
    return criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 't.db'),
                      'SECRET_KEY': 't', 'COMPETENCIAS_DIR': str(tmp_path / 'competencias')})


def _aprovado():
    return io.open(GABARITO, 'rb').read().decode('utf-8')


def _sem_a_troca(html):
    """O documento servido com o script do roteiro devolvido ao atos.js do Kit."""
    from app.apresentacao import kit_atos
    ini = html.index('<script>window.ROTEIRO_55=')
    fim = html.index('</script>', html.index('</script>', ini) + 9) + len('</script>')
    atos_kit = io.open(os.path.join(kit_atos.PASTA_KIT, 'atos.js'), encoding='utf-8').read()
    return html[:ini] + '<script>' + atos_kit + '</script>' + html[fim:]


def _roteiro(html):
    ini = html.index('window.ROTEIRO_55=') + len('window.ROTEIRO_55=')
    return json.JSONDecoder().raw_decode(html[ini:])[0]


def test_o_kit_gerado_e_byte_a_byte_o_aprovado(app):
    from app.apresentacao import kit_atos
    with app.app_context():
        assert io.open(kit_atos.obter('2026-07'), 'rb').read() == io.open(GABARITO, 'rb').read()


def test_quem_ve_tudo_recebe_o_aprovado_com_o_roteiro(app, admin):
    r = admin.get('/apresentacao/2026-07')
    assert r.status_code == 200 and r.mimetype == 'text/html'
    assert 'no-store' in r.headers['Cache-Control']
    html = r.get_data(as_text=True)
    assert _sem_a_troca(html) == _aprovado(), 'fora do roteiro, a apresentação tem de ser a aprovada'
    rot = _roteiro(html)
    assert [a['t'] for a in rot['atos']][:2] == ['De onde viemos', 'O que já está vendido']
    assert rot['atos'][0]['cortina'] is True
    # o anexo não repete o que está nos atos — nem o quadro equivalente de outra seção
    assert 'cd-status' in rot['ocultar'] and 'ce-status' in rot['ocultar'] and 'cu-retrabalho' in rot['ocultar']


def test_quem_ve_parte_nao_recebe_os_dados_inteiros(app, admin):
    prov = criar_usuario(app, admin, 'lojaatos', ['loja'])
    c = app.test_client()
    entrar(c, 'lojaatos', prov)
    post(c, '/trocar-senha', new_password='LojaAtos2026ab', confirm_password='LojaAtos2026ab')
    corpo = c.get('/apresentacao/2026-07').get_data(as_text=True)
    assert 'window.DATA=' not in corpo and 'A reunião de' in corpo      # a versão filtrada pelo perfil
    assert c.get('/apresentacao/2026-07/baixar').status_code == 403


def test_baixar_entrega_o_mesmo_documento(app, admin):
    r = admin.get('/apresentacao/2026-07/baixar')
    assert r.status_code == 200 and 'attachment' in r.headers['Content-Disposition']
    assert r.data == admin.get('/apresentacao/2026-07').data


def _pilotar(c, **corpo):
    from conftest import csrf
    return c.post('/apresentacao/2026-07/pilotar', json=corpo, headers={'X-CSRF-Token': csrf(c)})


def test_pilotar_rascunho_so_vale_depois_de_gerar(app, admin):
    assert admin.get('/apresentacao/2026-07/pilotar').status_code == 200
    atos = json.loads(admin.get('/apresentacao/2026-07/pilotar').get_data(as_text=True)
                      .split('id="pl-dados">')[1].split('</script>')[0])['atos']
    # o gráfico anual sai do Ato 1 e vai para o Ato 6; o Ato 6 muda de título
    atos[0]['itens'] = [it for it in atos[0]['itens'] if it.get('blk') != 'ev-anual']
    atos[5]['itens'].append({'sec': 'evolutiva', 'blk': 'ev-anual'})
    atos[5]['t'] = 'Para onde vamos'
    r = _pilotar(admin, acao='salvar', atos=atos)
    assert r.status_code == 200 and r.get_json()['estado']['pendente']
    rot = _roteiro(admin.get('/apresentacao/2026-07').get_data(as_text=True))
    assert rot['atos'][5]['t'] == 'O que vem a seguir'                 # rascunho não muda a reunião
    assert _pilotar(admin, acao='gerar').status_code == 200
    rot = _roteiro(admin.get('/apresentacao/2026-07').get_data(as_text=True))
    assert rot['atos'][5]['t'] == 'Para onde vamos'
    assert rot['atos'][5]['itens'] == [{'sec': 'evolutiva', 'blk': 'ev-anual'}]
    # voltar ao padrão é um rascunho: vale quando gerar
    assert _pilotar(admin, acao='padrao').get_json()['estado']['pendente']
    _pilotar(admin, acao='gerar')
    assert _roteiro(admin.get('/apresentacao/2026-07').get_data(as_text=True))['atos'][5]['t'] == 'O que vem a seguir'


def test_pilotar_recusa_roteiro_invalido(app, admin):
    r = _pilotar(admin, acao='salvar', atos=[{'t': 'A', 'itens': [{'sec': 'dre', 'blk': 'nao-existe'}]}])
    assert r.status_code == 400 and 'bloco' in r.get_json()['erro']
    dup = [{'t': 'A', 'itens': [{'sec': 'dre', 'blk': 'dre-ponte'}]}, {'t': 'B', 'itens': [{'sec': 'dre', 'blk': 'dre-ponte'}]}]
    assert _pilotar(admin, acao='salvar', atos=dup).status_code == 400
    sel = [{'t': 'A', 'itens': [{'sec': 'dre', 'filtroSel': 'body'}]}]
    assert _pilotar(admin, acao='salvar', atos=sel).status_code == 400


def test_so_quem_cura_pilota(app, admin):
    prov = criar_usuario(app, admin, 'lojapilota', ['loja'])
    c = app.test_client()
    entrar(c, 'lojapilota', prov)
    post(c, '/trocar-senha', new_password='LojaPilota2026ab', confirm_password='LojaPilota2026ab')
    assert c.get('/apresentacao/2026-07/pilotar').status_code == 403
    assert _pilotar(c, acao='gerar').status_code == 403


def test_comentario_escolhido_para_a_reuniao_aparece_nela(app, admin):
    from app.db import get_db
    with app.app_context():
        con = get_db()
        con.execute("INSERT OR IGNORE INTO competencias (codigo, status, criada_em, criada_por) "
                    "VALUES ('2026-07', 'disponibilizada', '2026-08-01', 'teste')")
        con.execute("INSERT INTO comentarios (competencia, bloco, area, texto, status, na_apresentacao, criado_em, "
                    "atualizado_em) VALUES ('2026-07','cx-mensal','controladoria','Alta da matéria-prima.','aprovado',1,"
                    "'2026-08-02','2026-08-02')")
        con.commit()
    html = admin.get('/apresentacao/2026-07').get_data(as_text=True)
    ini = html.index('window.CMT_REUNIAO=') + len('window.CMT_REUNIAO=')
    cmt = json.JSONDecoder().raw_decode(html[ini:])[0]
    assert cmt == {'cx-mensal': [{'area': 'Controladoria', 'texto': 'Alta da matéria-prima.'}]}


def test_kit_mexido_para_a_geracao(app, tmp_path, monkeypatch):
    from app.apresentacao import kit_atos
    copia = tmp_path / 'kit'
    shutil.copytree(kit_atos.PASTA_KIT, str(copia))
    with open(str(copia / 'app.js'), 'a', encoding='utf-8') as f:
        f.write('\n// ajuste à mão\n')
    monkeypatch.setattr(kit_atos, 'PASTA_KIT', str(copia))
    with pytest.raises(RuntimeError):
        kit_atos.conferir_manifesto()

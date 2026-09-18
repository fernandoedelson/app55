# -*- coding: utf-8 -*-
"""A apresentação da reunião é o documento do Kit, idêntico ao aprovado — e só vai para quem vê tudo."""
import io
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


def test_quem_ve_tudo_recebe_o_html_identico_ao_aprovado(app, admin):
    r = admin.get('/apresentacao/2026-07')
    assert r.status_code == 200 and r.mimetype == 'text/html'
    assert r.data == io.open(GABARITO, 'rb').read(), 'a apresentação não é byte a byte a aprovada'
    assert 'no-store' in r.headers['Cache-Control']


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
    assert r.data == io.open(GABARITO, 'rb').read()


def test_kit_mexido_para_a_geracao(app, tmp_path, monkeypatch):
    from app.apresentacao import kit_atos
    copia = tmp_path / 'kit'
    shutil.copytree(kit_atos.PASTA_KIT, str(copia))
    with open(str(copia / 'app.js'), 'a', encoding='utf-8') as f:
        f.write('\n// ajuste à mão\n')
    monkeypatch.setattr(kit_atos, 'PASTA_KIT', str(copia))
    with pytest.raises(RuntimeError):
        kit_atos.conferir_manifesto()

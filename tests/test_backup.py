# -*- coding: utf-8 -*-
"""Fase 8 — backup: só administrador, sem a chave de sessão, com o banco inteiro em SQL."""
import io
import zipfile

from conftest import criar_usuario, csrf, entrar, post


def test_backup_completo_tem_o_banco_e_nao_tem_a_chave(app, admin):
    r = admin.post('/admin/backup', data={'csrf_token': csrf(admin)})
    assert r.status_code == 200 and r.mimetype == 'application/zip'
    z = zipfile.ZipFile(io.BytesIO(r.data))
    nomes = z.namelist()
    assert 'app55.sql' in nomes and 'LEIA-ME.txt' in nomes
    assert not any(n.endswith('.secret_key') for n in nomes)
    assert 'CREATE TABLE usuarios' in z.read('app55.sql').decode('utf-8')


def test_backup_exige_administrador(app, admin):
    prov = criar_usuario(app, admin, 'lojista', ['loja'])
    c = app.test_client()
    entrar(c, 'lojista', prov)
    post(c, '/trocar-senha', new_password='Lojista2026abcd', confirm_password='Lojista2026abcd')
    assert c.post('/admin/backup', data={'csrf_token': csrf(c)}).status_code == 403

# -*- coding: utf-8 -*-
"""Renderiza as telas internas (logado como administrador, num banco temporário) em HTML estático,
para revisão visual sem precisar digitar senha no navegador.

    python ferramentas/telas_para_revisao.py   ->  _revisao/*.html  (servir com http.server)
"""
import os
import re
import shutil
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
SAIDA = os.path.join(RAIZ, '_revisao')

os.environ['APP55_ADMIN_LOGIN'] = 'admin'
os.environ['APP55_ADMIN_SENHA'] = 'Revisao2026ab'

from app import criar_app  # noqa: E402

tmp = tempfile.mkdtemp(prefix='app55-revisao-')
app = criar_app({'TESTING': True, 'DATA_DIR': tmp, 'DB_PATH': os.path.join(tmp, 'r.db'), 'SECRET_KEY': 'revisao'})
c = app.test_client()


def token():
    c.get('/entrar')
    with c.session_transaction() as s:
        return s.get('_csrf')


c.post('/entrar', data={'username': 'admin', 'password': 'Revisao2026ab', 'csrf_token': token()})
c.post('/trocar-senha', data={'new_password': 'Revisao2026cd', 'confirm_password': 'Revisao2026cd', 'csrf_token': token()})
c.post('/admin/usuarios/novo', data={'login': 'ana.loja', 'nome': 'Ana (Loja)', 'email': 'ana@exemplo.com',
                                     'perfis': ['6'], 'csrf_token': token()})

shutil.rmtree(SAIDA, ignore_errors=True)
os.makedirs(SAIDA)
shutil.copytree(os.path.join(RAIZ, 'app', 'static'), os.path.join(SAIDA, 'static'))
paginas = {'inicio': '/', 'admin': '/admin/', 'usuarios': '/admin/usuarios', 'usuario': '/admin/usuarios/2',
           'perfis': '/admin/perfis', 'perfil_loja': '/admin/perfis/6', 'auditoria': '/admin/auditoria',
           'trocar_senha': '/trocar-senha'}
for nome, url in paginas.items():
    html = c.get(url).get_data(as_text=True)
    open(os.path.join(SAIDA, nome + '.html'), 'w', encoding='utf-8').write(html)
# ver como perfil Fábrica
c.post('/admin/ver-como', data={'perfil_id': '5', 'csrf_token': token()})
open(os.path.join(SAIDA, 'ver_como_fabrica.html'), 'w', encoding='utf-8').write(c.get('/').get_data(as_text=True))
print('telas em', SAIDA, ':', ', '.join(sorted(os.listdir(SAIDA))))

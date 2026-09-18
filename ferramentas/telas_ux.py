# -*- coding: utf-8 -*-
"""Renderiza as telas como cada tipo de usuário as vê, com o mês aberto aos comentários, para a
revisão de experiência de uso — sem digitar senha em navegador (banco temporário, dados reais).

    python ferramentas/telas_ux.py   ->  _revisao/ux/<quem>_<tela>.html   (servir _revisao na 5056)
"""
import io
import os
import re
import shutil
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(RAIZ, 'tests'))
SAIDA = os.path.join(RAIZ, '_revisao', 'ux')
os.environ['APP55_ADMIN_LOGIN'] = 'admin'
os.environ['APP55_ADMIN_SENHA'] = 'Revisao2026ab'

from app import criar_app  # noqa: E402
from conftest import criar_usuario, entrar, post  # noqa: E402

tmp = tempfile.mkdtemp(prefix='app55-ux-')
app = criar_app({'TESTING': True, 'DATA_DIR': tmp, 'DB_PATH': os.path.join(tmp, 'u.db'), 'SECRET_KEY': 'ux',
                 'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')})
adm = app.test_client()
entrar(adm, 'admin', 'Revisao2026ab')
post(adm, '/trocar-senha', new_password='Revisao2026cd', confirm_password='Revisao2026cd')
adm.get('/fechamento/2026-07')
post(adm, '/fechamento/2026-07/situacao', status='disponibilizada', prazo_comentarios='30/09/2026')


def usuario(login, perfis):
    prov = criar_usuario(app, adm, login, perfis)
    c = app.test_client()
    entrar(c, login, prov)
    post(c, '/trocar-senha', new_password='Revisao2026ef', confirm_password='Revisao2026ef')
    return c


loja = usuario('ana.loja', ['loja'])
post(loja, '/comentarios/2026-07/loja/mn-evol', texto='Setembro de 2025 teve a feira de design: o pico não se repete.')

TELAS = {
    'admin': (adm, ['/', '/biblioteca/mensal', '/biblioteca/dre', '/fechamento/', '/fechamento/2026-07',
                    '/comentarios/', '/comentarios/2026-07/curadoria', '/apresentacao/', '/admin/']),
    'loja': (loja, ['/', '/biblioteca/mensal', '/comentarios/', '/comentarios/2026-07/loja/mn-evol']),
}
shutil.rmtree(SAIDA, ignore_errors=True)
os.makedirs(SAIDA)
static = os.path.join(RAIZ, '_revisao', 'static')
shutil.rmtree(static, ignore_errors=True)
shutil.copytree(os.path.join(RAIZ, 'app', 'static'), static)
for quem, (c, urls) in TELAS.items():
    for u in urls:
        r = c.get(u)
        nome = '%s_%s.html' % (quem, re.sub(r'[^a-z0-9]+', '_', u.strip('/')) or 'inicio')
        html = r.get_data(as_text=True).replace('"/static/', '"../static/')
        io.open(os.path.join(SAIDA, nome), 'w', encoding='utf-8').write(html)
        print('%-4s %s %s' % (r.status_code, quem, u))

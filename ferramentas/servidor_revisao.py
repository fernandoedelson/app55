# -*- coding: utf-8 -*-
"""
Servidor de REVISÃO de telas (só nesta máquina, porta 5058): banco temporário, dados reais de
julho, mês aberto aos comentários e usuários de teste por perfil. A rota /revisao/entrar/<login>
entra como aquele usuário SEM senha — é isso que permite revisar as telas no navegador sem digitar
senha nenhuma. Esse atalho existe só aqui: a aplicação de verdade (wsgi.py) não o tem.

    python ferramentas/servidor_revisao.py
    http://127.0.0.1:5058/revisao/entrar/ana.loja     (ana.loja · gerente.loja · controladoria · admin)
"""
import os
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
os.environ['APP55_ADMIN_LOGIN'] = 'admin'
os.environ['APP55_ADMIN_SENHA'] = 'Revisao-sem-uso-2026'

from flask import abort, redirect, request  # noqa: E402

from app import criar_app  # noqa: E402
from app.db import agora, get_db  # noqa: E402
from app.seguranca import senha as S  # noqa: E402
from app.seguranca import web  # noqa: E402

tmp = tempfile.mkdtemp(prefix='app55-revisao-')
app = criar_app({'DATA_DIR': tmp, 'DB_PATH': os.path.join(tmp, 'r.db'), 'SECRET_KEY': os.urandom(24).hex(),
                 'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')})

USUARIOS = [('ana.loja', 'Ana (vendedora da Loja)', ['loja']),
            ('gerente.loja', 'Gerente da Loja (responsável)', ['loja', 'responsavel_de_area']),
            ('controladoria', 'Controladoria', ['controladoria']),
            ('diretor', 'Diretoria (só lê)', ['gestao55'])]

with app.app_context():
    con = get_db()
    con.execute("INSERT INTO perfis (codigo, nome, descricao, criado_em) VALUES "
                "('responsavel_de_area', 'Responsável de área', 'Envia o comentário da área', ?)", (agora(),))
    pid = con.execute("SELECT id FROM perfis WHERE codigo='responsavel_de_area'").fetchone()['id']
    con.execute("INSERT INTO perfil_permissoes (perfil_id, recurso) VALUES (?, 'recurso:consolidar')", (pid,))
    for login, nome, perfis in USUARIOS:
        uid = con.execute('INSERT INTO usuarios (login, nome, senha_hash, trocar_senha, criado_em) VALUES (?,?,?,0,?)',
                          (login, nome, S.gerar_hash(os.urandom(16).hex()), agora())).lastrowid
        for cod in perfis:
            p = con.execute('SELECT id FROM perfis WHERE codigo=?', (cod,)).fetchone()
            con.execute('INSERT INTO usuario_perfis (usuario_id, perfil_id, concedido_em) VALUES (?,?,?)',
                        (uid, p['id'], agora()))
    con.execute('UPDATE usuarios SET trocar_senha=0')
    con.execute("INSERT INTO competencias (codigo, status, criada_em, criada_por, processada_em, disponibilizada_em, "
                "prazo_comentarios) VALUES ('2026-07', 'disponibilizada', ?, 'importação inicial', ?, ?, '2099-12-31')",
                (agora(), agora(), agora()))
    con.commit()


web.PUBLICAS.add('_entrar_revisao')      # só neste processo de revisão


@app.route('/revisao/entrar/<login>')
def _entrar_revisao(login):
    if request.remote_addr not in ('127.0.0.1', '::1'):
        abort(404)
    u = get_db().execute('SELECT * FROM usuarios WHERE login=?', (login,)).fetchone() or abort(404)
    web.iniciar_sessao(u)
    return redirect(request.args.get('ir') or '/')


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5058, debug=False)

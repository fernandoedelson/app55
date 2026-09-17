# -*- coding: utf-8 -*-
"""
Define (ou redefine) a senha do administrador local, sem depender da senha provisória do console.

    python ferramentas/senha_admin.py [login]

A senha é pedida no terminal e não aparece na tela nem fica em arquivo nenhum. Para uso não
interativo (Docker/Render), use a variável APP55_ADMIN_SENHA.
"""
import getpass
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from app import criar_app  # noqa: E402
from app.db import get_db  # noqa: E402
from app.seguranca.senha import MIN, gerar_hash  # noqa: E402


def main():
    login = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('APP55_ADMIN_LOGIN', 'admin')
    senha = os.environ.get('APP55_ADMIN_SENHA')
    if not senha:
        senha = getpass.getpass('Nova senha de "%s" (mínimo %d caracteres): ' % (login, MIN))
        if senha != getpass.getpass('Repita a senha: '):
            raise SystemExit('as duas senhas não conferem — nada foi alterado.')
    if len(senha) < MIN:
        raise SystemExit('a senha precisa de pelo menos %d caracteres — nada foi alterado.' % MIN)
    app = criar_app()
    with app.app_context():
        con = get_db()
        u = con.execute('SELECT id FROM usuarios WHERE login=?', (login,)).fetchone()
        if not u:
            raise SystemExit('usuário "%s" não existe neste banco.' % login)
        # versao_sessao sobe: qualquer sessão aberta com a senha antiga cai
        con.execute('UPDATE usuarios SET senha_hash=?, trocar_senha=0, ativo=1, '
                    'versao_sessao=versao_sessao+1, bloqueado_ate=NULL WHERE id=?', (gerar_hash(senha), u['id']))
        con.commit()
    print('senha de "%s" trocada. Entre em http://localhost:5055 com ela.' % login)


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""Usuários, perfis e permissões (modelo do Release Builder: N perfis por usuário, união das
permissões, recursos em texto) com o endurecimento do portal +55."""
from datetime import datetime, timedelta

from flask import current_app

from .. import catalogo as C
from ..db import agora, get_db
from . import senha as S


def por_login(login):
    return get_db().execute('SELECT * FROM usuarios WHERE login=?', ((login or '').strip(),)).fetchone()


def por_id(uid):
    return get_db().execute('SELECT * FROM usuarios WHERE id=?', (uid,)).fetchone()


def bloqueado(u):
    if not u or not u['bloqueado_ate']:
        return False
    try:
        return datetime.fromisoformat(u['bloqueado_ate']) > datetime.now()
    except ValueError:
        return False


def autenticar(login, senha):
    """(usuario, motivo). motivo: '' | 'invalido' | 'bloqueado'.

    Mesmo custo de tempo exista ou não o login (hash-isca). Conta desativada, bloqueada ou
    inexistente respondem a MESMA mensagem na tela — o motivo real só vai para a auditoria."""
    u = por_login(login)
    if u is None:
        S.conferir(senha or '', S.HASH_ISCA)
        return None, 'invalido'
    ok = S.conferir(senha or '', u['senha_hash'])
    if bloqueado(u):
        return None, 'bloqueado'
    if not u['ativo']:
        return None, 'invalido'
    db = get_db()
    if not ok:
        falhas = u['falhas'] + 1
        ate = None
        if falhas >= current_app.config['BLOQUEIO_FALHAS']:
            ate = (datetime.now() + timedelta(minutes=current_app.config['BLOQUEIO_MINUTOS'])).isoformat(timespec='seconds')
            falhas = 0
        db.execute('UPDATE usuarios SET falhas=?, bloqueado_ate=? WHERE id=?', (falhas, ate, u['id']))
        db.commit()
        return None, 'bloqueado' if ate else 'invalido'
    db.execute('UPDATE usuarios SET falhas=0, bloqueado_ate=NULL, ultimo_login=? WHERE id=?', (agora(), u['id']))
    db.commit()
    return por_id(u['id']), ''


def definir_senha(uid, nova, trocar_no_proximo=False):
    """Grava a senha e incrementa a versão da sessão: todos os outros aparelhos saem."""
    db = get_db()
    db.execute('UPDATE usuarios SET senha_hash=?, trocar_senha=?, senha_trocada_em=?, falhas=0, bloqueado_ate=NULL, '
               'versao_sessao=versao_sessao+1 WHERE id=?',
               (S.gerar_hash(nova), 1 if trocar_no_proximo else 0, agora(), uid))
    db.commit()
    return por_id(uid)['versao_sessao']


def perfis_do_usuario(uid):
    return get_db().execute(
        'SELECT p.* FROM perfis p JOIN usuario_perfis up ON up.perfil_id=p.id WHERE up.usuario_id=? ORDER BY p.nome',
        (uid,)).fetchall()


def permissoes_de_perfis(ids_perfis):
    if not ids_perfis:
        return set()
    marcas = ','.join('?' * len(ids_perfis))
    rows = get_db().execute('SELECT DISTINCT recurso FROM perfil_permissoes WHERE perfil_id IN (%s)' % marcas,
                            list(ids_perfis)).fetchall()
    return {r['recurso'] for r in rows}


def contexto(u, perfil_ver_como=None):
    """Dicionário usado em toda a requisição. Em "ver como perfil" as permissões são SÓ as do
    perfil escolhido — inclusive sem 'admin', senão o administrador continuaria vendo tudo."""
    if perfil_ver_como is not None:
        perfis = [perfil_ver_como]
    else:
        perfis = perfis_do_usuario(u['id'])
    perms = permissoes_de_perfis([p['id'] for p in perfis])
    return {
        'id': u['id'], 'login': u['login'], 'nome': u['nome'] or u['login'], 'email': u['email'],
        'perfis': [{'id': p['id'], 'codigo': p['codigo'], 'nome': p['nome']} for p in perfis],
        'permissoes': perms,
        'admin': C.PERMISSAO_ADMIN in perms,
        'trocar_senha': bool(u['trocar_senha']),
    }


def pode(ctx, permissao):
    if not ctx:
        return False
    return ctx['admin'] or permissao in ctx['permissoes']


def blocos_visiveis(ctx):
    """Blocos do catálogo que o contexto pode ver, na ordem do catálogo."""
    return [b for b in C.BLOCOS if pode(ctx, 'bloco:' + b['id'])]


def administradores_ativos(excluir_uid=None):
    q = ("SELECT COUNT(DISTINCT u.id) FROM usuarios u JOIN usuario_perfis up ON up.usuario_id=u.id "
         "JOIN perfil_permissoes pp ON pp.perfil_id=up.perfil_id WHERE pp.recurso='admin' AND u.ativo=1")
    args = []
    if excluir_uid is not None:
        q += ' AND u.id<>?'
        args.append(excluir_uid)
    return get_db().execute(q, args).fetchone()[0]

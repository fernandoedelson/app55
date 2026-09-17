# -*- coding: utf-8 -*-
"""Trilha de auditoria: quem fez o quê, quando, de onde — e se estava em "ver como perfil"."""
import json

from flask import g, has_request_context, request, session

from .db import agora, get_db


def ip_cliente():
    """IP do cliente. Atrás do proxy do Render o ProxyFix já pôs o IP real em remote_addr."""
    if not has_request_context():
        return ''
    return (request.remote_addr or '')[:64]


def registrar(acao, detalhes=None, usuario_id=None, login=None, commit=True):
    u = g.get('usuario_real') or g.get('usuario') if has_request_context() else None
    como = ''
    if has_request_context() and session.get('ver_como'):
        como = str(session.get('ver_como_nome', session.get('ver_como')))
    db = get_db()
    db.execute('INSERT INTO auditoria (em, usuario_id, login, acao, detalhes, ip, como_perfil) VALUES (?,?,?,?,?,?,?)',
               (agora(), usuario_id if usuario_id is not None else (u['id'] if u else None),
                (login if login is not None else (u['login'] if u else ''))[:64], acao[:64],
                json.dumps(detalhes or {}, ensure_ascii=False)[:2000], ip_cliente(), como[:64]))
    if commit:
        db.commit()

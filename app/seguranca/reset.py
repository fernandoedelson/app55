# -*- coding: utf-8 -*-
"""Tokens de recuperação de senha. O token bruto só existe no e-mail; o banco guarda o SHA-256."""
import hashlib
import secrets
from datetime import datetime, timedelta

from flask import current_app

from ..db import agora, get_db


def _h(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def criar(uid, ip=''):
    token = secrets.token_urlsafe(32)
    db = get_db()
    db.execute('UPDATE tokens_reset SET usado=1 WHERE usuario_id=? AND usado=0', (uid,))
    expira = (datetime.now() + timedelta(minutes=current_app.config['RESET_TOKEN_MIN'])).isoformat(timespec='seconds')
    db.execute('INSERT INTO tokens_reset (token_hash, usuario_id, criado_em, expira_em, usado, ip) VALUES (?,?,?,?,0,?)',
               (_h(token), uid, agora(), expira, (ip or '')[:64]))
    db.commit()
    return token


def validar(token):
    if not token or len(token) > 200:
        return None
    row = get_db().execute('SELECT usuario_id, expira_em, usado FROM tokens_reset WHERE token_hash=?',
                           (_h(token),)).fetchone()
    if row is None or row['usado']:
        return None
    try:
        if datetime.now() > datetime.fromisoformat(row['expira_em']):
            return None
    except ValueError:
        return None
    return row['usuario_id']


def consumir(token):
    db = get_db()
    db.execute('UPDATE tokens_reset SET usado=1 WHERE token_hash=?', (_h(token),))
    db.commit()

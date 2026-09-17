# -*- coding: utf-8 -*-
"""Proteções aplicadas a toda requisição: HTTPS, CSRF, sessão (versão, inatividade, prazo
absoluto), usuário no contexto, "ver como perfil" só leitura, troca de senha obrigatória,
limite de tentativas por IP e cabeçalhos de segurança."""
import hmac
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlparse

from flask import abort, current_app, flash, g, redirect, request, session, url_for

from ..auditoria import ip_cliente, registrar
from ..db import agora, get_db
from . import usuarios as U

# rotas que não pedem login
PUBLICAS = {'auth.login', 'auth.esqueci_senha', 'auth.redefinir_senha', 'static', 'inicio.saude'}
# rotas permitidas com troca de senha pendente
DURANTE_TROCA = {'auth.trocar_senha', 'auth.logout', 'static'}
# únicas escritas permitidas em "ver como perfil"
ESCRITA_EM_VER_COMO = {'admin.ver_como_sair', 'auth.logout'}
METODOS_ESCRITA = {'POST', 'PUT', 'PATCH', 'DELETE'}


def csrf_token():
    if '_csrf' not in session:
        session['_csrf'] = secrets.token_urlsafe(32)
    return session['_csrf']


def destino_seguro(alvo):
    """Aceita só caminho relativo do próprio site (evita redirecionamento aberto)."""
    if not alvo or not alvo.startswith('/') or alvo.startswith('//') or '\\' in alvo:
        return None
    p = urlparse(alvo)
    return alvo if not p.scheme and not p.netloc else None


def limite_excedido(tipo):
    c = current_app.config
    desde = (datetime.now() - timedelta(minutes=c['LIMITE_IP_JANELA_MIN'])).isoformat(timespec='seconds')
    n = get_db().execute('SELECT COUNT(*) FROM tentativas WHERE tipo=? AND ip=? AND em>=?',
                         (tipo, ip_cliente(), desde)).fetchone()[0]
    return n >= c['LIMITE_IP_TENTATIVAS']


def registrar_tentativa(tipo):
    db = get_db()
    db.execute('INSERT INTO tentativas (tipo, ip, em) VALUES (?,?,?)', (tipo, ip_cliente(), agora()))
    antigo = (datetime.now() - timedelta(days=2)).isoformat(timespec='seconds')
    db.execute('DELETE FROM tentativas WHERE em<?', (antigo,))
    db.commit()


def iniciar_sessao(u):
    session.clear()
    session.permanent = True
    session['uid'] = u['id']
    session['vs'] = u['versao_sessao']
    session['iat'] = agora()
    session['la'] = agora()
    csrf_token()


def _encerrar(motivo, u=None):
    if u is not None:
        registrar('sessao_encerrada', {'motivo': motivo}, usuario_id=u['id'], login=u['login'])
    session.clear()
    flash({'expirada': 'Sua sessão expirou. Entre novamente.',
           'revogada': 'Sua sessão foi encerrada. Entre novamente.'}.get(motivo, 'Entre novamente.'), 'info')
    return redirect(url_for('auth.login'))


def antes():
    c = current_app.config
    g.usuario = None
    g.usuario_real = None

    if c['FORCE_HTTPS'] and not request.is_secure and request.endpoint != 'inicio.saude':
        return redirect(request.url.replace('http://', 'https://', 1), code=301)

    if request.method in METODOS_ESCRITA:
        enviado = request.form.get('csrf_token') or request.headers.get('X-CSRF-Token') or ''
        esperado = session.get('_csrf') or ''
        if not esperado or not hmac.compare_digest(enviado, esperado):
            abort(400, 'Formulário expirado. Recarregue a página e tente de novo.')

    uid = session.get('uid')
    if uid:
        u = U.por_id(uid)
        if u is None or not u['ativo'] or session.get('vs') != u['versao_sessao']:
            return _encerrar('revogada', u)
        agora_dt = datetime.now()
        try:
            iat = datetime.fromisoformat(session.get('iat'))
            la = datetime.fromisoformat(session.get('la'))
        except (TypeError, ValueError):
            return _encerrar('expirada', u)
        if agora_dt - iat > timedelta(hours=c['SESSAO_ABSOLUTA_HORAS']) or \
           agora_dt - la > timedelta(minutes=c['SESSAO_INATIVIDADE_MIN']):
            return _encerrar('expirada', u)
        session['la'] = agora_dt.isoformat(timespec='seconds')

        real = U.contexto(u)
        pid = session.get('ver_como')
        if pid and real['admin']:
            perfil = get_db().execute('SELECT * FROM perfis WHERE id=?', (pid,)).fetchone()
            if perfil is None:
                session.pop('ver_como', None)
                g.usuario = real
            else:
                g.usuario_real = real
                g.usuario = U.contexto(u, perfil)
                g.usuario['trocar_senha'] = False
                if request.method in METODOS_ESCRITA and request.endpoint not in ESCRITA_EM_VER_COMO:
                    abort(403, 'Modo "ver como perfil" é só leitura. Saia do modo para alterar algo.')
        else:
            session.pop('ver_como', None)
            g.usuario = real

    if request.endpoint in PUBLICAS:
        return None
    if g.usuario is None:
        return redirect(url_for('auth.login', next=request.full_path.rstrip('?')
                                if request.method == 'GET' else None))
    if g.usuario['trocar_senha'] and request.endpoint not in DURANTE_TROCA:
        return redirect(url_for('auth.trocar_senha'))
    return None


def exigir(permissao):
    if not U.pode(g.usuario, permissao):
        abort(403)


def cabecalhos(resp):
    resp.headers['Content-Security-Policy'] = (
        "default-src 'self'; img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
        "script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; "
        "form-action 'self'; object-src 'none'")
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'SAMEORIGIN'
    resp.headers['Referrer-Policy'] = 'same-origin'
    resp.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()'
    resp.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    resp.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    resp.headers['X-Permitted-Cross-Domain-Policies'] = 'none'
    if request.is_secure:
        resp.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    if request.endpoint != 'static':
        resp.headers['Cache-Control'] = 'no-store'
    return resp

# -*- coding: utf-8 -*-
"""Entrar, sair, trocar senha, esqueci a senha e redefinir."""
import random

from flask import Blueprint, abort, current_app, flash, g, redirect, render_template, request, session, url_for

from .. import FOTOS
from ..auditoria import ip_cliente, registrar
from ..db import get_db
from ..seguranca import email as E
from ..seguranca import reset as R
from ..seguranca import senha as S
from ..seguranca import usuarios as U
from ..seguranca import web as W

bp = Blueprint('auth', __name__)

MSG_LOGIN = 'Usuário ou senha inválidos, ou conta temporariamente bloqueada.'


def _tela_login():
    return render_template('login.html', hero_img=random.choice(FOTOS), accent_img=random.choice(FOTOS))


@bp.route('/entrar', methods=['GET', 'POST'])
def login():
    if g.usuario and request.method == 'GET':
        return redirect(url_for('inicio.index'))
    if request.method == 'GET':
        return _tela_login()
    if W.limite_excedido('login'):
        registrar('login_limite_ip', {'login': request.form.get('username', '')[:64]})
        abort(429)
    W.registrar_tentativa('login')
    login_informado = (request.form.get('username') or '').strip()[:64]
    u, motivo = U.autenticar(login_informado, request.form.get('password') or '')
    if u is None:
        registrar('login_falhou', {'login': login_informado, 'motivo': motivo}, usuario_id=None, login=login_informado)
        flash(MSG_LOGIN, 'error')
        return _tela_login(), 401
    W.iniciar_sessao(u)
    registrar('login', {}, usuario_id=u['id'], login=u['login'])
    destino = W.destino_seguro(request.args.get('next'))
    return redirect(destino or url_for('inicio.index'))


@bp.route('/sair', methods=['POST'])
def logout():
    if g.usuario:
        registrar('logout', {})
    session.clear()
    return redirect(url_for('auth.login'))


@bp.route('/trocar-senha', methods=['GET', 'POST'])
def trocar_senha():
    forcada = bool(g.usuario and g.usuario['trocar_senha'])
    if request.method == 'POST':
        u = U.por_id(g.usuario['id'])
        nova = request.form.get('new_password') or ''
        if not forcada and not S.conferir(request.form.get('current_password') or '', u['senha_hash']):
            flash('A senha atual não confere.', 'error')
        elif nova != (request.form.get('confirm_password') or ''):
            flash('A confirmação não é igual à nova senha.', 'error')
        elif S.conferir(nova, u['senha_hash']):
            flash('A nova senha precisa ser diferente da atual.', 'error')
        else:
            ok, msg = S.validar_politica(nova)
            if not ok:
                flash(msg, 'error')
            else:
                versao = U.definir_senha(u['id'], nova)
                session['vs'] = versao          # este aparelho continua; os outros saem
                registrar('senha_trocada', {'forcada': forcada})
                flash('Senha alterada.', 'success')
                return redirect(url_for('inicio.index'))
    return render_template('change_password.html', forced=forcada)


@bp.route('/esqueci-senha', methods=['GET', 'POST'])
def esqueci_senha():
    if request.method == 'POST':
        if W.limite_excedido('reset'):
            abort(429)
        W.registrar_tentativa('reset')
        ident = (request.form.get('identifier') or '').strip()[:160]
        db = get_db()
        u = db.execute('SELECT * FROM usuarios WHERE (login=? OR (email<>\'\' AND email=?)) AND ativo=1',
                       (ident, ident.lower())).fetchone()
        if u is not None and E.valido(u['email']):
            token = R.criar(u['id'], ip_cliente())
            link = current_app.config['APP_BASE_URL'] + url_for('auth.redefinir_senha', token=token)
            enviado = E.enviar(u['email'], 'Redefinição de senha · +55 Design',
                               'Olá, %s.\n\nPara criar uma nova senha, acesse o link abaixo (vale por %d minutos):\n\n%s\n\n'
                               'Se você não pediu, ignore este e-mail — sua senha continua a mesma.'
                               % (u['nome'] or u['login'], current_app.config['RESET_TOKEN_MIN'], link))
            registrar('reset_solicitado', {'enviado': enviado}, usuario_id=u['id'], login=u['login'])
        # resposta idêntica exista ou não o usuário, e o link NUNCA aparece na tela
        flash('Se o usuário existir e tiver e-mail cadastrado, enviamos um link para criar nova senha.', 'info')
        return redirect(url_for('auth.esqueci_senha'))
    return render_template('forgot.html')


@bp.route('/redefinir-senha/<token>', methods=['GET', 'POST'])
def redefinir_senha(token):
    uid = R.validar(token)
    if uid is None:
        flash('Link inválido ou expirado. Peça um novo.', 'error')
        return redirect(url_for('auth.esqueci_senha'))
    if request.method == 'POST':
        nova = request.form.get('new_password') or ''
        if nova != (request.form.get('confirm_password') or ''):
            flash('A confirmação não é igual à nova senha.', 'error')
        else:
            ok, msg = S.validar_politica(nova)
            if not ok:
                flash(msg, 'error')
            else:
                U.definir_senha(uid, nova)
                R.consumir(token)
                u = U.por_id(uid)
                registrar('senha_redefinida', {}, usuario_id=uid, login=u['login'])
                session.clear()
                flash('Senha criada. Entre com a nova senha.', 'success')
                return redirect(url_for('auth.login'))
    return render_template('reset.html', token=token)

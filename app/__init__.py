# -*- coding: utf-8 -*-
"""Aplicação +55 Design — fábrica Flask."""
import random

from flask import Flask, g, render_template
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import Config, carregar_chave_secreta
from .db import fechar_db, init_db

FOTOS = ['img/p%d.jpg' % i for i in range(1, 20)]


def criar_app(config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config:
        app.config.update(config)
    app.config['SECRET_KEY'] = app.config.get('SECRET_KEY') or carregar_chave_secreta(app.config['DATA_DIR'])
    if app.config['TRUST_PROXY']:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    init_db(app)
    app.teardown_appcontext(fechar_db)

    from .seguranca import web
    app.before_request(web.antes)
    app.after_request(web.cabecalhos)

    from .rotas.auth import bp as bp_auth
    from .rotas.inicio import bp as bp_inicio
    from .rotas.admin import bp as bp_admin
    from .rotas.biblioteca import bp as bp_biblioteca
    from .rotas.apresentacao import bp as bp_apresentacao
    from .rotas.comentarios import bp as bp_comentarios
    from .rotas.competencias import bp as bp_competencias
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_biblioteca)
    app.register_blueprint(bp_inicio)
    app.register_blueprint(bp_admin, url_prefix='/admin')
    app.register_blueprint(bp_competencias)
    app.register_blueprint(bp_comentarios)
    app.register_blueprint(bp_apresentacao)

    @app.context_processor
    def _globais():
        from .comentarios import contagem
        from .seguranca.usuarios import pode
        return {'csrf_token': web.csrf_token, 'usuario': g.get('usuario'), 'usuario_real': g.get('usuario_real'),
                'pode': lambda p: pode(g.get('usuario'), p), 'foto_aleatoria': lambda: random.choice(FOTOS),
                # só é calculado se a página pedir (a barra e o menu mostram o número de pendências)
                'pendencias_n': lambda: contagem(g.get('usuario'))}

    @app.template_filter('data_br')
    def _data_br(v):
        """2026-09-30 -> 30/09/2026 (datas vêm do campo de data do navegador); o resto passa como está."""
        v = (v or '').strip()
        if len(v) >= 10 and v[4] == '-' and v[7] == '-':
            return '%s/%s/%s' % (v[8:10], v[5:7], v[:4])
        return v

    @app.template_filter('data_iso')
    def _data_iso(v):
        """30/09/2026 -> 2026-09-30, para preencher um <input type=date> com o valor já gravado."""
        v = (v or '').strip()
        if len(v) == 10 and v[2] == '/' and v[5] == '/':
            return '%s-%s-%s' % (v[6:], v[3:5], v[:2])
        return v

    for codigo in (400, 403, 404, 429):
        app.register_error_handler(codigo, lambda e, c=codigo: (render_template('erro.html', codigo=c, erro=e), c))
    return app

# -*- coding: utf-8 -*-
"""Página inicial. Nesta fase mostra o que o perfil pode ver no catálogo — a Biblioteca com os
gráficos chega na fase 3, quando o cálculo estiver no servidor."""
from flask import Blueprint, g, render_template

from .. import catalogo as C
from ..seguranca import usuarios as U

bp = Blueprint('inicio', __name__)


@bp.route('/')
def index():
    visiveis = U.blocos_visiveis(g.usuario)
    por_secao = {}
    for b in visiveis:
        por_secao.setdefault(b['secao'], []).append(b)
    secoes = [(C.SECAO[sid], por_secao[sid]) for sid in [s['id'] for s in C.SECOES] if sid in por_secao]
    recursos = [r for r in C.RECURSOS if U.pode(g.usuario, 'recurso:' + r[0])]
    return render_template('inicio.html', secoes=secoes, recursos=recursos, total=len(C.BLOCOS), n_visiveis=len(visiveis))


@bp.route('/saude')
def saude():
    return {'ok': True}

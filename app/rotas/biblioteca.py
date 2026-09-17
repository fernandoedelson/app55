# -*- coding: utf-8 -*-
"""Biblioteca: o relatório por tópico, calculado no servidor e desenhado pelo código do Kit."""
import json

from flask import Blueprint, abort, current_app, g, render_template, request

from .. import calculo
from .. import catalogo as C
from ..calculo import competencia as comp_mod
from ..seguranca import usuarios as U

bp = Blueprint('biblioteca', __name__)


@bp.route('/biblioteca/<secao>')
def secao(secao):
    if secao not in C.SECAO:
        abort(404)
    pode = lambda bid: U.pode(g.usuario, 'bloco:' + bid)
    if not any(pode(b['id']) for b in C.blocos_da_secao(secao)):
        abort(403)
    comps = comp_mod.disponiveis(current_app.config)
    comp = request.args.get('comp') or (comps[-1] if comps else None)
    if comp not in comps:
        abort(404)
    dados = comp_mod.carregar(current_app.config, comp)
    payloads = calculo.payloads_da_secao(dados, secao, pode)
    if payloads is None:
        return render_template('biblioteca_pendente.html', secao=C.SECAO[secao]), 200
    # o JSON vai dentro de <script type="application/json">: fechar a tag cedo é o único risco
    corpo = json.dumps(payloads, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return render_template('biblioteca.html', secao=C.SECAO[secao], comp=comp, payload=corpo)

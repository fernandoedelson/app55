# -*- coding: utf-8 -*-
"""Biblioteca: o relatório por tópico, calculado no servidor e desenhado pelo código do Kit.

    /biblioteca/<secao>                    página (payload inicial embutido)
    /api/biblioteca/<secao>                payload recalculado com filtros (?comp=&ym=...)
    /api/biblioteca/<secao>/detalhe/<nome> detalhamento (exige o recurso 'detalhar')

Toda resposta passa pelo mesmo filtro: só sai bloco que o perfil pode ver."""
import json

from flask import Blueprint, abort, current_app, g, jsonify, render_template, request

from .. import calculo
from .. import catalogo as C
from ..calculo import competencia as comp_mod
from ..seguranca import usuarios as U

bp = Blueprint('biblioteca', __name__)

PARAMS_PERMITIDOS = {'ym', 'de', 'ate', 'ent', 'janela', 'cli', 'seg', 'grupo', 'cat', 'ped', 'status', 'emp', 'dim', 'pac', 'seg'}


def _contexto(secao):
    if secao not in C.SECAO:
        abort(404)
    pode = lambda bid: U.pode(g.usuario, 'bloco:' + bid)
    if not any(pode(b['id']) for b in C.blocos_da_secao(secao)):
        abort(403)
    comps = comp_mod.disponiveis(current_app.config)
    comp = request.args.get('comp') or (comps[-1] if comps else None)
    if comp not in comps:
        abort(404)
    params = {k: v[:40] for k, v in request.args.items() if k in PARAMS_PERMITIDOS}
    return pode, comp, comp_mod.carregar(current_app.config, comp), params


@bp.route('/biblioteca/<secao>')
def secao(secao):
    pode, comp, dados, params = _contexto(secao)
    payloads = calculo.payloads_da_secao(dados, secao, pode, params)
    if payloads is None:
        return render_template('biblioteca_pendente.html', secao=C.SECAO[secao]), 200
    # o JSON vai dentro de <script type="application/json">: fechar a tag cedo é o único risco
    corpo = json.dumps(payloads, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    recursos = [r[0] for r in C.RECURSOS if U.pode(g.usuario, 'recurso:' + r[0])]
    return render_template('biblioteca.html', secao=C.SECAO[secao], comp=comp, payload=corpo,
                           recursos=json.dumps(recursos))


@bp.route('/api/biblioteca/<secao>')
def api_secao(secao):
    pode, comp, dados, params = _contexto(secao)
    payloads = calculo.payloads_da_secao(dados, secao, pode, params)
    if payloads is None:
        abort(404)
    return jsonify(payloads)


@bp.route('/api/biblioteca/<secao>/detalhe/<nome>')
def api_detalhe(secao, nome):
    pode, comp, dados, params = _contexto(secao)
    det = calculo.DETALHES.get((secao, nome))
    if det is None:
        abort(404)
    bloco, funcao = det
    if not pode(bloco) or not U.pode(g.usuario, 'recurso:detalhar'):
        abort(403)
    try:
        return jsonify(funcao(dados, params))
    except (KeyError, ValueError, TypeError):
        abort(400)

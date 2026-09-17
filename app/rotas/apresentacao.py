# -*- coding: utf-8 -*-
"""A apresentação do mês: a reunião em seis atos, com os encaminhamentos.

    /apresentacao/                 a competência aberta (ou a última publicada)
    /apresentacao/<comp>           o roteiro montado com o que o perfil enxerga
    /apresentacao/<comp>/encaminhamentos   o combinado: criar, marcar feito, confirmar

O roteiro é igual para todos (está no código, como o catálogo). O que muda é o conteúdo: o
servidor manda só os blocos permitidos e o ato que ficou sem nenhum diz "conteúdo restrito"."""
import json

from flask import (Blueprint, abort, current_app, flash, g, redirect, render_template, request,
                   url_for)

from .. import auditoria
from .. import calculo
from .. import catalogo as C
from .. import comentarios as M
from .. import destaques as D
from ..apresentacao import atos as A
from ..apresentacao import encaminhamentos as E
from ..calculo import competencia as comp_mod
from ..seguranca import usuarios as U

bp = Blueprint('apresentacao', __name__, url_prefix='/apresentacao')


def _competencia(codigo):
    comps = comp_mod.disponiveis(current_app.config)
    if not comps:
        abort(404)
    comp = codigo or M.competencia_aberta() or comps[-1]
    if comp not in comps:
        abort(404)
    return comp


@bp.route('/')
@bp.route('/<codigo>')
def ver(codigo=None):
    comp = _competencia(codigo)
    pode = lambda bid: U.pode(g.usuario, 'bloco:' + bid)
    roteiro = A.roteiro(pode)
    dados = comp_mod.carregar(current_app.config, comp)
    payloads = {}
    for secao in A.secoes_necessarias(roteiro):
        # _extras liga os blocos que só existem na reunião (o canal, no ato 4); a Biblioteca
        # nunca manda esse parâmetro, e ele não vem da URL (PARAMS_PERMITIDOS não o inclui)
        p = calculo.payloads_da_secao(dados, secao, pode, {'_extras': True})
        if p is None:
            continue
        for bloco, mapa in D.para_secao(dados, secao, {}, pode).items():
            if bloco in p:
                p[bloco].setdefault('_ins', {}).update(mapa)
        payloads[secao] = p
    corpo = json.dumps(payloads, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    recursos = [r[0] for r in C.RECURSOS if U.pode(g.usuario, 'recurso:' + r[0])]
    # comentários que a Controladoria escolheu para a reunião, por bloco
    notas = {}
    for bloco, cs in M.por_bloco(comp, g.usuario).items():
        escolhidos = [c for c in cs if c['na_apresentacao']]
        if escolhidos:
            notas[bloco] = escolhidos
    return render_template('apresentacao/reuniao.html', comp=comp, roteiro=roteiro, payload=corpo,
                           recursos=json.dumps(recursos), secoes=A.secoes_necessarias(roteiro),
                           notas=notas, titulo=C.BLOCO, anexos=A.ANEXOS, secao=C.SECAO,
                           encaminhamentos=E.da_competencia(comp), retomada=E.retomada(comp),
                           pode_apresentar=U.pode(g.usuario, 'recurso:apresentar'),
                           pode_exportar=U.pode(g.usuario, 'recurso:exportar'),
                           cura=U.pode(g.usuario, 'recurso:curar_comentarios'))


@bp.route('/<codigo>/encaminhamentos', methods=['POST'])
def criar_encaminhamento(codigo):
    if not U.pode(g.usuario, 'recurso:curar_comentarios'):
        abort(403)                       # quem conduz a reunião é quem registra o combinado
    if g.get('ver_como'):
        abort(403)
    try:
        E.criar(codigo, request.form.get('texto'), request.form.get('responsavel'),
                request.form.get('prazo'), g.usuario['login'], ato=request.form.get('ato') or 0,
                bloco=request.form.get('bloco') or '')
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('apresentacao.ver', codigo=codigo))
    auditoria.registrar('encaminhamento.criar', '%s · %s' % (codigo, request.form.get('responsavel') or ''))
    flash('Encaminhamento registrado.', 'ok')
    return redirect(url_for('apresentacao.ver', codigo=codigo))


@bp.route('/encaminhamentos/<int:eid>/feito', methods=['POST'])
def feito(eid):
    if g.get('ver_como'):
        abort(403)
    e = E.obter(eid) or abort(404)
    try:
        E.marcar_feito(eid, g.usuario['login'], request.form.get('resposta', ''))
    except ValueError as erro:
        flash(str(erro), 'erro')
        return redirect(url_for('apresentacao.ver', codigo=e['competencia']))
    auditoria.registrar('encaminhamento.feito', str(eid))
    flash('Marcado como feito. A Controladoria confirma.', 'ok')
    return redirect(url_for('apresentacao.ver', codigo=e['competencia']))


@bp.route('/encaminhamentos/<int:eid>/confirmar', methods=['POST'])
def confirmar(eid):
    if not U.pode(g.usuario, 'recurso:curar_comentarios'):
        abort(403)
    if g.get('ver_como'):
        abort(403)
    e = E.obter(eid) or abort(404)
    acao = request.form.get('acao', 'confirmar')
    try:
        if acao == 'cancelar':
            E.cancelar(eid, g.usuario['login'])
        else:
            E.confirmar(eid, g.usuario['login'], confirma=acao == 'confirmar')
    except ValueError as erro:
        flash(str(erro), 'erro')
        return redirect(url_for('apresentacao.ver', codigo=e['competencia']))
    auditoria.registrar('encaminhamento.' + acao, str(eid))
    return redirect(url_for('apresentacao.ver', codigo=e['competencia']))

# -*- coding: utf-8 -*-
"""Comentários das áreas: escrever, consolidar e enviar; e a curadoria da Controladoria.

Quem escreve precisa de `recurso:comentar` (e só pelas áreas que são seus perfis); quem envia,
de `recurso:consolidar`; a curadoria, de `recurso:curar_comentarios`."""
from flask import Blueprint, abort, flash, g, redirect, render_template, request, url_for

from .. import auditoria
from .. import catalogo as C
from .. import comentarios as M
from ..importacao import servico
from ..seguranca import usuarios as U

bp = Blueprint('comentarios', __name__, url_prefix='/comentarios')


def _cura():
    return U.pode(g.usuario, 'recurso:curar_comentarios')


@bp.before_request
def _exigir():
    if not (U.pode(g.usuario, 'recurso:comentar') or _cura()):
        abort(403)
    if g.get('ver_como') and request.method == 'POST':
        abort(403)


def _area_pedida(codigo_area):
    """A área tem de ser um perfil do próprio usuário — ninguém comenta em nome de outra."""
    minhas = {a['codigo'] for a in M.areas_do_usuario(g.usuario)}
    if codigo_area not in minhas:
        abort(403)
    return codigo_area


def _competencia(codigo=None):
    return codigo or M.competencia_aberta()


@bp.route('/')
def index():
    codigo = _competencia(request.args.get('comp'))
    if not codigo:
        return render_template('comentarios/lista.html', codigo=None, areas=[], escrever=[], painel=None)
    minhas = M.areas_do_usuario(g.usuario)
    aberto, motivo = M.prazo_aberto(codigo)
    blocos = {}
    for a in minhas:
        meus = {c['bloco']: c for c in M.da_area(codigo, a['codigo'])}
        pend = {p['bloco']: p for p in M.pedidos(codigo, a['codigo'])}
        blocos[a['codigo']] = [{'bloco': b, 'comentario': meus.get(b['id']), 'pedido': pend.get(b['id'])}
                               for b in M.blocos_da_area(a['codigo'])]
    return render_template('comentarios/lista.html', codigo=codigo, areas=minhas, blocos=blocos,
                           aberto=aberto, motivo=motivo, titulo_secao=C.SECAO,
                           pode_enviar=U.pode(g.usuario, 'recurso:consolidar'), cura=_cura(),
                           painel=M.painel(codigo) if _cura() else None)


@bp.route('/<codigo>/<area>/<bloco>', methods=['GET', 'POST'])
def bloco(codigo, area, bloco):
    if bloco not in C.BLOCO:
        abort(404)
    _area_pedida(area)
    if request.method == 'POST':
        try:
            M.escrever(codigo, bloco, area, request.form.get('texto'), g.usuario['login'])
        except ValueError as e:
            flash(str(e), 'erro')
            return redirect(url_for('comentarios.bloco', codigo=codigo, area=area, bloco=bloco))
        auditoria.registrar('comentario.escrever', '%s · %s · %s' % (codigo, area, bloco))
        flash('Comentário guardado. O responsável da área envia quando estiver pronto.', 'ok')
        return redirect(url_for('comentarios.bloco', codigo=codigo, area=area, bloco=bloco))
    atual = M.obter(codigo, bloco, area)
    aberto, motivo = M.prazo_aberto(codigo)
    return render_template('comentarios/bloco.html', codigo=codigo, area=area, bloco=C.BLOCO[bloco],
                           comentario=atual, aberto=aberto, motivo=motivo,
                           historico=M.historico(atual['id']) if atual else [],
                           pedido=next((p for p in M.pedidos(codigo, area) if p['bloco'] == bloco), None),
                           pode_enviar=U.pode(g.usuario, 'recurso:consolidar'))


@bp.route('/<codigo>/<area>/<bloco>/enviar', methods=['POST'])
def enviar(codigo, area, bloco):
    _area_pedida(area)
    if not U.pode(g.usuario, 'recurso:consolidar'):
        abort(403)
    try:
        M.enviar(codigo, bloco, area, g.usuario['login'])
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('comentarios.bloco', codigo=codigo, area=area, bloco=bloco))
    auditoria.registrar('comentario.enviar', '%s · %s · %s' % (codigo, area, bloco))
    flash('Comentário enviado à Controladoria.', 'ok')
    return redirect(url_for('comentarios.index', comp=codigo))


@bp.route('/<codigo>/curadoria')
def curadoria(codigo):
    if not _cura():
        abort(403)
    linhas = M.enviados(codigo)
    return render_template('comentarios/curadoria.html', codigo=codigo, linhas=linhas, titulo=C.BLOCO,
                           painel=M.painel(codigo), areas=M.areas_que_comentam(),
                           blocos=C.BLOCOS, secao=C.SECAO,
                           comp=servico.obter(codigo))


@bp.route('/<codigo>/curadoria/decidir', methods=['POST'])
def decidir(codigo):
    if not _cura():
        abort(403)
    area, bloco = request.form.get('area', ''), request.form.get('bloco', '')
    acao = request.form.get('acao', '')
    try:
        M.decidir(codigo, bloco, area, acao, g.usuario['login'], texto=request.form.get('texto'),
                  motivo=request.form.get('motivo', ''),
                  na_apresentacao=request.form.get('na_apresentacao') == '1' if acao == 'aprovar' else None)
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('comentarios.curadoria', codigo=codigo))
    auditoria.registrar('comentario.' + acao, '%s · %s · %s' % (codigo, area, bloco))
    flash({'aprovar': 'Comentário aprovado.', 'recusar': 'Comentário recusado — a área foi avisada na tela dela.',
           'devolver': 'Comentário devolvido para a área.'}.get(acao, 'Feito.'), 'ok')
    return redirect(url_for('comentarios.curadoria', codigo=codigo))


@bp.route('/<codigo>/curadoria/apresentacao', methods=['POST'])
def apresentacao(codigo):
    if not _cura():
        abort(403)
    area, bloco = request.form.get('area', ''), request.form.get('bloco', '')
    try:
        M.marcar_apresentacao(codigo, bloco, area, request.form.get('entra') == '1')
    except ValueError as e:
        flash(str(e), 'erro')
    auditoria.registrar('comentario.apresentacao', '%s · %s · %s · %s'
                        % (codigo, area, bloco, 'entra' if request.form.get('entra') == '1' else 'sai'))
    return redirect(url_for('comentarios.curadoria', codigo=codigo))


@bp.route('/<codigo>/curadoria/pedir', methods=['POST'])
def pedir(codigo):
    if not _cura():
        abort(403)
    area, bloco = request.form.get('area', ''), request.form.get('bloco', '')
    try:
        M.pedir(codigo, bloco, area, g.usuario['login'], request.form.get('observacao', ''))
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('comentarios.curadoria', codigo=codigo))
    auditoria.registrar('comentario.pedir', '%s · %s · %s' % (codigo, area, bloco))
    flash('Pedido registrado: a área vê a pendência na tela dela.', 'ok')
    return redirect(url_for('comentarios.curadoria', codigo=codigo))

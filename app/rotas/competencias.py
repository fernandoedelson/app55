# -*- coding: utf-8 -*-
"""Fechamento do mês: subir as bases, processar, ver o que mudou e publicar.

Quem entra aqui precisa de `recurso:fechamento`; cada base exige `base:upload:<id>`.
Processar e publicar são da Controladoria (ou de quem o administrador autorizar)."""
import os

from flask import Blueprint, abort, current_app, flash, g, redirect, render_template, request, url_for

from .. import auditoria
from .. import catalogo as C
from .. import comentarios as M
from ..importacao import motor, servico
from ..seguranca import usuarios as U

bp = Blueprint('competencias', __name__, url_prefix='/fechamento')


def _pode(recurso):
    return U.pode(g.usuario, 'recurso:' + recurso)


@bp.before_request
def _exigir_fechamento():
    if not _pode('fechamento'):
        abort(403)
    if g.get('ver_como') and request.method == 'POST':
        abort(403)


@bp.route('/')
def index():
    return render_template('fechamento/lista.html', competencias=servico.listar(), bases=motor.BASES)


@bp.route('/nova', methods=['POST'])
def nova():
    codigo = (request.form.get('codigo') or '').strip()
    try:
        servico.criar(codigo, g.usuario['login'])
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('competencias.index'))
    auditoria.registrar('competencia.criar', codigo)
    flash('Competência %s criada. Agora suba as bases do mês.' % codigo, 'ok')
    return redirect(url_for('competencias.ver', codigo=codigo))


@bp.route('/<codigo>')
def ver(codigo):
    comp = servico.obter(codigo)
    if not comp:
        abort(404)
    publicadas = servico.blocos_publicados(codigo)
    secoes = [dict(s, blocos=C.blocos_da_secao(s['id'])) for s in C.SECOES]
    return render_template('fechamento/competencia.html', comp=comp, bases=motor.BASES,
                           arquivos=servico.arquivos(codigo), faltando=servico.faltando(codigo),
                           passado=servico.mudou_o_passado(codigo), secoes=secoes,
                           blocos_publicados=publicadas,
                           pode_upload={b: U.pode(g.usuario, 'base:upload:' + b) for b in motor.BASES})


@bp.route('/<codigo>/upload', methods=['POST'])
def upload(codigo):
    arquivo = request.files.get('arquivo')
    data_posicao = request.form.get('data_posicao') or ''
    if not arquivo or not arquivo.filename:
        flash('Escolha um arquivo.', 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    declarada = request.form.get('base') or None
    base = servico.base_do_arquivo(os.path.basename(arquivo.filename)) or declarada
    if base and not U.pode(g.usuario, 'base:upload:' + base):
        abort(403)
    try:
        r = servico.guardar_arquivo(codigo, arquivo, data_posicao, g.usuario['login'], declarada)
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    auditoria.registrar('competencia.upload', '%s · %s · %s · posição %s'
                        % (codigo, r['base'], r['arquivo'], data_posicao))
    flash('%s recebido como "%s".' % (r['arquivo'], motor.BASES[r['base']]['titulo']), 'ok')
    return redirect(url_for('competencias.ver', codigo=codigo))


@bp.route('/<codigo>/processar', methods=['POST'])
def processar(codigo):
    try:
        servico.processar(codigo, g.usuario['login'])
    except (ValueError, KeyError) as e:
        flash('Não consegui processar: %s' % e, 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    except Exception as e:                      # erro de planilha: mostra em vez de 500
        current_app.logger.exception('falha ao processar %s', codigo)
        flash('Falha ao ler as planilhas: %s' % e, 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    auditoria.registrar('competencia.processar', codigo)
    divergencias = servico.mudou_o_passado(codigo)
    if divergencias:
        flash('Dados gerados, mas %d mês(es) já publicados mudaram — confira antes de publicar.'
              % len(divergencias), 'erro')
    else:
        flash('Dados gerados. O passado continua igual ao da competência anterior.', 'ok')
    return redirect(url_for('competencias.ver', codigo=codigo))


@bp.route('/<codigo>/mudancas')
def mudancas(codigo):
    if codigo not in [c['codigo'] for c in servico.listar()]:
        abort(404)
    secoes = [dict(s, blocos=C.blocos_da_secao(s['id'])) for s in C.SECOES]
    return render_template('fechamento/mudancas.html', codigo=codigo, secoes=secoes,
                           mudancas=servico.o_que_mudou(codigo), passado=servico.mudou_o_passado(codigo),
                           titulo=C.BLOCO)


@bp.route('/<codigo>/publicar', methods=['POST'])
def publicar(codigo):
    blocos = request.form.getlist('bloco')
    justificativa = (request.form.get('justificativa') or '').strip()
    divergencias = servico.mudou_o_passado(codigo)
    if divergencias and not justificativa:
        flash('O passado mudou em %d mês(es): escreva a justificativa para publicar.' % len(divergencias), 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    n = servico.publicar(codigo, blocos, g.usuario['login'])
    auditoria.registrar('competencia.publicar', '%s · %d blocos%s'
                        % (codigo, n, (' · justificativa: ' + justificativa) if justificativa else ''))
    flash('%d bloco(s) publicados na competência %s.' % (n, codigo), 'ok')
    return redirect(url_for('competencias.ver', codigo=codigo))


@bp.route('/<codigo>/situacao', methods=['POST'])
def situacao(codigo):
    status = request.form.get('status') or ''
    prazo = request.form.get('prazo_comentarios')
    try:
        servico.mudar_status(codigo, status, g.usuario['login'], prazo)
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    auditoria.registrar('competencia.situacao', '%s · %s%s' % (codigo, status,
                                                               (' · prazo ' + prazo) if prazo else ''))
    if status == 'disponibilizada':
        # disponibilizar é o gatilho do ciclo das áreas: elas são avisadas por e-mail (se houver SMTP)
        n = M.avisar_areas(codigo)
        flash('Competência %s disponibilizada às áreas%s.'
              % (codigo, (' — %d pessoa(s) avisadas por e-mail' % n) if n else ''), 'ok')
        return redirect(url_for('competencias.ver', codigo=codigo))
    flash('Competência %s agora está "%s".' % (codigo, status), 'ok')
    return redirect(url_for('competencias.ver', codigo=codigo))


@bp.route('/<codigo>/descartar', methods=['POST'])
def descartar(codigo):
    try:
        servico.apagar_rascunho(codigo)
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    auditoria.registrar('competencia.descartar', codigo)
    flash('Rascunho %s descartado.' % codigo, 'ok')
    return redirect(url_for('competencias.index'))

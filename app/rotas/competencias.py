# -*- coding: utf-8 -*-
"""Fechamento do mês: subir as bases, processar, ver o que mudou e publicar.

Quem entra aqui precisa de `recurso:fechamento`; cada base exige `base:upload:<id>`.
Processar e publicar são da Controladoria (ou de quem o administrador autorizar)."""
import os
import threading
import time

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
    comp = servico.obter(codigo) or servico.registrar_importada(codigo)
    if not comp:
        abort(404)
    publicadas = servico.blocos_publicados(codigo)
    ult = _ANDAMENTO.get(codigo) or {}
    if ult.get('estado') in ('ok', 'erro') and not ult.get('mostrado'):
        ult['mostrado'] = True
        flash(ult['msg'], ult['tipo'])
    secoes = [dict(s, blocos=C.blocos_da_secao(s['id'])) for s in C.SECOES]
    return render_template('fechamento/competencia.html', comp=comp, bases=motor.BASES, reuso=servico.reuso(codigo),
                           bases_pasta=servico.BASES_PASTA, processando=ult.get('estado') == 'processando',
                           resumo_exclusao=servico.resumo_da_exclusao(codigo),
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
    if r['base'] == 'carteira':
        # a carteira dinâmica vale na hora, mesmo com o mês publicado: só ela é relida
        try:
            if servico.atualizar_carteira_dinamica(codigo, g.usuario['login']):
                auditoria.registrar('competencia.carteira_dinamica', '%s · posição %s' % (codigo, data_posicao))
                flash('Carteira dinâmica atualizada no relatório e na reunião (posição %s).'
                      % data_posicao, 'ok')
        except Exception as e:
            current_app.logger.exception('carteira dinâmica %s', codigo)
            flash('Arquivo guardado, mas não consegui atualizar a carteira dinâmica: %s' % e, 'erro')
    return redirect(url_for('competencias.ver', codigo=codigo) + '#bases')


@bp.route('/<codigo>/reuso', methods=['POST'])
def reuso(codigo):
    """Liga/desliga "usar o do mês anterior" numa base que não muda todo mês."""
    base = request.form.get('base', '')
    if base not in motor.BASES or not U.pode(g.usuario, 'base:upload:' + base):
        abort(403)
    usar = request.form.get('usar') == '1'
    try:
        servico.marcar_reuso(codigo, base, usar, g.usuario['login'])
    except ValueError as e:
        flash(str(e)[:1].upper() + str(e)[1:], 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo) + '#bases')
    auditoria.registrar('competencia.reuso', '%s · %s · %s' % (codigo, base, 'usa o anterior' if usar else 'sobe o do mês'))
    flash(('"%s" vai usar a planilha do mês anterior.' if usar else '"%s": suba a planilha deste mês.')
          % motor.BASES[base]['titulo'], 'ok')
    return redirect(url_for('competencias.ver', codigo=codigo) + '#bases')


# Processar leva minutos (as planilhas são grandes e o plano Starter tem meia CPU). Uma requisição presa
# esse tempo todo morre no proxy da empresa ou no balanceador ("Connection Timed Out"), então a leitura
# roda numa thread do servidor e a tela consulta o andamento. O servidor roda com UM worker (SQLite),
# por isso o estado em memória é o mesmo para todas as requisições.
_ANDAMENTO = {}
_TRAVA = threading.Lock()


def _processar_em_segundo_plano(app, codigo, login):
    with app.app_context():
        try:
            servico.processar(codigo, login)
            auditoria.registrar('competencia.processar', codigo, login=login)
            divergencias = servico.mudou_o_passado(codigo)
            if divergencias:
                fim = {'estado': 'ok', 'tipo': 'erro',
                       'msg': 'Dados gerados, mas %d mês(es) já publicados mudaram — confira antes de publicar.'
                              % len(divergencias)}
            else:
                fim = {'estado': 'ok', 'tipo': 'ok',
                       'msg': 'Dados gerados. O passado continua igual ao da competência anterior.'}
        except (ValueError, KeyError) as e:
            fim = {'estado': 'erro', 'tipo': 'erro', 'msg': 'Não consegui processar: %s' % e}
        except Exception as e:                  # erro de planilha: mostra em vez de perder no log
            app.logger.exception('falha ao processar %s', codigo)
            fim = {'estado': 'erro', 'tipo': 'erro', 'msg': 'Falha ao ler as planilhas: %s' % e}
    with _TRAVA:
        _ANDAMENTO[codigo] = dict(fim, fim=time.time(), mostrado=False)


@bp.route('/<codigo>/processar', methods=['POST'])
def processar(codigo):
    comp = servico.obter(codigo)
    if not comp:
        flash('Não consegui processar: competência não encontrada.', 'erro')
        return redirect(url_for('competencias.index'))
    if comp['status'] == 'fechada':
        flash('Não consegui processar: competência fechada: reabra antes de reprocessar.', 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    if servico.faltando(codigo):
        flash('Não consegui processar: faltam bases obrigatórias: %s.'
              % ', '.join(motor.BASES[b]['titulo'] for b in servico.faltando(codigo)), 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    with _TRAVA:
        if _ANDAMENTO.get(codigo, {}).get('estado') == 'processando':
            flash('Este mês já está sendo processado: aguarde terminar.', 'ok')
            return redirect(url_for('competencias.ver', codigo=codigo) + '#processar')
        _ANDAMENTO[codigo] = {'estado': 'processando', 'inicio': time.time()}
    threading.Thread(target=_processar_em_segundo_plano, daemon=True,
                     args=(current_app._get_current_object(), codigo, g.usuario['login'])).start()
    return redirect(url_for('competencias.ver', codigo=codigo) + '#processar')


@bp.route('/<codigo>/processar/estado')
def processar_estado(codigo):
    """Andamento da leitura, para a tela consultar sem recarregar."""
    e = _ANDAMENTO.get(codigo) or {}
    if e.get('estado') == 'processando':
        return {'estado': 'processando', 'segundos': int(time.time() - e['inicio'])}
    return {'estado': e.get('estado', 'parado'), 'msg': e.get('msg', ''), 'tipo': e.get('tipo', '')}


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


@bp.route('/<codigo>/excluir', methods=['POST'])
def excluir(codigo):
    """Exclui a competência em qualquer situação. Só o administrador, e só digitando o código do mês."""
    if not g.usuario['admin']:
        abort(403)
    if (request.form.get('confirmar') or '').strip() != codigo:
        flash('Para excluir, digite o código do mês (%s) no campo de confirmação.' % codigo, 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    if _ANDAMENTO.get(codigo, {}).get('estado') == 'processando':
        flash('Este mês está sendo processado agora: espere terminar para excluir.', 'erro')
        return redirect(url_for('competencias.ver', codigo=codigo))
    try:
        r = servico.excluir(codigo)
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('competencias.index'))
    _ANDAMENTO.pop(codigo, None)
    auditoria.registrar('competencia.excluir', '%s · %d planilhas, %d comentários, %d encaminhamentos, %d blocos publicados'
                        % (codigo, r['planilhas'], r['comentarios'], r['encaminhamentos'], r['blocos_publicados']))
    flash('Competência %s excluída (%d planilhas, %d comentários e %d encaminhamentos saíram junto).'
          % (codigo, r['planilhas'], r['comentarios'], r['encaminhamentos']), 'ok')
    return redirect(url_for('competencias.index'))


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

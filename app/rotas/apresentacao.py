# -*- coding: utf-8 -*-
"""A apresentação do mês: a reunião em seis atos, com os encaminhamentos.

    /apresentacao/<comp>                  a versão em Atos IDÊNTICA ao HTML aprovado (quem vê tudo)
                                          ou o roteiro filtrado pelo perfil (quem vê parte)
    /apresentacao/<comp>/baixar           o mesmo HTML para levar (recurso exportar)
    /apresentacao/<comp>/encaminhamentos  o combinado: criar, marcar feito, confirmar

O roteiro é igual para todos (está no código, como o catálogo). O que muda é o conteúdo: o
servidor manda só os blocos permitidos e o ato que ficou sem nenhum diz "conteúdo restrito"."""
import json

from flask import (Blueprint, abort, current_app, flash, g, redirect, render_template, request,
                   send_file, url_for)

from .. import auditoria
from .. import calculo
from .. import catalogo as C
from .. import comentarios as M
from .. import destaques as D
from ..apresentacao import atos as A
from ..apresentacao import encaminhamentos as E
from ..apresentacao import kit_atos
from ..calculo import competencia as comp_mod
from ..db import get_db
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
    if kit_atos.pode_ver_inteiro(g.usuario):
        # quem enxerga tudo recebe o documento do Kit, idêntico ao aprovado (mesmo código, mesmos dados)
        auditoria.registrar('apresentacao.abrir', comp)
        resp = send_file(kit_atos.obter(comp), mimetype='text/html', max_age=0)
        resp.headers['Cache-Control'] = 'private, no-store'
        return resp
    return _filtrada(comp)


@bp.route('/<codigo>/baixar')
def baixar(codigo):
    """O HTML para levar: só com o recurso exportar, e só para quem pode ver os dados inteiros."""
    comp = _competencia(codigo)
    if not (U.pode(g.usuario, 'recurso:exportar') and kit_atos.pode_ver_inteiro(g.usuario)):
        abort(403)
    auditoria.registrar('apresentacao.baixar', comp)
    return send_file(kit_atos.obter(comp), mimetype='text/html', as_attachment=True,
                     download_name='Analise_Vendas_e_DRE_55Design_Atos_%s.html' % comp, max_age=0)


def _filtrada(comp):
    """Perfil que vê só parte do relatório: o roteiro montado apenas com os blocos dele. O
    documento do Kit não serve aqui — ele carrega os dados do mês inteiros."""
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
    blocos = [b for ato in roteiro for b in A.blocos_do_ato(ato) if not b.endswith('.abertura')]
    cmt = M.camada(comp, g.usuario, blocos, so_leitura=bool(g.get('ver_como')), so_apresentacao=True,
                     escrever=False)
    pessoas = [dict(r) for r in get_db().execute('SELECT login, nome FROM usuarios WHERE ativo=1 ORDER BY nome')]         if U.pode(g.usuario, 'recurso:curar_comentarios') else []
    return render_template('apresentacao/reuniao.html', comp=comp, roteiro=roteiro, payload=corpo,
                           cmt=cmt, pessoas=pessoas, nav=None,
                           recursos=json.dumps(recursos), secoes=A.secoes_necessarias(roteiro),
                           notas=notas, titulo=C.BLOCO, anexos=A.ANEXOS, secao=C.SECAO,
                           encaminhamentos=E.da_competencia(comp), retomada=E.retomada(comp),
                           pode_apresentar=U.pode(g.usuario, 'recurso:apresentar'),
                           pode_exportar=U.pode(g.usuario, 'recurso:exportar'),
                           cura=U.pode(g.usuario, 'recurso:curar_comentarios'))


@bp.route('/<codigo>/encaminhamentos')
def encaminhamentos(codigo):
    """O combinado da reunião tem página própria: a apresentação é o documento aprovado, sem acréscimos."""
    comp = _competencia(codigo)
    cura = U.pode(g.usuario, 'recurso:curar_comentarios')
    pessoas = [dict(r) for r in get_db().execute('SELECT login, nome FROM usuarios WHERE ativo=1 ORDER BY nome')]
    return render_template('apresentacao/encaminhamentos.html', comp=comp, cura=cura,
                           encaminhamentos=E.da_competencia(comp), retomada=E.retomada(comp),
                           pessoas=pessoas if cura else [], nomes={p['login']: p['nome'] or p['login'] for p in pessoas},
                           atos=dict([(0, '—')] + [(a['n'], '%d · %s' % (a['n'], a['t'])) for a in A.ATOS]),
                           situacao={'aberto': 'Em aberto', 'feito': 'Feito — falta confirmar',
                                     'confirmado': 'Confirmado', 'cancelado': 'Cancelado'})


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
        return redirect(url_for('apresentacao.encaminhamentos', codigo=codigo))
    auditoria.registrar('encaminhamento.criar', '%s · %s' % (codigo, request.form.get('responsavel') or ''))
    flash('Encaminhamento registrado.', 'ok')
    return redirect(url_for('apresentacao.encaminhamentos', codigo=codigo))


@bp.route('/encaminhamentos/<int:eid>/feito', methods=['POST'])
def feito(eid):
    if g.get('ver_como'):
        abort(403)
    e = E.obter(eid) or abort(404)
    try:
        E.marcar_feito(eid, g.usuario['login'], request.form.get('resposta', ''))
    except ValueError as erro:
        flash(str(erro), 'erro')
        return redirect(url_for('apresentacao.encaminhamentos', codigo=e['competencia']))
    auditoria.registrar('encaminhamento.feito', str(eid))
    flash('Marcado como feito. A Controladoria confirma.', 'ok')
    return redirect(url_for('apresentacao.encaminhamentos', codigo=e['competencia']))


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
        return redirect(url_for('apresentacao.encaminhamentos', codigo=e['competencia']))
    auditoria.registrar('encaminhamento.' + acao, str(eid))
    return redirect(url_for('apresentacao.encaminhamentos', codigo=e['competencia']))

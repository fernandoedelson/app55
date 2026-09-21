# -*- coding: utf-8 -*-
"""A apresentação do mês: a reunião em seis atos, com os encaminhamentos.

    /apresentacao/<comp>                  a versão em Atos IDÊNTICA ao HTML aprovado (quem vê tudo)
                                          ou o roteiro filtrado pelo perfil (quem vê parte)
    /apresentacao/<comp>/baixar           o mesmo HTML para levar (recurso exportar)
    /apresentacao/<comp>/encaminhamentos  o combinado: criar, marcar feito, confirmar
    /apresentacao/<comp>/pilotar          a Controladoria monta os atos e gera a apresentação

O roteiro é igual para todos: o padrão do código ou o que a Controladoria gerou para o mês. O que
muda é o conteúdo: o servidor manda só os blocos permitidos e o ato que ficou sem nenhum diz
"conteúdo restrito"."""
import io
import json
import os

from flask import (Blueprint, Response, abort, current_app, flash, g, jsonify, redirect, render_template,
                   request, url_for)

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
        # quem enxerga tudo recebe o documento do Kit (mesmo código, mesmos dados), com o roteiro em vigor
        auditoria.registrar('apresentacao.abrir', comp)
        resp = Response(_documento(comp, ao_vivo=True), mimetype='text/html')
        resp.headers['Cache-Control'] = 'private, no-store'
        return resp
    return _filtrada(comp)


def _comentarios_da_reuniao(comp):
    """Bloco → comentários aprovados que a Controladoria marcou para a reunião."""
    nomes = {a['codigo']: a['nome'] for a in M.areas_que_comentam()}
    mapa = {}
    for c in M.aprovados(comp, so_apresentacao=True):
        mapa.setdefault(c['bloco'], []).append({'area': nomes.get(c['area'], c['area']), 'texto': c['texto']})
    return mapa


def _documento(comp, ao_vivo=False):
    """O Kit com o roteiro em vigor (só os atos ligados). Ao vivo, com o painel de encaminhamentos."""
    atos = A.ativos(A.vigente(comp))
    roteiro = {'atos': atos, 'anexos': A.ANEXOS, 'ocultar': A.ocultos_nos_anexos(atos),
               'repetidos': A.repetidos_nos_anexos(atos)}
    extra = _painel_encaminhamentos(comp, atos) if ao_vivo else ''
    return kit_atos.documento(comp, roteiro, _comentarios_da_reuniao(comp), extra)


@bp.route('/<codigo>/baixar')
def baixar(codigo):
    """O HTML para levar: só com o recurso exportar, e só para quem pode ver os dados inteiros."""
    comp = _competencia(codigo)
    if not (U.pode(g.usuario, 'recurso:exportar') and kit_atos.pode_ver_inteiro(g.usuario)):
        abort(403)
    auditoria.registrar('apresentacao.baixar', comp)
    resp = Response(_documento(comp), mimetype='text/html')
    resp.headers['Content-Disposition'] = 'attachment; filename="Analise_Vendas_e_DRE_55Design_Atos_%s.html"' % comp
    resp.headers['Cache-Control'] = 'private, no-store'
    return resp


def _filtrada(comp):
    """Perfil que vê só parte do relatório: o roteiro montado apenas com os blocos dele. O
    documento do Kit não serve aqui — ele carrega os dados do mês inteiros."""
    pode = lambda bid: U.pode(g.usuario, 'bloco:' + bid)
    roteiro = A.roteiro(pode, A.vigente(comp))           # roteiro() já deixa de fora o ato desligado
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
                           pessoas=[dict(p, rotulo=E.rotulo(p)) for p in E.pessoas()] if cura else [],
                           nomes={p['login']: E.rotulo(p) for p in E.pessoas()},
                           atos=dict([(0, '—')] + [(a['n'], '%d · %s' % (a['n'], a['t'])) for a in A.ativos(A.vigente(comp))]),
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
    if request.form.get('volta') == 'pendencias':
        return redirect(url_for('comentarios.index') + '#encaminhamentos')
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


# ------------------------------------------------------------------ pilotar a apresentação
def _pode_pilotar():
    real = g.get('usuario_real') or g.usuario
    return bool(real) and (real['admin'] or U.pode(g.usuario, 'recurso:curar_comentarios'))


def _resumo_comentarios(comp):
    """Por bloco: o que as áreas já escreveram e o que foi pedido — a coluna de comentários da página."""
    nomes = {a['codigo']: a['nome'] for a in M.areas_que_comentam()}
    mapa = {}
    for c in M.da_todas(comp):
        r = mapa.setdefault(c['bloco'], {'aprovados': [], 'enviados': 0, 'rascunhos': 0, 'recusados': 0, 'pedidos': []})
        if c['status'] == 'aprovado':
            r['aprovados'].append({'area': c['area'], 'nome': nomes.get(c['area'], c['area']), 'texto': c['texto'],
                                   'na_apresentacao': bool(c['na_apresentacao'])})
        elif c['status'] == 'enviado':
            r['enviados'] += 1
        elif c['status'] == 'recusado':
            r['recusados'] += 1
        else:
            r['rascunhos'] += 1
    for p in M.pedidos(comp):
        r = mapa.setdefault(p['bloco'], {'aprovados': [], 'enviados': 0, 'rascunhos': 0, 'recusados': 0, 'pedidos': []})
        r['pedidos'].append({'area': p['area'], 'nome': nomes.get(p['area'], p['area']), 'observacao': p['observacao']})
    return mapa


@bp.route('/pilotar')
def pilotar_ir():
    """O formulário do painel de administração escolhe a competência."""
    return redirect(url_for('apresentacao.pilotar', codigo=_competencia(request.args.get('comp'))))


@bp.route('/<codigo>/pilotar')
def pilotar(codigo):
    """A Controladoria monta a reunião: o que entra em cada ato, a ordem, os textos — e gera."""
    if not _pode_pilotar():
        abort(403)
    comp = _competencia(codigo)
    atos = A.rascunho(comp)
    areas = M.areas_que_comentam()
    quem_ve = {}
    for a in areas:
        for b in M.blocos_da_area(a['codigo']):
            quem_ve.setdefault(b['id'], []).append(a['codigo'])
    secoes = [{'id': s['id'], 'titulo': s['titulo'], 'grupo': s['grupo'],
               'blocos': [{'id': b['id'], 'titulo': b['titulo']} for b in C.BLOCOS
                          if b['secao'] == s['id'] and not b['id'].endswith('.abertura')],
               'filtro_interno': A.FILTROS_INTERNOS.get(s['id'], '')} for s in C.SECOES]
    dados = {'comp': comp, 'atos': atos, 'secoes': secoes, 'padrao': A.padrao(),
             'equivalentes': A.EQUIVALENTES, 'areas': areas, 'quem_ve': quem_ve,
             'comentarios': _resumo_comentarios(comp),
             'url_salvar': url_for('apresentacao.pilotar_salvar', codigo=comp),
             'url_cmt': url_for('comentarios.api_detalhe', codigo=comp, bloco='X')[:-2],
             'url_biblioteca': url_for('biblioteca.secao', secao='X')[:-2]}
    return render_template('apresentacao/pilotar.html', comp=comp, estado=A.estado(comp),
                           anexos=A.sobras_dos_anexos(A.rascunho(comp)),
                           competencias=list(reversed(comp_mod.disponiveis(current_app.config))),
                           dados=json.dumps(dados, ensure_ascii=False).replace('</', '<\\/'))


@bp.route('/<codigo>/pilotar', methods=['POST'])
def pilotar_salvar(codigo):
    """salvar (rascunho) · gerar (vira a apresentação) · descartar (volta ao gerado) · padrao (roteiro do Kit)."""
    if not _pode_pilotar():
        abort(403)
    if g.get('ver_como'):
        abort(403)
    comp = _competencia(codigo)
    f = request.get_json(silent=True) or {}
    acao, login = f.get('acao'), g.usuario['login']
    try:
        if acao in ('salvar', 'gerar'):
            if f.get('atos') is not None:
                A.salvar_rascunho(comp, f['atos'], login)
            if acao == 'gerar':
                A.gerar(comp, login)
                _documento(comp)                 # monta já: erro aparece aqui, e não na reunião
        elif acao == 'descartar':
            A.descartar_rascunho(comp, login)
        elif acao == 'padrao':
            A.salvar_rascunho(comp, A.padrao(), login)
        else:
            return jsonify({'erro': 'ação inválida.'}), 400
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    auditoria.registrar('apresentacao.' + acao, comp)
    return jsonify({'ok': True, 'atos': A.rascunho(comp), 'estado': A.estado(comp),
                    'anexos': A.sobras_dos_anexos(A.rascunho(comp))})


# ------------------------------------------------------------------ encaminhamentos durante a reunião
ENC_JS = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'apresentacao', 'enc_reuniao.js')
SITUACAO_ENC = {'aberto': 'Em aberto', 'feito': 'Feito — falta confirmar', 'confirmado': 'Confirmado',
                'cancelado': 'Cancelado'}


def _enc_lista(comp):
    """Os encaminhamentos do mês e a retomada, com o que este usuário pode fazer em cada um."""
    cura = U.pode(g.usuario, 'recurso:curar_comentarios') and not g.get('ver_como')
    login = (g.usuario or {}).get('login', '').lower()
    nomes = {p['login'].lower(): E.rotulo(p) for p in E.pessoas()}
    titulos = {a['n']: a['t'] for a in A.ativos(A.vigente(comp))}

    def um(e):
        return {'id': e['id'], 'competencia': e['competencia'], 'texto': e['texto'], 'resposta': e['resposta'],
                'responsavel': nomes.get((e['responsavel'] or '').lower(), e['responsavel']),
                'prazo': e['prazo'], 'atrasado': E.atrasado(e), 'status': e['status'],
                'situacao': SITUACAO_ENC.get(e['status'], e['status']),
                'ato': ('Ato %d · %s' % (e['ato'], titulos[e['ato']])) if e['ato'] in titulos else '',
                'bloco': C.BLOCO[e['bloco']]['titulo'] if e['bloco'] in C.BLOCO else '',
                'pode_feito': e['status'] == 'aberto' and (e['responsavel'] or '').lower() == login
                              and not g.get('ver_como'),
                'pode_curar': cura and e['status'] in ('aberto', 'feito')}
    return {'itens': [um(e) for e in E.da_competencia(comp) if e['status'] != 'cancelado'],
            'retomada': [um(e) for e in E.retomada(comp)]}


def _painel_encaminhamentos(comp, atos):
    from ..seguranca.web import csrf_token
    cura = U.pode(g.usuario, 'recurso:curar_comentarios') and not g.get('ver_como')
    cfg = {'api': url_for('apresentacao.enc_api', codigo=comp), 'csrf': csrf_token(), 'cura': cura, 'comp': comp,
           'pessoas': [{'login': p['login'], 'rotulo': E.rotulo(p)} for p in E.pessoas()] if cura else [],
           'atos': [{'n': a['n'], 't': a['t']} for a in atos], 'lista': _enc_lista(comp)}
    js = io.open(ENC_JS, encoding='utf-8').read()
    return ('<script>window.ENC_55=%s;</script><script>%s</script>'
            % (json.dumps(cfg, ensure_ascii=False).replace('</', '<\/'), js))


@bp.route('/<codigo>/encaminhamentos/api')
def enc_api(codigo):
    return jsonify(_enc_lista(_competencia(codigo)))


@bp.route('/<codigo>/encaminhamentos/api', methods=['POST'])
def enc_api_acao(codigo):
    """criar (Controladoria) · feito (o responsável) · confirmar, reabrir, cancelar (Controladoria)."""
    comp = _competencia(codigo)
    if g.get('ver_como'):
        return jsonify({'erro': 'no modo "ver como perfil" os encaminhamentos são só leitura.'}), 403
    f = request.get_json(silent=True) or {}
    acao, login = f.get('acao'), g.usuario['login']
    cura = U.pode(g.usuario, 'recurso:curar_comentarios')
    try:
        if acao == 'criar':
            if not cura:
                abort(403)
            bloco = f.get('bloco') if f.get('bloco') in C.BLOCO else ''
            E.criar(comp, f.get('texto'), f.get('responsavel'), f.get('prazo'), login,
                    ato=int(f.get('ato') or 0), bloco=bloco)
        elif acao == 'feito':
            E.marcar_feito(int(f.get('id') or 0), login, f.get('resposta', ''))
        elif acao in ('confirmar', 'reabrir', 'cancelar'):
            if not cura:
                abort(403)
            eid = int(f.get('id') or 0)
            if acao == 'cancelar':
                E.cancelar(eid, login)
            else:
                E.confirmar(eid, login, confirma=acao == 'confirmar')
        else:
            return jsonify({'erro': 'ação inválida.'}), 400
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    auditoria.registrar('encaminhamento.' + acao, comp)
    return jsonify(_enc_lista(comp))

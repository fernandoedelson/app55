# -*- coding: utf-8 -*-
"""Comentários das áreas: escrever, consolidar e enviar; e a curadoria da Controladoria.

Quem escreve precisa de `recurso:comentar` (e só pelas áreas que são seus perfis); quem envia,
de `recurso:consolidar`; a curadoria, de `recurso:curar_comentarios`."""
from flask import Blueprint, abort, flash, g, jsonify, redirect, render_template, request, url_for

from .. import auditoria
from .. import catalogo as C
from .. import comentarios as M
from ..seguranca import usuarios as U

bp = Blueprint('comentarios', __name__, url_prefix='/comentarios')


def _admin_testando():
    """O administrador no "ver como" de uma área: escreve como a área e pode fazer o resto do ciclo."""
    return bool(g.get('ver_como')) and bool((g.get('usuario_real') or {}).get('admin'))


def _cura():
    # no "ver como" vale o perfil que se está vendo: como Fábrica não se cura; como Controladoria, sim
    return U.pode(g.usuario, 'recurso:curar_comentarios')


def _pode_pedir():
    """Solicitar informação: quem cura e qualquer pessoa de área."""
    return _cura() or U.pode(g.usuario, 'recurso:comentar') or _admin_testando()


def _pode_enviar():
    return U.pode(g.usuario, 'recurso:consolidar') or _admin_testando()


@bp.before_request
def _exigir():
    if request.endpoint == 'comentarios.api_detalhe':
        return      # ler o que foi aprovado é de quem vê o gráfico — a rota confere o bloco
    if not (U.pode(g.usuario, 'recurso:comentar') or _cura() or _admin_testando()):
        abort(403)
    if g.get('ver_como') and request.method == 'POST' and request.endpoint != 'comentarios.api_acao':
        abort(403)


def _area_pedida(codigo_area):
    """A área tem de ser um perfil do próprio usuário — ninguém comenta em nome de outra."""
    minhas = {a['codigo'] for a in M.areas_do_usuario(g.usuario)}
    if codigo_area not in minhas:
        abort(403)
    return codigo_area


def _competencia(codigo=None):
    return codigo or M.competencia_aberta()


def no_grafico(codigo, bloco):
    """O endereço do comentário é o próprio gráfico: a seção do relatório com o painel aberto."""
    return url_for('biblioteca.secao', secao=C.BLOCO[bloco]['secao'], comp=codigo, comentar=bloco)


@bp.route('/')
def index():
    """Pendências: só o que pede ação de quem abriu. Escrever é no gráfico, não aqui."""
    codigo = _competencia(request.args.get('comp'))
    from ..apresentacao import encaminhamentos as E
    meus_enc = [dict(e, atrasado=E.atrasado(e)) for e in E.meus(g.usuario['login'])]
    if not codigo:
        return render_template('comentarios/pendencias.html', codigo=None, p=None, painel=None, cura=_cura(),
                               tem_area=bool(M.areas_do_usuario(g.usuario)), meus_enc=meus_enc)
    aberto, motivo = M.prazo_aberto(codigo)
    comp = M._comp(codigo) or {}
    return render_template('comentarios/pendencias.html', codigo=codigo, p=M.pendencias(codigo, g.usuario),
                           aberto=aberto, motivo=motivo, prazo=comp.get('prazo_comentarios'), cura=_cura(),
                           painel=M.painel(codigo) if _cura() else None, titulo=C.BLOCO,
                           tem_area=bool(M.areas_do_usuario(g.usuario)), no_grafico=no_grafico,
                           pode_pedir=_pode_pedir(),
                           solicitacoes=[s for s in M.solicitacoes(codigo)
                                         if _cura() or s['pedido_por'] == g.usuario['login']],
                           areas=[a for a in M.areas_que_comentam()
                                  if a['codigo'] not in {x['codigo'] for x in M.areas_do_usuario(g.usuario)}],
                           grupos_blocos=_blocos_por_secao() if _pode_pedir() else [], meus_enc=meus_enc)


def _blocos_por_secao():
    """Os blocos para o seletor da solicitação, agrupados pela seção, com o nome que a área reconhece."""
    saida = []
    for s in C.SECOES:
        bl = [(b['id'], M.titulo_legivel(b['id'])) for b in C.blocos_da_secao(s['id']) if not b.get('so_apresentacao')]
        if bl:
            saida.append((s['titulo'], bl))
    return saida


@bp.route('/<codigo>/<area>/<bloco>', methods=['GET', 'POST'])
def bloco(codigo, area, bloco):
    """Endereço antigo: hoje o comentário se escreve no gráfico. O POST continua valendo."""
    if bloco not in C.BLOCO:
        abort(404)
    _area_pedida(area)
    if request.method == 'POST':
        try:
            M.escrever(codigo, bloco, area, request.form.get('texto'), g.usuario['login'])
        except ValueError as e:
            flash(str(e), 'erro')
            return redirect(no_grafico(codigo, bloco))
        auditoria.registrar('comentario.escrever', '%s · %s · %s' % (codigo, area, bloco))
        flash('Comentário guardado. O responsável da área envia quando estiver pronto.', 'ok')
    return redirect(no_grafico(codigo, bloco))


@bp.route('/<codigo>/<area>/<bloco>/enviar', methods=['POST'])
def enviar(codigo, area, bloco):
    _area_pedida(area)
    if not U.pode(g.usuario, 'recurso:consolidar'):
        abort(403)
    try:
        M.enviar(codigo, bloco, area, g.usuario['login'])
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(no_grafico(codigo, bloco))
    auditoria.registrar('comentario.enviar', '%s · %s · %s' % (codigo, area, bloco))
    flash('Comentário enviado à Controladoria.', 'ok')
    return redirect(url_for('comentarios.index', comp=codigo))


@bp.route('/<codigo>/curadoria')
def curadoria(codigo):
    """A curadoria agora é feita no próprio gráfico; a lista do que falta curar está nas Pendências."""
    if not _cura():
        abort(403)
    return redirect(url_for('comentarios.index', comp=codigo))


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
    if not _pode_pedir():
        abort(403)
    area, bloco = request.form.get('area', ''), request.form.get('bloco', '')
    try:
        M.pedir(codigo, bloco, area, g.usuario['login'], request.form.get('observacao', ''),
                M.origem_do_pedido(g.usuario, area))
    except ValueError as e:
        flash(str(e), 'erro')
        return redirect(url_for('comentarios.index', comp=codigo) + '#solicitar')
    auditoria.registrar('comentario.pedir', '%s · %s · %s' % (codigo, area, bloco))
    flash('Solicitação enviada: a área vê a pendência na tela dela e o botão no gráfico.', 'ok')
    return redirect(url_for('comentarios.index', comp=codigo) + '#solicitar')


@bp.route('/<codigo>/curadoria/pedir/cancelar', methods=['POST'])
def cancelar_pedido(codigo):
    area, bloco = request.form.get('area', ''), request.form.get('bloco', '')
    meu = any(p['pedido_por'] == g.usuario['login'] for p in M.pedidos(codigo, area) if p['bloco'] == bloco)
    if not (_cura() or meu):
        abort(403)
    M.cancelar_pedido(codigo, bloco, area)
    auditoria.registrar('comentario.pedido_cancelado', '%s · %s · %s' % (codigo, area, bloco))
    flash('Solicitação cancelada.', 'ok')
    return redirect(url_for('comentarios.index', comp=codigo) + '#solicitar')


# ------------------------------------------------------------------ painel lateral (em cima do gráfico)
@bp.route('/api/<codigo>/<bloco>')
def api_detalhe(codigo, bloco):
    if bloco not in C.BLOCO or not U.pode(g.usuario, 'bloco:' + bloco):
        abort(404)
    return jsonify(M.detalhe(codigo, bloco, g.usuario))


MENSAGENS = {'escrever': 'Rascunho guardado. Só a sua área vê.', 'enviar': 'Enviado à Controladoria.',
             'aprovar': 'Aprovado — já aparece para quem vê este gráfico.', 'recusar': 'Devolvido à área com o motivo.',
             'devolver': 'Devolvido à área para reescrever.', 'apresentacao': 'Apresentação atualizada.',
             'pedir': 'Pedido registrado: a área verá a pendência.'}


@bp.route('/api/<codigo>/<bloco>', methods=['POST'])
def api_acao(codigo, bloco):
    """Uma ação no comentário de um bloco. Devolve o painel atualizado ou {erro} com status 400."""
    if bloco not in C.BLOCO or not U.pode(g.usuario, 'bloco:' + bloco):
        abort(404)
    f = request.get_json(silent=True) or request.form
    acao, area = f.get('acao', ''), f.get('area', '')
    login = g.usuario['login']
    try:
        if acao in ('escrever', 'enviar'):
            _area_pedida(area)
            if acao == 'escrever':
                M.escrever(codigo, bloco, area, f.get('texto'), login)
            else:
                if not _pode_enviar():
                    abort(403)
                if f.get('texto'):
                    # "enviar" com o texto da tela: guarda antes, para não mandar uma versão velha
                    atual = M.obter(codigo, bloco, area)
                    if not atual or atual['texto'] != f.get('texto', '').strip():
                        M.escrever(codigo, bloco, area, f.get('texto'), login)
                M.enviar(codigo, bloco, area, login)
        elif acao == 'pedir':
            if not _pode_pedir():
                abort(403)
            M.pedir(codigo, bloco, area, login, f.get('observacao', ''), M.origem_do_pedido(g.usuario, area))
        elif acao in ('aprovar', 'recusar', 'devolver', 'apresentacao'):
            if not _cura():
                abort(403)
            if acao == 'apresentacao':
                M.marcar_apresentacao(codigo, bloco, area, bool(f.get('entra')))
            else:
                entra = f.get('na_apresentacao')
                M.decidir(codigo, bloco, area, acao, login, texto=f.get('texto'), motivo=f.get('motivo', ''),
                          na_apresentacao=bool(entra) if acao == 'aprovar' and entra is not None else None)
        else:
            return jsonify({'erro': 'ação inválida.'}), 400
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    auditoria.registrar('comentario.' + acao, '%s · %s · %s' % (codigo, area, bloco))
    return jsonify(dict(M.detalhe(codigo, bloco, g.usuario), mensagem=MENSAGENS.get(acao, 'Feito.')))

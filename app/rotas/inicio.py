# -*- coding: utf-8 -*-
"""Página inicial: a porta de entrada — a reunião do mês, o relatório por seção e, para quem tem
o recurso, o fechamento e os comentários. Só aparece o que o perfil pode abrir."""
from flask import Blueprint, current_app, g, render_template

from .. import catalogo as C
from .. import comentarios as M
from ..calculo import competencia as comp_mod
from ..seguranca import usuarios as U

bp = Blueprint('inicio', __name__)


@bp.route('/')
def index():
    visiveis = U.blocos_visiveis(g.usuario)
    por_secao = {}
    for b in visiveis:
        por_secao.setdefault(b['secao'], []).append(b)
    # agrupadas como no relatório (Comercial, Resultado, ...), na ordem do catálogo; blocos que só
    # existem na reunião não contam aqui, porque a página da seção não os mostra
    grupos = []
    for s in C.SECOES:
        meus = [b for b in por_secao.get(s['id'], []) if not b.get('so_apresentacao')]
        if not meus:
            continue
        if not grupos or grupos[-1][0] != s['grupo']:
            grupos.append((s['grupo'], []))
        total = len([b for b in C.blocos_da_secao(s['id']) if not b.get('so_apresentacao')])
        grupos[-1][1].append((s, len(meus), total))
    comps = comp_mod.disponiveis(current_app.config)
    pode = lambda r: U.pode(g.usuario, 'recurso:' + r)
    return render_template('inicio.html', grupos=grupos, comp=comps[-1] if comps else None, pergunta=C.PERGUNTA_SECAO,
                           aberta=M.competencia_aberta(),
                           pode_fechamento=pode('fechamento'),
                           pode_comentar=pode('comentar') or pode('curar_comentarios'),
                           pode_pilotar=pode('pilotar') and not g.get('ver_como'))


@bp.route('/saude')
def saude():
    return {'ok': True}


# ------------------------------------------------------------------ como usar
# Cada capítulo aparece para quem tem ALGUMA das permissões listadas (None = todo mundo). O guia
# é montado pelas permissões, e não pelo nome do perfil: um perfil novo criado na administração
# já recebe o guia certo.
CAPITULOS = [
    ('primeiros-passos', 'Primeiros passos', None),
    ('relatorio', 'Ler o relatório', None),
    ('reuniao', 'A reunião do mês', None),
    ('comentar', 'Comentar um gráfico pela sua área', ['recurso:comentar']),
    ('enviar', 'Enviar o comentário à Controladoria', ['recurso:consolidar']),
    ('solicitar', 'Pedir e responder informação', ['recurso:comentar', 'recurso:curar_comentarios']),
    ('encaminhamentos', 'Seus encaminhamentos', None),
    ('curadoria', 'Curar os comentários das áreas', ['recurso:curar_comentarios']),
    ('conduzir', 'Registrar encaminhamentos na reunião', ['recurso:curar_comentarios']),
    ('pilotar', 'Montar a reunião (pilotar)', ['recurso:pilotar']),
    ('fechamento', 'Fechar o mês', ['recurso:fechamento']),
    ('admin', 'Administração', ['admin']),
]


def _guia_de(ctx):
    tem = lambda p: ctx['admin'] or (p == 'admin' and ctx['admin']) or p in ctx['permissoes']
    return [(cid, tit) for cid, tit, para in CAPITULOS if para is None or any(tem(p) for p in para)]


@bp.route('/como-usar')
def como_usar():
    """O guia de uso de quem está logado — só os capítulos do que o perfil faz. O administrador
    pode abrir o guia de qualquer perfil para conferir o que a área vai ler."""
    from flask import request
    from ..db import get_db
    ctx, perfil = g.usuario, None
    real = g.get('usuario_real') or g.usuario
    perfis = []
    if real['admin']:
        perfis = [dict(r) for r in get_db().execute('SELECT id, codigo, nome FROM perfis ORDER BY nome')]
        escolhido = request.args.get('perfil')
        perfil = next((p for p in perfis if p['codigo'] == escolhido), None)
        if perfil:
            perms = U.permissoes_de_perfis([perfil['id']])
            ctx = dict(g.usuario, permissoes=perms, admin=C.PERMISSAO_ADMIN in perms,
                       perfis=[perfil])
    pode = lambda p: ctx['admin'] or p in ctx['permissoes']
    visiveis = [b for b in C.BLOCOS if pode('bloco:' + b['id'])]
    secoes = [s for s in C.SECOES if any(b['secao'] == s['id'] for b in visiveis)]
    return render_template('ajuda/guia.html', capitulos=_guia_de(ctx), ctx=ctx, pode_g=pode,
                           secoes=secoes, perfis=perfis, perfil=perfil,
                           areas=', '.join(p['nome'] for p in ctx['perfis']) or 'sem perfil')

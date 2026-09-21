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
                           pode_pilotar=pode('curar_comentarios') and not g.get('ver_como'))


@bp.route('/saude')
def saude():
    return {'ok': True}

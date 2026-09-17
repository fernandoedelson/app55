# -*- coding: utf-8 -*-
"""Administração: usuários, perfis e permissões, ver como perfil e auditoria."""
import re
import unicodedata

from flask import Blueprint, abort, flash, g, redirect, render_template, request, session, url_for

from .. import catalogo as C
from ..auditoria import registrar
from ..db import agora, get_db
from ..seguranca import email as E
from ..seguranca import senha as S
from ..seguranca import usuarios as U

bp = Blueprint('admin', __name__)


@bp.before_request
def _so_admin():
    # sair do "ver como" é a única rota de admin acessível enquanto o modo está ligado
    if request.endpoint == 'admin.ver_como_sair':
        if not (g.get('usuario_real') and g.usuario_real['admin']):
            abort(403)
        return None
    if not U.pode(g.usuario, C.PERMISSAO_ADMIN):
        abort(403)
    return None


def _slug(nome):
    s = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '_', s).strip('_')[:40] or 'perfil'


def _perfis():
    return get_db().execute('SELECT p.*, (SELECT COUNT(*) FROM usuario_perfis up WHERE up.perfil_id=p.id) AS n_usuarios, '
                            "(SELECT COUNT(*) FROM perfil_permissoes pp WHERE pp.perfil_id=p.id AND pp.recurso LIKE 'bloco:%') AS n_blocos, "
                            "EXISTS(SELECT 1 FROM perfil_permissoes pp WHERE pp.perfil_id=p.id AND pp.recurso='admin') AS eh_admin "
                            'FROM perfis p ORDER BY p.sistema DESC, p.nome').fetchall()


def _entregar_provisoria(u, senha):
    """E-mail com a senha provisória; sem e-mail possível, ela aparece UMA vez para o administrador."""
    ok = E.enviar(u['email'], 'Seu acesso · +55 Design',
                  'Olá, %s.\n\nSeu usuário é "%s" e sua senha provisória é: %s\n\nNo primeiro acesso você vai criar '
                  'uma senha pessoal.' % (u['nome'] or u['login'], u['login'], senha)) if u['email'] else False
    if ok:
        flash('Senha provisória enviada por e-mail para %s.' % u['email'], 'success')
    else:
        flash('Senha provisória de %s: %s — anote e entregue à pessoa; ela não será mostrada de novo.'
              % (u['login'], senha), 'warning')
    return ok


# ------------------------------------------------------------------ painel
@bp.route('/')
def painel():
    db = get_db()
    n = {'usuarios': db.execute('SELECT COUNT(*) FROM usuarios WHERE ativo=1').fetchone()[0],
         'perfis': db.execute('SELECT COUNT(*) FROM perfis').fetchone()[0],
         'blocos': len(C.BLOCOS), 'secoes': len(C.SECOES)}
    return render_template('admin/painel.html', n=n, perfis=_perfis())


# ------------------------------------------------------------------ usuários
@bp.route('/usuarios')
def usuarios():
    db = get_db()
    lista = db.execute('SELECT * FROM usuarios ORDER BY ativo DESC, login').fetchall()
    perfis_de = {}
    for r in db.execute('SELECT up.usuario_id, p.nome FROM usuario_perfis up JOIN perfis p ON p.id=up.perfil_id ORDER BY p.nome'):
        perfis_de.setdefault(r['usuario_id'], []).append(r['nome'])
    return render_template('admin/usuarios.html', usuarios=lista, perfis_de=perfis_de, bloqueado=U.bloqueado)


def _salvar_perfis_usuario(uid, ids):
    db = get_db()
    validos = {r['id'] for r in db.execute('SELECT id FROM perfis')}
    ids = [i for i in ids if i in validos]
    db.execute('DELETE FROM usuario_perfis WHERE usuario_id=?', (uid,))
    db.executemany('INSERT INTO usuario_perfis (usuario_id, perfil_id, concedido_por, concedido_em) VALUES (?,?,?,?)',
                   [(uid, i, g.usuario['id'], agora()) for i in ids])
    return ids


@bp.route('/usuarios/novo', methods=['GET', 'POST'])
def usuario_novo():
    db = get_db()
    if request.method == 'POST':
        login = (request.form.get('login') or '').strip()
        nome = (request.form.get('nome') or '').strip()[:120]
        email = (request.form.get('email') or '').strip().lower()[:254]
        ids = [int(x) for x in request.form.getlist('perfis') if x.isdigit()]
        erro = None
        if not re.fullmatch(r'[A-Za-z0-9._-]{3,64}', login):
            erro = 'Login: de 3 a 64 caracteres (letras, números, ponto, hífen ou sublinhado).'
        elif U.por_login(login):
            erro = 'Já existe um usuário com esse login.'
        elif not E.valido(email):
            erro = 'Informe um e-mail válido — é por ele que a pessoa recupera a senha.'
        elif not ids:
            erro = 'Escolha ao menos um perfil.'
        if erro:
            flash(erro, 'error')
        else:
            prov = S.gerar_provisoria()
            uid = db.execute('INSERT INTO usuarios (login, nome, email, senha_hash, trocar_senha, criado_em) '
                             'VALUES (?,?,?,?,1,?)', (login, nome, email, S.gerar_hash(prov), agora())).lastrowid
            ids = _salvar_perfis_usuario(uid, ids)
            db.commit()
            registrar('usuario_criado', {'login': login, 'perfis': ids})
            _entregar_provisoria(U.por_id(uid), prov)
            return redirect(url_for('admin.usuarios'))
    return render_template('admin/usuario_form.html', u=None, perfis=_perfis(), marcados=set())


@bp.route('/usuarios/<int:uid>', methods=['GET', 'POST'])
def usuario_editar(uid):
    db = get_db()
    u = U.por_id(uid) or abort(404)
    marcados = {p['id'] for p in U.perfis_do_usuario(uid)}
    if request.method == 'POST':
        nome = (request.form.get('nome') or '').strip()[:120]
        email = (request.form.get('email') or '').strip().lower()[:254]
        ativo = 1 if request.form.get('ativo') else 0
        ids = [int(x) for x in request.form.getlist('perfis') if x.isdigit()]
        if not E.valido(email):
            flash('Informe um e-mail válido.', 'error')
        elif not ids:
            flash('Escolha ao menos um perfil.', 'error')
        else:
            db.execute('SAVEPOINT editar')
            db.execute('UPDATE usuarios SET nome=?, email=?, ativo=? WHERE id=?', (nome, email, ativo, uid))
            if not ativo:
                db.execute('UPDATE usuarios SET versao_sessao=versao_sessao+1 WHERE id=?', (uid,))
            _salvar_perfis_usuario(uid, ids)
            if U.administradores_ativos() == 0:
                db.execute('ROLLBACK TO editar')
                db.execute('RELEASE editar')
                flash('Não é possível: a aplicação ficaria sem nenhum administrador ativo.', 'error')
                return redirect(url_for('admin.usuario_editar', uid=uid))
            db.execute('RELEASE editar')
            db.commit()
            registrar('usuario_editado', {'login': u['login'], 'ativo': ativo, 'perfis': ids,
                                          'perfis_antes': sorted(marcados)})
            flash('Usuário salvo.', 'success')
            return redirect(url_for('admin.usuarios'))
    return render_template('admin/usuario_form.html', u=u, perfis=_perfis(), marcados=marcados,
                           bloqueado=U.bloqueado(u))


@bp.route('/usuarios/<int:uid>/resetar-senha', methods=['POST'])
def usuario_resetar(uid):
    u = U.por_id(uid) or abort(404)
    prov = S.gerar_provisoria()
    U.definir_senha(uid, prov, trocar_no_proximo=True)
    registrar('senha_resetada_admin', {'login': u['login']})
    _entregar_provisoria(U.por_id(uid), prov)
    return redirect(url_for('admin.usuario_editar', uid=uid))


@bp.route('/usuarios/<int:uid>/desbloquear', methods=['POST'])
def usuario_desbloquear(uid):
    u = U.por_id(uid) or abort(404)
    db = get_db()
    db.execute('UPDATE usuarios SET falhas=0, bloqueado_ate=NULL WHERE id=?', (uid,))
    db.commit()
    registrar('usuario_desbloqueado', {'login': u['login']})
    flash('Conta desbloqueada.', 'success')
    return redirect(url_for('admin.usuario_editar', uid=uid))


# ------------------------------------------------------------------ perfis e permissões
@bp.route('/perfis')
def perfis():
    return render_template('admin/perfis.html', perfis=_perfis())


@bp.route('/perfis/novo', methods=['POST'])
def perfil_novo():
    nome = (request.form.get('nome') or '').strip()[:80]
    if len(nome) < 3:
        flash('Dê um nome ao perfil (mínimo 3 letras).', 'error')
        return redirect(url_for('admin.perfis'))
    db = get_db()
    codigo, n = _slug(nome), 1
    while db.execute('SELECT 1 FROM perfis WHERE codigo=?', (codigo,)).fetchone():
        n += 1
        codigo = '%s_%d' % (_slug(nome), n)
    pid = db.execute('INSERT INTO perfis (codigo, nome, descricao, criado_em) VALUES (?,?,?,?)',
                     (codigo, nome, (request.form.get('descricao') or '').strip()[:240], agora())).lastrowid
    db.commit()
    registrar('perfil_criado', {'perfil': codigo})
    flash('Perfil criado sem nenhuma permissão. Marque o que ele pode ver.', 'success')
    return redirect(url_for('admin.perfil_editar', pid=pid))


@bp.route('/perfis/<int:pid>', methods=['GET', 'POST'])
def perfil_editar(pid):
    db = get_db()
    perfil = db.execute('SELECT * FROM perfis WHERE id=?', (pid,)).fetchone() or abort(404)
    atuais = {r['recurso'] for r in db.execute('SELECT recurso FROM perfil_permissoes WHERE perfil_id=?', (pid,))}
    confirmar = None
    if request.method == 'POST':
        pedidos = set(C.limpar_permissoes(request.form.getlist('perm')))
        nome = (request.form.get('nome') or perfil['nome']).strip()[:80]
        descricao = (request.form.get('descricao') or '').strip()[:240]
        final, acrescidos = C.fechar_dependencias(pedidos)
        if acrescidos and request.form.get('confirmado') != '1':
            confirmar = [(C.BLOCO[b], [C.BLOCO[d] for d in deps]) for b, deps in acrescidos.items()]
            atuais = pedidos
        else:
            db.execute('SAVEPOINT perms')
            db.execute('UPDATE perfis SET nome=?, descricao=? WHERE id=?', (nome, descricao, pid))
            db.execute('DELETE FROM perfil_permissoes WHERE perfil_id=?', (pid,))
            db.executemany('INSERT INTO perfil_permissoes (perfil_id, recurso) VALUES (?,?)',
                           [(pid, r) for r in sorted(final)])
            if U.administradores_ativos() == 0:
                db.execute('ROLLBACK TO perms')
                db.execute('RELEASE perms')
                flash('Não é possível tirar "administrador" deste perfil: não sobraria nenhum administrador ativo.', 'error')
                return redirect(url_for('admin.perfil_editar', pid=pid))
            db.execute('RELEASE perms')
            db.commit()
            registrar('permissoes_alteradas', {'perfil': perfil['codigo'],
                                               'concedidas': sorted(final - atuais), 'retiradas': sorted(atuais - final),
                                               'por_dependencia': {k: v for k, v in acrescidos.items()}})
            # quem tem o perfil passa a ver o novo conjunto na próxima requisição (contexto é recalculado)
            flash('Permissões salvas.', 'success')
            return redirect(url_for('admin.perfil_editar', pid=pid))
    secoes = [(s, C.blocos_da_secao(s['id'])) for s in C.SECOES]
    grupos = []
    for s, bl in secoes:
        if not grupos or grupos[-1][0] != s['grupo']:
            grupos.append((s['grupo'], []))
        grupos[-1][1].append((s, bl))
    usuarios = db.execute('SELECT u.login, u.nome FROM usuarios u JOIN usuario_perfis up ON up.usuario_id=u.id '
                          'WHERE up.perfil_id=? ORDER BY u.login', (pid,)).fetchall()
    return render_template('admin/perfil_form.html', perfil=perfil, atuais=atuais, grupos=grupos,
                           recursos=C.RECURSOS, bases=C.BASES_UPLOAD, confirmar=confirmar, usuarios=usuarios)


@bp.route('/perfis/<int:pid>/excluir', methods=['POST'])
def perfil_excluir(pid):
    db = get_db()
    perfil = db.execute('SELECT * FROM perfis WHERE id=?', (pid,)).fetchone() or abort(404)
    if perfil['sistema']:
        flash('Perfil do sistema não pode ser excluído.', 'error')
    elif db.execute('SELECT 1 FROM usuario_perfis WHERE perfil_id=?', (pid,)).fetchone():
        flash('Tire o perfil dos usuários antes de excluir.', 'error')
    else:
        db.execute('DELETE FROM perfis WHERE id=?', (pid,))
        db.commit()
        registrar('perfil_excluido', {'perfil': perfil['codigo']})
        flash('Perfil excluído.', 'success')
    return redirect(url_for('admin.perfis'))


# ------------------------------------------------------------------ ver como perfil
@bp.route('/ver-como', methods=['POST'])
def ver_como():
    pid = request.form.get('perfil_id', '')
    perfil = get_db().execute('SELECT * FROM perfis WHERE id=?', (pid,)).fetchone() if pid.isdigit() else None
    if perfil is None:
        abort(404)
    session['ver_como'] = perfil['id']
    session['ver_como_nome'] = perfil['nome']
    registrar('ver_como_inicio', {'perfil': perfil['codigo']})
    return redirect(url_for('inicio.index'))


@bp.route('/ver-como/sair', methods=['POST'])
def ver_como_sair():
    nome = session.get('ver_como_nome', '')
    registrar('ver_como_fim', {'perfil': nome})
    session.pop('ver_como', None)
    session.pop('ver_como_nome', None)
    return redirect(url_for('admin.painel'))


# ------------------------------------------------------------------ auditoria
@bp.route('/auditoria')
def auditoria():
    login = (request.args.get('login') or '').strip()[:64]
    acao = (request.args.get('acao') or '').strip()[:64]
    q, args = 'SELECT * FROM auditoria WHERE 1=1', []
    if login:
        q += ' AND login=?'
        args.append(login)
    if acao:
        q += ' AND acao=?'
        args.append(acao)
    q += ' ORDER BY id DESC LIMIT 300'
    db = get_db()
    linhas = db.execute(q, args).fetchall()
    acoes = [r['acao'] for r in db.execute('SELECT DISTINCT acao FROM auditoria ORDER BY acao')]
    return render_template('admin/auditoria.html', linhas=linhas, acoes=acoes, login=login, acao=acao)

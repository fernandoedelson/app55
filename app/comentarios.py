# -*- coding: utf-8 -*-
"""Comentário da área: o que cada área escreve sobre um bloco do mês disponibilizado.

Regras que vêm da especificação e vivem aqui:
- qualquer pessoa da área escreve; quem tem `recurso:consolidar` envia à Controladoria;
- cada área só vê os seus comentários — até a Controladoria aprovar, quando passam a valer para
  todos que enxergam o bloco;
- a Controladoria pode pedir comentário num bloco, aprovar (ajustando o texto, e então o autor é
  avisado e o texto da área fica guardado), ou recusar com motivo, e escolhe o que vai à apresentação;
- só se comenta bloco que a área enxerga, em competência disponibilizada e dentro do prazo — o
  prazo é definido pela Controladoria a cada mês;
- nada é apagado: cada passo entra no histórico do comentário e na auditoria.
"""
from datetime import date, datetime

from flask import current_app, g

from . import catalogo as C
from .db import agora, get_db
from .seguranca import usuarios as U

STATUS = ('rascunho', 'enviado', 'aprovado', 'recusado')


def areas_que_comentam():
    """Perfis com `recurso:comentar` — são eles que respondem pelos blocos que enxergam."""
    return [dict(r) for r in get_db().execute(
        "SELECT p.codigo, p.nome FROM perfis p JOIN perfil_permissoes pp ON pp.perfil_id=p.id "
        "WHERE pp.recurso='recurso:comentar' ORDER BY p.nome")]


def areas_do_usuario(ctx):
    """As áreas pelas quais este usuário pode escrever. É perfil a perfil: um administrador não
    comenta "por todos" — ele escolhe uma área, senão o comentário nasceria sem dono."""
    if not ctx:
        return []
    codigos = {p['codigo'] for p in ctx['perfis']}
    return [a for a in areas_que_comentam() if a['codigo'] in codigos]


def blocos_da_area(codigo_area):
    """Os blocos que a área enxerga — comentário só existe onde o perfil já tem o bloco liberado."""
    con = get_db()
    perfil = con.execute('SELECT id FROM perfis WHERE codigo=?', (codigo_area,)).fetchone()
    if not perfil:
        return []
    perms = U.permissoes_de_perfis([perfil['id']])
    if C.PERMISSAO_ADMIN in perms:
        return list(C.BLOCOS)
    return [b for b in C.BLOCOS if 'bloco:' + b['id'] in perms]


def _comp(codigo):
    r = get_db().execute('SELECT * FROM competencias WHERE codigo=?', (codigo,)).fetchone()
    return dict(r) if r else None


def _data_br(texto):
    for formato in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(texto.strip(), formato).date()
        except ValueError:
            pass
    return None


def prazo_aberto(codigo):
    """(aberto, motivo). Fora da janela a área lê, mas não escreve."""
    comp = _comp(codigo)
    if not comp:
        return False, 'competência não encontrada.'
    if comp['status'] != 'disponibilizada':
        return False, ('a competência %s ainda não foi disponibilizada às áreas.' % codigo
                       if comp['status'] == 'rascunho' else 'a competência %s está fechada.' % codigo)
    limite = _data_br(comp['prazo_comentarios'] or '')
    if limite and date.today() > limite:
        return False, 'o prazo dos comentários terminou em %s.' % comp['prazo_comentarios']
    return True, ''


def obter(codigo, bloco, area):
    r = get_db().execute('SELECT * FROM comentarios WHERE competencia=? AND bloco=? AND area=?',
                         (codigo, bloco, area)).fetchone()
    return dict(r) if r else None


def _registrar(cid, acao, texto='', detalhes=''):
    get_db().execute('INSERT INTO comentario_historico (comentario_id, em, quem, acao, texto, detalhes) '
                     'VALUES (?,?,?,?,?,?)',
                     (cid, agora(), (g.get('usuario') or {}).get('login', ''), acao, texto, detalhes))


def historico(cid):
    return [dict(r) for r in get_db().execute(
        'SELECT * FROM comentario_historico WHERE comentario_id=? ORDER BY id', (cid,))]


def escrever(codigo, bloco, area, texto, login):
    """Cria ou atualiza o rascunho da área. Recusado volta a rascunho — é o reenvio."""
    aberto, motivo = prazo_aberto(codigo)
    if not aberto:
        raise ValueError(motivo)
    if bloco not in C.BLOCO:
        raise ValueError('bloco inexistente.')
    if not any(b['id'] == bloco for b in blocos_da_area(area)):
        raise ValueError('a área não enxerga este bloco.')
    texto = (texto or '').strip()
    if not texto:
        raise ValueError('escreva o comentário.')
    if len(texto) > 4000:
        raise ValueError('o comentário passa de 4.000 caracteres.')
    con = get_db()
    atual = obter(codigo, bloco, area)
    if atual and atual['status'] in ('enviado', 'aprovado'):
        raise ValueError('este comentário já foi %s: peça à Controladoria para devolvê-lo.' % atual['status'])
    if atual:
        con.execute("UPDATE comentarios SET texto=?, status='rascunho', motivo='', atualizado_em=? WHERE id=?",
                    (texto, agora(), atual['id']))
        cid = atual['id']
    else:
        cid = con.execute('INSERT INTO comentarios (competencia, bloco, area, texto, status, criado_por, '
                          "criado_em, atualizado_em) VALUES (?,?,?,?,'rascunho',?,?,?)",
                          (codigo, bloco, area, texto, login, agora(), agora())).lastrowid
    _registrar(cid, 'escrever', texto)
    con.commit()
    return cid


def enviar(codigo, bloco, area, login):
    """O responsável da área consolida e envia — a partir daqui a Controladoria vê."""
    aberto, motivo = prazo_aberto(codigo)
    if not aberto:
        raise ValueError(motivo)
    atual = obter(codigo, bloco, area)
    if not atual:
        raise ValueError('não há comentário escrito para enviar.')
    if atual['status'] in ('enviado', 'aprovado'):
        raise ValueError('já enviado.')
    con = get_db()
    con.execute("UPDATE comentarios SET status='enviado', enviado_por=?, enviado_em=?, atualizado_em=? WHERE id=?",
                (login, agora(), agora(), atual['id']))
    _registrar(atual['id'], 'enviar', atual['texto'])
    con.commit()
    return atual['id']


def decidir(codigo, bloco, area, acao, login, texto=None, motivo='', na_apresentacao=None):
    """Controladoria: aprovar (podendo ajustar o texto), recusar com motivo ou devolver para a área."""
    atual = obter(codigo, bloco, area)
    if not atual:
        raise ValueError('comentário não encontrado.')
    if atual['status'] == 'rascunho':
        raise ValueError('a área ainda não enviou este comentário.')
    con = get_db()
    if acao == 'aprovar':
        novo = (texto or '').strip() or atual['texto']
        ajustou = novo != atual['texto']
        # o texto da área nunca se perde: ao ajustar, o original vai para texto_area
        original = atual['texto'] if ajustou else atual['texto_area']
        entra = atual['na_apresentacao'] if na_apresentacao is None else na_apresentacao
        con.execute("UPDATE comentarios SET status='aprovado', texto=?, texto_area=?, motivo='', decidido_por=?, "
                    'decidido_em=?, atualizado_em=?, na_apresentacao=? WHERE id=?',
                    (novo, original, login, agora(), agora(), 1 if entra else 0, atual['id']))
        _registrar(atual['id'], 'ajustar' if ajustou else 'aprovar', novo,
                   'texto ajustado pela Controladoria' if ajustou else '')
        if ajustou:
            _avisar_autor(codigo, bloco, area, atual)
    elif acao == 'recusar':
        motivo = (motivo or '').strip()
        if not motivo:
            raise ValueError('diga por que está recusando — a área precisa saber o que corrigir.')
        con.execute("UPDATE comentarios SET status='recusado', motivo=?, decidido_por=?, decidido_em=?, "
                    'atualizado_em=? WHERE id=?', (motivo, login, agora(), agora(), atual['id']))
        _registrar(atual['id'], 'recusar', atual['texto'], motivo)
    elif acao == 'devolver':
        con.execute("UPDATE comentarios SET status='rascunho', motivo=?, decidido_por=?, decidido_em=?, "
                    'atualizado_em=? WHERE id=?', ((motivo or '').strip(), login, agora(), agora(), atual['id']))
        _registrar(atual['id'], 'devolver', atual['texto'], motivo or '')
    else:
        raise ValueError('ação inválida.')
    con.commit()
    return atual['id']


def marcar_apresentacao(codigo, bloco, area, entra):
    atual = obter(codigo, bloco, area)
    if not atual:
        raise ValueError('comentário não encontrado.')
    if atual['status'] != 'aprovado':
        raise ValueError('só comentário aprovado vai à apresentação.')
    con = get_db()
    con.execute('UPDATE comentarios SET na_apresentacao=?, atualizado_em=? WHERE id=?',
                (1 if entra else 0, agora(), atual['id']))
    _registrar(atual['id'], 'apresentacao', '', 'entra' if entra else 'sai')
    con.commit()


def _avisar_autor(codigo, bloco, area, atual):
    """Ajuste de texto não é silencioso: quem escreveu recebe o aviso (se houver SMTP)."""
    from .seguranca import email as E
    autor = U.por_login(atual['criado_por'] or '')
    if not autor or not autor['email']:
        return
    E.enviar(autor['email'], 'Seu comentário de %s foi ajustado' % codigo,
             'A Controladoria ajustou o texto do comentário da área %s no bloco "%s" da competência %s.\n'
             'Entre na aplicação para ver como ficou.' % (area, C.BLOCO[bloco]['titulo'], codigo))


def pedir(codigo, bloco, area, login, observacao=''):
    """Controladoria pede comentário num bloco: vira pendência no painel da área."""
    if bloco not in C.BLOCO:
        raise ValueError('bloco inexistente.')
    if not any(b['id'] == bloco for b in blocos_da_area(area)):
        raise ValueError('a área não enxerga este bloco.')
    con = get_db()
    con.execute('INSERT OR REPLACE INTO comentario_pedidos (competencia, bloco, area, observacao, pedido_por, '
                'pedido_em) VALUES (?,?,?,?,?,?)', (codigo, bloco, area, (observacao or '').strip(), login, agora()))
    con.commit()


def pedidos(codigo, area=None):
    q = 'SELECT * FROM comentario_pedidos WHERE competencia=?'
    args = [codigo]
    if area:
        q += ' AND area=?'
        args.append(area)
    return [dict(r) for r in get_db().execute(q, args)]


def da_area(codigo, area):
    return [dict(r) for r in get_db().execute(
        'SELECT * FROM comentarios WHERE competencia=? AND area=? ORDER BY bloco', (codigo, area))]


def enviados(codigo):
    """O que a Controladoria tem para curar: tudo que saiu do rascunho."""
    return [dict(r) for r in get_db().execute(
        "SELECT * FROM comentarios WHERE competencia=? AND status<>'rascunho' ORDER BY area, bloco", (codigo,))]


def aprovados(codigo, blocos=None, so_apresentacao=False):
    """Comentários que já valem para todos — filtrados pelos blocos que o leitor enxerga."""
    q = "SELECT * FROM comentarios WHERE competencia=? AND status='aprovado'"
    if so_apresentacao:
        q += ' AND na_apresentacao=1'
    linhas = [dict(r) for r in get_db().execute(q + ' ORDER BY bloco, area', (codigo,))]
    if blocos is not None:
        permitidos = set(blocos)
        linhas = [l for l in linhas if l['bloco'] in permitidos]
    return linhas


def por_bloco(codigo, ctx):
    """Mapa bloco → comentários aprovados que este contexto pode ler (usado pela Biblioteca)."""
    visiveis = {b['id'] for b in U.blocos_visiveis(ctx)}
    mapa = {}
    for c in aprovados(codigo, visiveis):
        mapa.setdefault(c['bloco'], []).append(c)
    return mapa


def painel(codigo):
    """Quem já enviou: uma linha por área, com pedidos pendentes e a contagem por situação."""
    por_area = {}
    for a in areas_que_comentam():
        por_area[a['codigo']] = {'area': a['codigo'], 'nome': a['nome'], 'rascunho': 0, 'enviado': 0,
                                 'aprovado': 0, 'recusado': 0, 'pedidos': 0, 'pendentes': []}
    for c in da_todas(codigo):
        linha = por_area.get(c['area'])
        if linha is not None:
            linha[c['status']] = linha.get(c['status'], 0) + 1
    escritos = {(c['area'], c['bloco']) for c in da_todas(codigo)}
    for p in pedidos(codigo):
        linha = por_area.get(p['area'])
        if linha is None:
            continue
        linha['pedidos'] += 1
        if (p['area'], p['bloco']) not in escritos:
            linha['pendentes'].append(p['bloco'])
    return list(por_area.values())


def da_todas(codigo):
    return [dict(r) for r in get_db().execute(
        'SELECT * FROM comentarios WHERE competencia=? ORDER BY area, bloco', (codigo,))]


def competencia_aberta():
    """A competência que as áreas estão comentando agora (a disponibilizada mais recente)."""
    r = get_db().execute("SELECT codigo FROM competencias WHERE status='disponibilizada' "
                         'ORDER BY codigo DESC LIMIT 1').fetchone()
    return r['codigo'] if r else None


def avisar_areas(codigo):
    """E-mail às pessoas das áreas quando o mês é disponibilizado. Sem SMTP, não faz nada."""
    from .seguranca import email as E
    if not E.configurado():
        return 0
    comp = _comp(codigo) or {}
    prazo = comp.get('prazo_comentarios')
    codigos = [a['codigo'] for a in areas_que_comentam()]
    if not codigos:
        return 0
    marcas = ','.join('?' * len(codigos))
    pessoas = get_db().execute(
        'SELECT DISTINCT u.email, u.nome FROM usuarios u JOIN usuario_perfis up ON up.usuario_id=u.id '
        'JOIN perfis p ON p.id=up.perfil_id WHERE u.ativo=1 AND p.codigo IN (%s)' % marcas, codigos).fetchall()
    n = 0
    for p in pessoas:
        if E.enviar(p['email'], 'Fechamento %s disponível para comentários' % codigo,
                    'O fechamento de %s está disponível na aplicação +55 Design.\n'
                    'Escreva o comentário da sua área nos blocos que interessam%s.\n'
                    % (codigo, (' — o prazo vai até %s' % prazo) if prazo else '')):
            n += 1
    current_app.logger.info('avisei %d pessoas sobre %s', n, codigo)
    return n

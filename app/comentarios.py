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

from flask import current_app, g, has_request_context, session

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
    como = ''
    if has_request_context() and session.get('ver_como'):
        como = str(session.get('ver_como_nome', session.get('ver_como')))[:64]
    get_db().execute('INSERT INTO comentario_historico (comentario_id, em, quem, acao, texto, detalhes, como_perfil) '
                     'VALUES (?,?,?,?,?,?,?)',
                     (cid, agora(), (g.get('usuario') or {}).get('login', ''), acao, texto, detalhes, como))


def historico(cid):
    return [dict(r) for r in get_db().execute(
        'SELECT * FROM comentario_historico WHERE comentario_id=? ORDER BY id', (cid,))]


def escrever(codigo, bloco, area, texto, login):
    """Cria ou atualiza o comentário da área. Até a Controladoria aprovar, a área pode editar:
    rascunho continua rascunho, recusado volta a rascunho (é o reenvio) e enviado continua enviado —
    a Controladoria passa a ver o texto novo, e a troca fica no histórico."""
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
    if atual and atual['status'] == 'aprovado':
        raise ValueError('este comentário já foi aprovado: para mudar, peça à Controladoria para devolvê-lo.')
    if atual and atual['status'] == 'enviado':
        if texto != atual['texto']:
            con.execute('UPDATE comentarios SET texto=?, atualizado_em=? WHERE id=?', (texto, agora(), atual['id']))
            _registrar(atual['id'], 'editar', texto, 'alterado depois de enviado, antes da aprovação')
            con.commit()
        return atual['id']
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


def origem_do_pedido(ctx, alvo=None):
    """Quem está pedindo, como a área que recebe vai ler: a área de quem pede ou a Controladoria."""
    minhas = [a for a in areas_do_usuario(ctx) if a['codigo'] != alvo]
    return minhas[0]['nome'] if minhas else 'Controladoria'


def pedir(codigo, bloco, area, login, observacao='', origem=''):
    """Uma área (ou a Controladoria) pede informação a outra sobre um gráfico: vira pendência dela."""
    if bloco not in C.BLOCO:
        raise ValueError('bloco inexistente.')
    if not any(b['id'] == bloco for b in blocos_da_area(area)):
        raise ValueError('a área não enxerga este bloco.')
    con = get_db()
    if not (observacao or '').strip():
        raise ValueError('escreva o que você quer saber.')
    con.execute('INSERT OR REPLACE INTO comentario_pedidos (competencia, bloco, area, observacao, pedido_por, '
                'pedido_em, origem) VALUES (?,?,?,?,?,?,?)',
                (codigo, bloco, area, (observacao or '').strip(), login, agora(), origem or 'Controladoria'))
    con.commit()
    _avisar_pedido(codigo, bloco, area, observacao)


def _avisar_pedido(codigo, bloco, area, observacao):
    """A área fica sabendo por e-mail (se houver SMTP), além da pendência na tela."""
    from .seguranca import email as E
    if not E.configurado():
        return
    pessoas = get_db().execute(
        'SELECT DISTINCT u.email FROM usuarios u JOIN usuario_perfis up ON up.usuario_id=u.id '
        'JOIN perfis p ON p.id=up.perfil_id WHERE u.ativo=1 AND p.codigo=?', (area,)).fetchall()
    for p in pessoas:
        E.enviar(p['email'], 'Pediram informação sobre %s' % titulo_legivel(bloco),
                 'Competência %s · %s\n\n%s\n\nResponda pelo botão Comentar do gráfico na aplicação.'
                 % (codigo, titulo_legivel(bloco), (observacao or '').strip()))


def solicitacoes(codigo):
    """As solicitações de informação do mês, com a situação de cada uma para quem cura."""
    nomes = _nomes_das_areas()
    saida = []
    for p in pedidos(codigo):
        c = obter(codigo, p['bloco'], p['area'])
        situacao = ('Respondida' if c and c['status'] in ('enviado', 'aprovado')
                    else 'Em resposta (rascunho)' if c else 'Aguardando a área')
        b = C.BLOCO.get(p['bloco'])
        saida.append(dict(p, nome=nomes.get(p['area'], p['area']), situacao=situacao,
                          titulo=titulo_legivel(p['bloco']) if b else p['bloco'],
                          secao_titulo=C.SECAO[b['secao']]['titulo'] if b else ''))
    return sorted(saida, key=lambda x: x['pedido_em'], reverse=True)


def cancelar_pedido(codigo, bloco, area):
    con = get_db()
    con.execute('DELETE FROM comentario_pedidos WHERE competencia=? AND bloco=? AND area=?', (codigo, bloco, area))
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


def _nomes_das_areas():
    return {a['codigo']: a['nome'] for a in areas_que_comentam()}


def camada(codigo, ctx, blocos, so_leitura=False, so_apresentacao=False, escrever=True, ver_como=False):
    """O que a página precisa para pôr o comentário em cada gráfico ou tabela que o leitor enxerga.

    O comentário nasce em cima do dado: quem abre a seção vê, ao lado do título de cada bloco, o
    que a sua área já escreveu (ou o botão para escrever), o que a Controladoria tem para curar e
    o que já foi aprovado. Devolve None quando não há nada a mostrar — a página fica idêntica ao
    relatório aprovado."""
    if not codigo or not ctx:
        return None
    visiveis = {b['id'] for b in U.blocos_visiveis(ctx)}
    blocos = [b for b in blocos if b in visiveis]
    aberto, motivo = prazo_aberto(codigo)
    # no "ver como" vale o perfil visto: a área escreve e envia; curar é de quem cura
    cura = U.pode(ctx, 'recurso:curar_comentarios') and not so_leitura
    # na reunião ninguém escreve: o gráfico só mostra o que foi aprovado e, a quem cura, o que falta
    areas = [] if (so_leitura or not escrever) else areas_do_usuario(ctx)
    for a in areas:
        a['blocos'] = sorted({b['id'] for b in blocos_da_area(a['codigo'])} & set(blocos))
    nomes = _nomes_das_areas()
    por_bloco = {b: {'aprovados': [], 'minhas': {}, 'curar': 0, 'pedidos': []} for b in blocos}
    for c in da_todas(codigo):
        alvo = por_bloco.get(c['bloco'])
        if alvo is None:
            continue
        # na reunião, só o que a Controladoria escolheu para a apresentação aparece no gráfico
        if c['status'] == 'aprovado' and (c['na_apresentacao'] or not so_apresentacao):
            alvo['aprovados'].append({'area': nomes.get(c['area'], c['area']), 'texto': c['texto']})
        if any(a['codigo'] == c['area'] for a in areas):
            alvo['minhas'][c['area']] = {'status': c['status'], 'motivo': c['motivo']}
        if cura and c['status'] == 'enviado':
            alvo['curar'] += 1
    minhas_areas = {a['codigo'] for a in areas}
    for p in pedidos(codigo):
        alvo = por_bloco.get(p['bloco'])
        if alvo is not None and (p['area'] in minhas_areas or cura):
            alvo['pedidos'].append({'area': p['area'], 'nome': nomes.get(p['area'], p['area']),
                                    'observacao': p['observacao']})
    escreve = aberto and bool(areas)
    tem_algo = any(v['aprovados'] or v['minhas'] or v['curar'] for v in por_bloco.values())
    if not (escreve or (cura and aberto) or tem_algo):
        return None
    # ver_como: o administrador vê a tela exatamente como a área vê (botões e painel), mas nada grava
    return {'comp': codigo, 'aberto': aberto, 'motivo': motivo, 'cura': cura, 'so_ler': not escrever,
            'ver_como': bool(ver_como),
            'pode_enviar': (U.pode(ctx, 'recurso:consolidar') or bool(ver_como)) and not so_leitura,
            'areas': [{'codigo': a['codigo'], 'nome': a['nome'], 'blocos': a['blocos']} for a in areas],
            'todas_areas': [{'codigo': k, 'nome': v} for k, v in nomes.items()] if cura else [],
            'blocos': por_bloco}


def detalhe(codigo, bloco, ctx):
    """Tudo sobre o comentário de um bloco, para o painel lateral: o texto e o histórico de cada
    área do leitor e, para quem cura, o que cada área enviou."""
    nomes = _nomes_das_areas()
    aberto, motivo = prazo_aberto(codigo)
    minhas = []
    for a in areas_do_usuario(ctx):
        if not any(b['id'] == bloco for b in blocos_da_area(a['codigo'])):
            continue
        c = obter(codigo, bloco, a['codigo'])
        pedido = next((p for p in pedidos(codigo, a['codigo']) if p['bloco'] == bloco), None)
        minhas.append({'area': a['codigo'], 'nome': a['nome'], 'comentario': c,
                       'historico': historico(c['id']) if c else [], 'pedido': pedido})
    curar = []
    if U.pode(ctx, 'recurso:curar_comentarios'):
        for c in da_todas(codigo):
            if c['bloco'] == bloco and c['status'] != 'rascunho':
                curar.append(dict(c, nome=nomes.get(c['area'], c['area'])))
    aprovados = [{'area': nomes.get(c['area'], c['area']), 'texto': c['texto']}
                 for c in aprovados_do_bloco(codigo, bloco)]
    return {'comp': codigo, 'bloco': bloco, 'titulo': titulo_legivel(bloco),
            'secao': C.SECAO[C.BLOCO[bloco]['secao']]['titulo'], 'aberto': aberto, 'motivo': motivo,
            'minhas': minhas, 'curar': curar, 'aprovados': aprovados,
            # quem pode pedir: quem cura e qualquer área — a si mesma não se pede
            'areas_para_pedir': [{'codigo': k, 'nome': v} for k, v in nomes.items()
                                 if k not in {a['codigo'] for a in areas_do_usuario(ctx)}
                                 and any(b['id'] == bloco for b in blocos_da_area(k))]
            if (U.pode(ctx, 'recurso:curar_comentarios') or areas_do_usuario(ctx)) else [],
            'pedidos_feitos': [dict(p, nome=nomes.get(p['area'], p['area'])) for p in pedidos(codigo)
                               if p['bloco'] == bloco and (p['pedido_por'] == ctx['login']
                                                           or U.pode(ctx, 'recurso:curar_comentarios'))]}


def aprovados_do_bloco(codigo, bloco):
    return [dict(r) for r in get_db().execute(
        "SELECT * FROM comentarios WHERE competencia=? AND bloco=? AND status='aprovado' ORDER BY area",
        (codigo, bloco))]


def pendencias(codigo, ctx):
    """A caixa de entrada: só o que pede ação de quem abriu — nada de listar o catálogo inteiro."""
    nomes = _nomes_das_areas()
    saida = {'pedidos': [], 'devolvidos': [], 'rascunhos': [], 'enviados': [], 'aprovados': [], 'curar': []}
    for a in areas_do_usuario(ctx):
        meus = {c['bloco']: c for c in da_area(codigo, a['codigo'])}
        for p in pedidos(codigo, a['codigo']):
            if p['bloco'] not in meus or meus[p['bloco']]['status'] in ('rascunho', 'recusado'):
                saida['pedidos'].append(dict(p, nome=a['nome']))
        for c in meus.values():
            chave = {'recusado': 'devolvidos', 'rascunho': 'rascunhos', 'enviado': 'enviados',
                     'aprovado': 'aprovados'}[c['status']]
            saida[chave].append(dict(c, nome=a['nome']))
    if U.pode(ctx, 'recurso:curar_comentarios'):
        saida['curar'] = [dict(c, nome=nomes.get(c['area'], c['area'])) for c in enviados(codigo)
                          if c['status'] == 'enviado']
    for lista in saida.values():
        for item in lista:
            b = C.BLOCO.get(item['bloco'])
            item['titulo'] = titulo_legivel(item['bloco']) if b else item['bloco']
            item['secao'] = b['secao'] if b else ''
            item['secao_titulo'] = C.SECAO[b['secao']]['titulo'] if b else ''
    return saida


def contagem(ctx):
    """Quantas coisas pedem ação de quem está logado — o número ao lado de "Pendências"."""
    if not ctx:
        return 0
    from .apresentacao import encaminhamentos as E
    enc = sum(1 for e in E.meus(ctx['login']) if e['status'] == 'aberto')    # encaminhamento à espera de "feito"
    codigo = competencia_aberta()
    if not codigo:
        return enc
    p = pendencias(codigo, ctx)
    return enc + len(p['pedidos']) + len(p['devolvidos']) + len(p['rascunhos']) + len(p['curar'])


def titulo_legivel(bloco):
    """O nome que a área reconhece. As aberturas têm no catálogo um nome técnico ("Abertura — título,
    indicadores e resumo"); para quem comenta, são os indicadores do topo da seção."""
    if bloco.endswith('.abertura'):
        return 'Indicadores do topo · ' + C.SECAO[C.BLOCO[bloco]['secao']]['titulo']
    return C.BLOCO[bloco]['titulo']

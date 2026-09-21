# -*- coding: utf-8 -*-
"""Encaminhamentos da reunião — o que ficou combinado, e a retomada no mês seguinte.

Regras que vêm da especificação:
- nasce na reunião, preso ao ato (e ao bloco, quando havia um na tela);
- tem um responsável com login: é ELE quem marca feito, escrevendo o que fez;
- a Controladoria confirma (ou reabre) — feito não vira confirmado sozinho;
- o que não foi confirmado até o mês seguinte aparece como retomada na próxima apresentação;
- prazo vencido sem "feito": o responsável recebe um e-mail por dia até concluir (avisar_atrasados).
"""
from datetime import date

from ..db import agora, get_db

STATUS = ('aberto', 'feito', 'confirmado', 'cancelado')


def pessoas():
    """Quem pode ser responsável: os usuários ativos (é a pessoa que responde e marca feito, não o perfil)."""
    return [dict(r) for r in get_db().execute(
        'SELECT login, nome, email FROM usuarios WHERE ativo=1 ORDER BY nome COLLATE NOCASE, login')]


def rotulo(p):
    """Nome e login juntos: um usuário chamado "Administrador" não se confunde com o perfil."""
    nome = (p.get('nome') or '').strip()
    return '%s (%s)' % (nome, p['login']) if nome and nome.lower() != p['login'].lower() else p['login']


def criar(codigo, texto, responsavel, prazo, login, ato=0, bloco=''):
    texto = (texto or '').strip()
    if not texto:
        raise ValueError('escreva o encaminhamento.')
    if len(texto) > 2000:
        raise ValueError('o encaminhamento passa de 2.000 caracteres.')
    responsavel = (responsavel or '').strip()
    if responsavel.lower() not in {p['login'].lower() for p in pessoas()}:
        raise ValueError('escolha o responsável entre os usuários da aplicação.')
    prazo = (prazo or '').strip()
    if prazo and not (len(prazo) == 10 and prazo[4] == '-' and prazo[7] == '-'):
        raise ValueError('prazo inválido.')
    con = get_db()
    cur = con.execute('INSERT INTO encaminhamentos (competencia, ato, bloco, texto, responsavel, prazo, '
                      'criado_por, criado_em) VALUES (?,?,?,?,?,?,?,?)',
                      (codigo, int(ato or 0), bloco or '', texto, responsavel, prazo, login, agora()))
    con.commit()
    return cur.lastrowid


def obter(eid):
    r = get_db().execute('SELECT * FROM encaminhamentos WHERE id=?', (eid,)).fetchone()
    return dict(r) if r else None


def da_competencia(codigo):
    return [dict(r) for r in get_db().execute(
        'SELECT * FROM encaminhamentos WHERE competencia=? ORDER BY ato, id', (codigo,))]


def retomada(codigo):
    """O que ficou para trás: encaminhamentos de competências anteriores ainda não confirmados."""
    return [dict(r) for r in get_db().execute(
        "SELECT * FROM encaminhamentos WHERE competencia<? AND status IN ('aberto','feito') "
        'ORDER BY competencia, id', (codigo,))]


def marcar_feito(eid, login, resposta=''):
    """Só o responsável marca feito — é a assinatura dele de que aconteceu."""
    e = obter(eid)
    if not e:
        raise ValueError('encaminhamento não encontrado.')
    if (e['responsavel'] or '').lower() != (login or '').lower():
        raise ValueError('só o responsável marca este encaminhamento como feito.')
    if e['status'] == 'confirmado':
        raise ValueError('já confirmado pela Controladoria.')
    con = get_db()
    con.execute("UPDATE encaminhamentos SET status='feito', resposta=?, feito_em=? WHERE id=?",
                ((resposta or '').strip(), agora(), eid))
    con.commit()


def confirmar(eid, login, confirma=True):
    """Controladoria: confirma o que foi feito ou reabre para o responsável."""
    e = obter(eid)
    if not e:
        raise ValueError('encaminhamento não encontrado.')
    con = get_db()
    if confirma:
        if e['status'] != 'feito':
            raise ValueError('o responsável ainda não marcou como feito.')
        con.execute("UPDATE encaminhamentos SET status='confirmado', confirmado_por=?, confirmado_em=? WHERE id=?",
                    (login, agora(), eid))
    else:
        con.execute("UPDATE encaminhamentos SET status='aberto', feito_em=NULL WHERE id=?", (eid,))
    con.commit()


def cancelar(eid, login):
    e = obter(eid)
    if not e:
        raise ValueError('encaminhamento não encontrado.')
    con = get_db()
    con.execute("UPDATE encaminhamentos SET status='cancelado', confirmado_por=?, confirmado_em=? WHERE id=?",
                (login, agora(), eid))
    con.commit()


def meus(login, abertos=True):
    q = 'SELECT * FROM encaminhamentos WHERE responsavel=? COLLATE NOCASE'
    if abertos:
        q += " AND status IN ('aberto','feito')"
    return [dict(r) for r in get_db().execute(q + ' ORDER BY competencia DESC, id', (login,))]


def atrasado(e, hoje=None):
    hoje = hoje or date.today().isoformat()
    return e['status'] == 'aberto' and bool(e['prazo']) and e['prazo'] < hoje


def avisar_atrasados(hoje=None, url=''):
    """Um e-mail por dia ao responsável de cada encaminhamento vencido e ainda não feito.

    A marca `ultimo_aviso` é tomada com um UPDATE condicional antes de enviar: com mais de um
    processo rodando, só um deles ganha o dia. Sem SMTP, não marca nada (avisa quando houver)."""
    from ..seguranca import email as EM
    if not EM.configurado():
        return 0
    hoje = hoje or date.today().isoformat()
    con = get_db()
    linhas = [dict(r) for r in con.execute(
        "SELECT e.*, u.email, u.nome FROM encaminhamentos e JOIN usuarios u ON lower(u.login)=lower(e.responsavel) "
        "WHERE e.status='aberto' AND e.prazo<>'' AND e.prazo<? AND COALESCE(e.ultimo_aviso,'')<? AND u.ativo=1",
        (hoje, hoje))]
    enviados = 0
    for e in linhas:
        cur = con.execute("UPDATE encaminhamentos SET ultimo_aviso=? WHERE id=? AND COALESCE(ultimo_aviso,'')<?",
                          (hoje, e['id'], hoje))
        con.commit()
        if cur.rowcount != 1:
            continue
        dias = (date.fromisoformat(hoje) - date.fromisoformat(e['prazo'])).days
        prazo_br = '%s/%s/%s' % (e['prazo'][8:10], e['prazo'][5:7], e['prazo'][:4])
        texto = ('Olá, %s.\n\nO encaminhamento abaixo, combinado na reunião de %s, passou do prazo (%s — %d dia%s '
                 'de atraso):\n\n  %s\n\nQuando concluir, entre na aplicação e marque "Feito" em Pendências, '
                 'dizendo o que foi feito. Este aviso se repete uma vez por dia até lá.%s'
                 % (e['nome'] or e['responsavel'], e['competencia'], prazo_br, dias, '' if dias == 1 else 's',
                    e['texto'], ('\n\n' + url) if url else ''))
        if EM.enviar(e['email'], 'Encaminhamento atrasado: %s' % e['texto'][:60], texto):
            enviados += 1
    return enviados

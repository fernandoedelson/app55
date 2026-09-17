# -*- coding: utf-8 -*-
"""Encaminhamentos da reunião — o que ficou combinado, e a retomada no mês seguinte.

Regras que vêm da especificação:
- nasce na reunião, preso ao ato (e ao bloco, quando havia um na tela);
- tem um responsável com login: é ELE quem marca feito, escrevendo o que fez;
- a Controladoria confirma (ou reabre) — feito não vira confirmado sozinho;
- o que não foi confirmado até o mês seguinte aparece como retomada na próxima apresentação.
"""
from ..db import agora, get_db

STATUS = ('aberto', 'feito', 'confirmado', 'cancelado')


def criar(codigo, texto, responsavel, prazo, login, ato=0, bloco=''):
    texto = (texto or '').strip()
    if not texto:
        raise ValueError('escreva o encaminhamento.')
    if len(texto) > 2000:
        raise ValueError('o encaminhamento passa de 2.000 caracteres.')
    con = get_db()
    cur = con.execute('INSERT INTO encaminhamentos (competencia, ato, bloco, texto, responsavel, prazo, '
                      'criado_por, criado_em) VALUES (?,?,?,?,?,?,?,?)',
                      (codigo, int(ato or 0), bloco or '', texto, (responsavel or '').strip(),
                       (prazo or '').strip(), login, agora()))
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

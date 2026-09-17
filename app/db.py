# -*- coding: utf-8 -*-
"""Banco SQLite (modo WAL) — o mesmo padrão do Release Builder, só com as tabelas de acesso.

Conexão por requisição em flask.g; schema idempotente; migrações leves por coluna.
"""
import os
import sqlite3
import sys
from datetime import datetime

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nome TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    ativo INTEGER NOT NULL DEFAULT 1,
    senha_hash TEXT NOT NULL DEFAULT '',
    trocar_senha INTEGER NOT NULL DEFAULT 1,
    falhas INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TEXT,
    senha_trocada_em TEXT,
    versao_sessao INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL,
    ultimo_login TEXT
);
CREATE TABLE IF NOT EXISTS perfis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    sistema INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usuario_perfis (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    concedido_por INTEGER,
    concedido_em TEXT NOT NULL,
    PRIMARY KEY (usuario_id, perfil_id)
);
CREATE TABLE IF NOT EXISTS perfil_permissoes (
    perfil_id INTEGER NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    recurso TEXT NOT NULL,
    PRIMARY KEY (perfil_id, recurso)
);
CREATE TABLE IF NOT EXISTS tokens_reset (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    usado INTEGER NOT NULL DEFAULT 0,
    ip TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tentativas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    ip TEXT NOT NULL,
    em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tentativas ON tentativas(tipo, ip, em);
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    em TEXT NOT NULL,
    usuario_id INTEGER,
    login TEXT NOT NULL DEFAULT '',
    acao TEXT NOT NULL,
    detalhes TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    como_perfil TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_auditoria_em ON auditoria(em);
CREATE TABLE IF NOT EXISTS competencias (
    codigo TEXT PRIMARY KEY,                      -- AAAA-MM
    status TEXT NOT NULL DEFAULT 'rascunho',      -- rascunho | disponibilizada | fechada
    criada_em TEXT NOT NULL,
    criada_por TEXT NOT NULL DEFAULT '',
    processada_em TEXT,
    disponibilizada_em TEXT,
    fechada_em TEXT,
    prazo_comentarios TEXT,                       -- a Controladoria define a cada mês
    observacao TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS competencia_arquivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competencia TEXT NOT NULL REFERENCES competencias(codigo) ON DELETE CASCADE,
    base TEXT NOT NULL,                           -- id da base (o mesmo de base:upload:<id>)
    arquivo TEXT NOT NULL,                        -- nome como foi gravado na pasta de fontes
    sha256 TEXT NOT NULL DEFAULT '',
    tamanho INTEGER NOT NULL DEFAULT 0,
    data_posicao TEXT NOT NULL DEFAULT '',        -- declarada por quem sobe
    enviado_por TEXT NOT NULL DEFAULT '',
    enviado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_comp_arq ON competencia_arquivos(competencia, base);
CREATE TABLE IF NOT EXISTS comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competencia TEXT NOT NULL REFERENCES competencias(codigo) ON DELETE CASCADE,
    bloco TEXT NOT NULL,
    area TEXT NOT NULL,                           -- código do perfil que responde pelo bloco
    texto TEXT NOT NULL DEFAULT '',               -- o texto vigente (ajustado pela Controladoria, se houve)
    texto_area TEXT NOT NULL DEFAULT '',          -- o que a área enviou, guardado quando o texto é ajustado
    status TEXT NOT NULL DEFAULT 'rascunho',      -- rascunho | enviado | aprovado | recusado
    na_apresentacao INTEGER NOT NULL DEFAULT 0,
    motivo TEXT NOT NULL DEFAULT '',              -- por que foi recusado
    criado_por TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    enviado_por TEXT, enviado_em TEXT,
    decidido_por TEXT, decidido_em TEXT,
    UNIQUE (competencia, bloco, area)
);
CREATE TABLE IF NOT EXISTS comentario_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comentario_id INTEGER NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
    em TEXT NOT NULL,
    quem TEXT NOT NULL DEFAULT '',
    acao TEXT NOT NULL,                           -- escrever | enviar | aprovar | ajustar | recusar | apresentacao
    texto TEXT NOT NULL DEFAULT '',
    detalhes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_coment_hist ON comentario_historico(comentario_id, em);
CREATE TABLE IF NOT EXISTS comentario_pedidos (
    competencia TEXT NOT NULL REFERENCES competencias(codigo) ON DELETE CASCADE,
    bloco TEXT NOT NULL,
    area TEXT NOT NULL,
    observacao TEXT NOT NULL DEFAULT '',
    pedido_por TEXT NOT NULL DEFAULT '',
    pedido_em TEXT NOT NULL,
    PRIMARY KEY (competencia, bloco, area)
);
CREATE TABLE IF NOT EXISTS competencia_blocos (
    competencia TEXT NOT NULL REFERENCES competencias(codigo) ON DELETE CASCADE,
    bloco TEXT NOT NULL,
    publicado_em TEXT NOT NULL,
    publicado_por TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (competencia, bloco)
);
"""

# perfis iniciais — permissões sugeridas; o administrador ajusta na tela
PERFIS_INICIAIS = [
    ('administrador', 'Administrador', 'Usuários, perfis e permissões; vê tudo', 1),
    ('gestao55', 'Gestão +55', 'Diretoria: visão completa do resultado e a apresentação do mês', 0),
    ('controladoria', 'Controladoria', 'Sobe as bases, confere, aprova destaques e publica o mês', 0),
    ('gestao_comercial', 'Gestão Comercial', 'Vendas, carteira, metas, vendedores e arquitetos', 0),
    ('fabrica', 'Fábrica', 'Custos de produção, retrabalho e assistência técnica', 0),
    ('loja', 'Loja', 'Parte comercial e carteira da loja', 0),
]


def agora():
    return datetime.now().isoformat(timespec='seconds')


def _conectar(caminho):
    con = sqlite3.connect(caminho, check_same_thread=False, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA journal_mode=WAL')
    con.execute('PRAGMA foreign_keys=ON')
    con.execute('PRAGMA busy_timeout=15000')
    return con


def get_db():
    if 'db' not in g:
        g.db = _conectar(current_app.config['DB_PATH'])
    return g.db


def fechar_db(_exc=None):
    con = g.pop('db', None)
    if con is not None:
        con.close()


def _permissoes_sugeridas():
    from . import catalogo as C
    todos = ['bloco:' + b['id'] for b in C.BLOCOS]
    def secoes(*ids):
        return ['bloco:' + b['id'] for b in C.BLOCOS if b['secao'] in ids]
    rec = lambda *ids: ['recurso:' + i for i in ids]
    comercial = [s['id'] for s in C.SECOES if s['grupo'] == 'Comercial']
    return {
        'administrador': [C.PERMISSAO_ADMIN],
        'gestao55': todos + rec('destaques', 'detalhar', 'exportar', 'filtro_livre', 'apresentar', 'nomes_pf'),
        'controladoria': todos + rec(*[r[0] for r in C.RECURSOS]) + ['base:upload:' + b[0] for b in C.BASES_UPLOAD],
        'gestao_comercial': secoes(*comercial) + rec('destaques', 'detalhar', 'filtro_livre', 'nomes_pf', 'comentar'),
        'fabrica': secoes('custosx', 'custos') + rec('destaques', 'detalhar', 'filtro_livre', 'comentar'),
        'loja': secoes('mensal', 'ytd', 'carteira', 'carteira_dinamica', 'performance') + rec('destaques', 'detalhar', 'nomes_pf', 'comentar'),
    }


def init_db(app):
    os.makedirs(app.config['DATA_DIR'], exist_ok=True)
    con = _conectar(app.config['DB_PATH'])
    try:
        con.executescript(SCHEMA)
        if con.execute('SELECT COUNT(*) FROM perfis').fetchone()[0] == 0:
            sugeridas = _permissoes_sugeridas()
            for codigo, nome, desc, sistema in PERFIS_INICIAIS:
                cur = con.execute('INSERT INTO perfis (codigo, nome, descricao, sistema, criado_em) VALUES (?,?,?,?,?)',
                                  (codigo, nome, desc, sistema, agora()))
                con.executemany('INSERT INTO perfil_permissoes (perfil_id, recurso) VALUES (?,?)',
                                [(cur.lastrowid, r) for r in sorted(set(sugeridas[codigo]))])
        _garantir_admin(con)
        con.commit()
    finally:
        con.close()


def _garantir_admin(con):
    """Primeiro acesso: cria um administrador se não houver nenhum usuário ativo com o perfil.
    Senha vem de APP55_ADMIN_SENHA; sem ela, gera uma provisória e mostra UMA vez no console."""
    tem = con.execute(
        "SELECT 1 FROM usuarios u JOIN usuario_perfis up ON up.usuario_id=u.id "
        "JOIN perfis p ON p.id=up.perfil_id WHERE p.codigo='administrador' AND u.ativo=1 LIMIT 1").fetchone()
    if tem:
        return
    from .seguranca.senha import gerar_hash, gerar_provisoria
    login = os.environ.get('APP55_ADMIN_LOGIN', 'admin')
    senha = os.environ.get('APP55_ADMIN_SENHA') or gerar_provisoria()
    existe = con.execute('SELECT id FROM usuarios WHERE login=?', (login,)).fetchone()
    if existe:
        uid = existe['id']
        con.execute('UPDATE usuarios SET ativo=1, senha_hash=?, trocar_senha=1 WHERE id=?', (gerar_hash(senha), uid))
    else:
        uid = con.execute('INSERT INTO usuarios (login, nome, senha_hash, trocar_senha, criado_em) VALUES (?,?,?,1,?)',
                          (login, 'Administrador', gerar_hash(senha), agora())).lastrowid
    pid = con.execute("SELECT id FROM perfis WHERE codigo='administrador'").fetchone()['id']
    con.execute('INSERT OR IGNORE INTO usuario_perfis (usuario_id, perfil_id, concedido_em) VALUES (?,?,?)',
                (uid, pid, agora()))
    if not os.environ.get('APP55_ADMIN_SENHA'):
        print('[app55] administrador inicial: login "%s", senha provisória "%s" (troca obrigatória no 1º acesso)'
              % (login, senha), file=sys.stderr)

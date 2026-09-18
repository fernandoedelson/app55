# -*- coding: utf-8 -*-
"""Backup: o banco e os dados das competências num .zip, para baixar pela tela.

Duas regras que não se deduzem do código:
- o banco é copiado pela API de backup do SQLite, nunca pelo arquivo cru: em modo WAL o .db
  sozinho está sempre atrás do que já foi gravado;
- a chave de sessão (`.secret_key`) NÃO entra no pacote. Restaurar com outra chave só derruba
  as sessões abertas, e assim o backup deixa de ser um arquivo que dá acesso à aplicação.

O .zip nunca vai para o git (`.gitignore`), e baixar um é ato de administrador — vai para a auditoria.
"""
import io
import os
import sqlite3
import zipfile
from datetime import datetime

from flask import current_app

EXCLUIDOS = ('.secret_key',)
TEMPORARIOS = ('.db-wal', '.db-shm', '.tmp')


def _copia_do_banco():
    """Cópia consistente do SQLite (inclui o que ainda está no WAL)."""
    origem = sqlite3.connect(current_app.config['DB_PATH'])
    destino = sqlite3.connect(':memory:')
    try:
        origem.backup(destino)
        return b''.join(l.encode('utf-8') if isinstance(l, str) else l for l in destino.iterdump()).decode('utf-8')
    finally:
        origem.close()
        destino.close()


def _arquivos_de_dados(data_dir):
    for raiz, dirs, arqs in os.walk(data_dir):
        dirs[:] = [d for d in dirs if d != 'apresentacoes']     # regerada a partir das competências
        for nome in arqs:
            if nome in EXCLUIDOS or nome.endswith(TEMPORARIOS) or nome.endswith('.db'):
                continue
            caminho = os.path.join(raiz, nome)
            yield caminho, os.path.relpath(caminho, data_dir).replace('\\', '/')


def gerar(competencia=None):
    """Devolve (nome_do_arquivo, bytes). Com competência, leva só os dados daquele mês."""
    cfg = current_app.config
    data_dir = cfg['DATA_DIR']
    carimbo = datetime.now().strftime('%Y%m%d-%H%M')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        if competencia:
            pasta = os.path.join(cfg['COMPETENCIAS_DIR'], competencia)
            for caminho, rel in _arquivos_de_dados(pasta):
                z.write(caminho, 'competencias/%s/%s' % (competencia, rel))
            fontes = os.path.join(data_dir, 'fontes', competencia)
            if os.path.isdir(fontes):
                for caminho, rel in _arquivos_de_dados(fontes):
                    z.write(caminho, 'fontes/%s/%s' % (competencia, rel))
            nome = 'app55_%s_backup_%s.zip' % (competencia, carimbo)
        else:
            for caminho, rel in _arquivos_de_dados(data_dir):
                z.write(caminho, rel)
            # o banco vai como SQL: um dump abre em qualquer lugar e não depende do WAL
            z.writestr('app55.sql', _copia_do_banco())
            nome = 'app55_backup_%s.zip' % carimbo
        z.writestr('LEIA-ME.txt',
                   'Backup da aplicação +55 Design gerado em %s.\n\n'
                   'app55.sql  — dump do banco (usuários, perfis, permissões, competências, comentários,\n'
                   '             encaminhamentos e auditoria). Restaurar: sqlite3 app55.db < app55.sql\n'
                   'competencias/ — os dados de cada mês publicado (é o que a Biblioteca lê)\n'
                   'fontes/       — as planilhas enviadas em cada fechamento\n\n'
                   'A chave de sessão não está aqui de propósito: restaurar com outra chave apenas\n'
                   'derruba as sessões abertas.\n' % datetime.now().strftime('%d/%m/%Y %H:%M'))
    return nome, buf.getvalue()

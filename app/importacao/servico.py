# -*- coding: utf-8 -*-
"""Ciclo da competência: criar, subir as bases, processar, conferir o que mudou e publicar.

Regras que vêm da especificação e vivem aqui:
- a base do arquivo é reconhecida pelo CONTEÚDO (nome que casa com o padrão da base), não pela
  escolha de quem sobe: se não casar, o arquivo é recusado;
- toda base declara a data de posição no envio;
- mês já publicado não muda sozinho: divergência no passado trava a publicação até justificar;
- publicação é por bloco, e bloco nunca mistura meses (publicar grava a competência do bloco);
- tudo o que acontece aqui entra na auditoria.
"""
import hashlib
import os
import re
import shutil

from flask import current_app

from .. import catalogo as C
from ..calculo import competencia as comp_mod
from ..db import agora, get_db
from . import comparar, motor

RE_COMP = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')
SUBPASTA = {'custos': 'Custos', 'fabloja': 'Modelo_Gerencial_Fabrica_Loja'}


def pasta_fontes(codigo):
    return os.path.join(current_app.config['DATA_DIR'], 'fontes', codigo)


def pasta_dados(codigo):
    return os.path.join(comp_mod.pasta_competencias(current_app.config), codigo)


def listar():
    con = get_db()
    linhas = [dict(r) for r in con.execute('SELECT * FROM competencias ORDER BY codigo DESC')]
    publicadas = set(comp_mod.disponiveis(current_app.config))
    for l in linhas:
        l['tem_dados'] = l['codigo'] in publicadas
        l['arquivos'] = con.execute('SELECT COUNT(*) n FROM competencia_arquivos WHERE competencia=?',
                                    (l['codigo'],)).fetchone()['n']
    # competências que existem em dados mas nunca passaram pela tela (o gabarito importado)
    for cod in sorted(publicadas, reverse=True):
        if not any(l['codigo'] == cod for l in linhas):
            linhas.append({'codigo': cod, 'status': 'fechada', 'criada_em': '', 'criada_por': 'importação inicial',
                           'tem_dados': True, 'arquivos': 0, 'processada_em': None, 'disponibilizada_em': None,
                           'fechada_em': None, 'prazo_comentarios': None, 'observacao': ''})
    return sorted(linhas, key=lambda l: l['codigo'], reverse=True)


def obter(codigo):
    r = get_db().execute('SELECT * FROM competencias WHERE codigo=?', (codigo,)).fetchone()
    return dict(r) if r else None


IMPORTACAO_INICIAL = 'importação inicial'


def registrar_importada(codigo):
    """Competência que chegou pela importação inicial (o gabarito) e nunca passou pela tela: ganha
    registro na primeira vez que alguém a abre, para poder ser disponibilizada às áreas."""
    if obter(codigo) or codigo not in comp_mod.disponiveis(current_app.config):
        return obter(codigo)
    con = get_db()
    con.execute('INSERT INTO competencias (codigo, status, criada_em, criada_por, processada_em) '
                "VALUES (?, 'fechada', ?, ?, ?)", (codigo, agora(), IMPORTACAO_INICIAL, agora()))
    con.commit()
    return obter(codigo)


def criar(codigo, login):
    if not RE_COMP.match(codigo or ''):
        raise ValueError('competência tem de ser AAAA-MM (ex.: 2026-08).')
    con = get_db()
    if con.execute('SELECT 1 FROM competencias WHERE codigo=?', (codigo,)).fetchone():
        raise ValueError('a competência %s já existe.' % codigo)
    con.execute('INSERT INTO competencias (codigo, status, criada_em, criada_por) VALUES (?,?,?,?)',
                (codigo, 'rascunho', agora(), login))
    con.commit()
    os.makedirs(pasta_fontes(codigo), exist_ok=True)
    return codigo


# bases que são uma PASTA (várias planilhas, sem nome único): quem sobe diz a qual pertence
BASES_PASTA = {bid for bid, b in motor.BASES.items() if any('/' in p for p in b['padroes'])}


def base_do_arquivo(nome):
    """Qual base este arquivo alimenta, pelo nome que o gerador do Kit procura. None = não serve.

    Padrão com barra é pasta (Custos/, Modelo_Gerencial_Fabrica_Loja/): ali o nome não identifica
    a base — '*.xlsx' casaria com qualquer planilha —, então essas ficam de fora e exigem escolha."""
    import fnmatch
    alvo = os.path.basename(nome)
    for bid, b in motor.BASES.items():
        if bid in BASES_PASTA:
            continue
        for padrao in b['padroes']:
            if fnmatch.fnmatch(alvo, padrao):
                return bid
    return None


def guardar_arquivo(codigo, arquivo, data_posicao, login, base_declarada=None):
    """Grava o arquivo na pasta da competência e registra quem subiu, quando e com que posição."""
    comp = obter(codigo)
    if not comp:
        raise ValueError('competência não encontrada.')
    if comp['status'] == 'fechada':
        raise ValueError('competência fechada: reabra antes de trocar as bases.')
    nome = os.path.basename(arquivo.filename or '')
    if not nome:
        raise ValueError('arquivo sem nome.')
    if not nome.lower().endswith(('.xlsx', '.xlsm')):
        raise ValueError('a base tem de ser uma planilha .xlsx ou .xlsm.')
    base = base_do_arquivo(nome)
    if base is None and base_declarada in BASES_PASTA:
        base = base_declarada          # planilha de pasta (Custos/, Fábrica×Loja): a escolha manda
    if base is None:
        raise ValueError('não reconheci a base pelo arquivo "%s". O nome precisa seguir o padrão que o '
                         'gerador procura (ex.: "Controle ADM de Vendas ....xlsx") — ou escolha a pasta '
                         '(Custos, Modelo Fábrica × Loja) ao enviar.' % nome)
    if base_declarada and base_declarada not in BASES_PASTA and base_declarada != base:
        raise ValueError('o arquivo "%s" é da base "%s", não de "%s".'
                         % (nome, motor.BASES[base]['titulo'], motor.BASES.get(base_declarada, {}).get('titulo',
                                                                                                       base_declarada)))
    if not (data_posicao or '').strip():
        raise ValueError('declare a data de posição da base (o dia a que os números se referem).')
    destino_dir = os.path.join(pasta_fontes(codigo), SUBPASTA.get(base, ''))
    os.makedirs(destino_dir, exist_ok=True)
    destino = os.path.join(destino_dir, nome)
    arquivo.save(destino)
    with open(destino, 'rb') as f:
        dados = f.read()
    con = get_db()
    con.execute('DELETE FROM competencia_arquivos WHERE competencia=? AND arquivo=?', (codigo, nome))
    con.execute('INSERT INTO competencia_arquivos (competencia, base, arquivo, sha256, tamanho, data_posicao, '
                'enviado_por, enviado_em) VALUES (?,?,?,?,?,?,?,?)',
                (codigo, base, nome, hashlib.sha256(dados).hexdigest(), len(dados), data_posicao.strip(),
                 login, agora()))
    con.commit()
    return {'base': base, 'arquivo': nome, 'tamanho': len(dados)}


def arquivos(codigo):
    return [dict(r) for r in get_db().execute(
        'SELECT * FROM competencia_arquivos WHERE competencia=? ORDER BY base, arquivo', (codigo,))]


def faltando(codigo):
    """Bases obrigatórias que ainda não têm arquivo."""
    tem = {a['base'] for a in arquivos(codigo)}
    return [bid for bid, b in motor.BASES.items() if b['obrigatoria'] and bid not in tem]


def processar(codigo, login, config_de=None):
    """Lê as planilhas e grava os dados da competência. Devolve o que mudou contra a anterior."""
    comp = obter(codigo)
    if not comp:
        raise ValueError('competência não encontrada.')
    if comp['status'] == 'fechada':
        raise ValueError('competência fechada: reabra antes de reprocessar.')
    if faltando(codigo):
        raise ValueError('faltam bases obrigatórias: %s.'
                         % ', '.join(motor.BASES[b]['titulo'] for b in faltando(codigo)))
    fontes = pasta_fontes(codigo)
    # config_apresentacao.json (carteira da apresentação, custo fixo, partes relacionadas, destaques):
    # vem da competência anterior enquanto não houver tela para editá-lo
    base_cfg = config_de or _config_anterior(codigo) or fontes
    blobs = motor.processar(fontes, base=base_cfg)
    motor.gravar(blobs, pasta_dados(codigo))
    comp_mod.esquecer(pasta_dados(codigo))
    con = get_db()
    con.execute('UPDATE competencias SET processada_em=? WHERE codigo=?', (agora(), codigo))
    con.commit()
    return blobs


def _config_anterior(codigo):
    pasta = os.path.join(current_app.config['DATA_DIR'], 'config')
    return pasta if os.path.exists(os.path.join(pasta, 'config_apresentacao.json')) else None


def mudou_o_passado(codigo):
    """Divergências em meses que a competência anterior já publicava."""
    cfg = current_app.config
    if codigo not in comp_mod.disponiveis(cfg):
        return []
    return comparar.passado(comp_mod.carregar(cfg, codigo), comparar.anterior(cfg, codigo))


def o_que_mudou(codigo, secoes=None):
    cfg = current_app.config
    if codigo not in comp_mod.disponiveis(cfg):
        return {}
    secoes = secoes or [s['id'] for s in C.SECOES]
    return comparar.por_bloco(comp_mod.carregar(cfg, codigo), comparar.anterior(cfg, codigo), secoes)


def publicar(codigo, blocos, login):
    """Publicação parcial: cada bloco publicado passa a apontar para esta competência."""
    comp = obter(codigo)
    if not comp:
        raise ValueError('competência não encontrada.')
    validos = {b['id'] for b in C.BLOCOS}
    con = get_db()
    n = 0
    for bloco in blocos:
        if bloco not in validos:
            continue
        con.execute('INSERT OR REPLACE INTO competencia_blocos (competencia, bloco, publicado_em, publicado_por) '
                    'VALUES (?,?,?,?)', (codigo, bloco, agora(), login))
        n += 1
    con.commit()
    return n


def blocos_publicados(codigo):
    return {r['bloco'] for r in get_db().execute(
        'SELECT bloco FROM competencia_blocos WHERE competencia=?', (codigo,))}


def mudar_status(codigo, status, login, prazo=None):
    if status not in ('rascunho', 'disponibilizada', 'fechada'):
        raise ValueError('situação inválida.')
    con = get_db()
    campos = {'disponibilizada': 'disponibilizada_em', 'fechada': 'fechada_em'}
    con.execute('UPDATE competencias SET status=? WHERE codigo=?', (status, codigo))
    if status in campos:
        con.execute('UPDATE competencias SET %s=? WHERE codigo=?' % campos[status], (agora(), codigo))
    if prazo is not None:
        con.execute('UPDATE competencias SET prazo_comentarios=? WHERE codigo=?', (prazo or None, codigo))
    con.commit()


def apagar_rascunho(codigo):
    """Só rascunho sem dados publicados: some a pasta de fontes e o registro."""
    comp = obter(codigo)
    if not comp or comp['status'] != 'rascunho':
        raise ValueError('só é possível descartar uma competência em rascunho.')
    if comp['criada_por'] == IMPORTACAO_INICIAL:
        # descartar apagaria os dados do mês publicado, que não têm planilhas na app para refazer
        raise ValueError('esta competência veio da importação inicial e não pode ser descartada.')
    shutil.rmtree(pasta_fontes(codigo), ignore_errors=True)
    shutil.rmtree(pasta_dados(codigo), ignore_errors=True)
    con = get_db()
    con.execute('DELETE FROM competencias WHERE codigo=?', (codigo,))
    con.commit()

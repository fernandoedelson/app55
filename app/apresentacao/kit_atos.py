# -*- coding: utf-8 -*-
"""A apresentação do mês IDÊNTICA ao HTML aprovado: gerada pelo próprio código do Kit.

Não há reconstrução aqui. Os dados da competência (os mesmos blobs que o gerador do Kit grava) são
serializados do jeito que o gerar_relatorio.montar_html serializa, montados pelo montar_doc do Kit e
passados pelo gerar_html_atos do Kit — os três copiados literalmente da tag gabarito-v1 em
app/kit_congelado (com hash conferido). Mesma entrada, mesmo código: mesmo HTML, byte a byte.

O documento carrega os dados inteiros do mês (é assim que o Kit funciona: o cálculo roda no
navegador). Por isso quem o recebe tem de poder ver TODOS os blocos — ver pode_ver_inteiro().
"""
import hashlib
import importlib.util
import io
import json
import os
import tempfile
import threading

from flask import current_app

from .. import catalogo as C
from ..calculo import competencia as comp_mod
from ..seguranca import usuarios as U

PASTA_KIT = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'kit_congelado')
# a ordem das variáveis é a do montar_html do Kit — mudar a ordem muda o HTML
BLOBS = ['DATA', 'DRE', 'DECK', 'DPNL', 'CF', 'CUSTOS', 'CARTDIN', 'CFMENSAL', 'MAXYM_DRE', 'APORTES',
         'METAS', 'FABLOJA', 'PARTES_RELACIONADAS', 'DESTAQUES_MANUAIS']
_trava = threading.Lock()


def conferir_manifesto():
    """Arquivo do Kit mexido à mão = apresentação que já não é a aprovada. Melhor parar."""
    m = json.load(open(os.path.join(PASTA_KIT, 'MANIFESTO.json'), encoding='utf-8'))
    for nome, esperado in m['arquivos'].items():
        with open(os.path.join(PASTA_KIT, nome), 'rb') as f:
            if hashlib.sha256(f.read()).hexdigest() != esperado:
                raise RuntimeError('o arquivo %s do Kit congelado foi alterado' % nome)
    return m['tag']


def _modulo(nome):
    spec = importlib.util.spec_from_file_location('kit_' + nome, os.path.join(PASTA_KIT, nome + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _blob(pasta_comp):
    """window.DATA=...;window.DRE=...; — idêntico ao montar_html (mesmos separadores, mesma ordem)."""
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    partes, dados = [], {}
    for nome in BLOBS:
        caminho = os.path.join(pasta_comp, nome + '.json')
        valor = json.load(open(caminho, encoding='utf-8')) if os.path.exists(caminho) else None
        dados[nome] = valor
        partes.append('window.%s=%s;' % (nome, j(valor)))
    # os padrões que o montar_html aplica quando o gerador não recebe o blob
    if dados['PARTES_RELACIONADAS'] is None:
        partes[BLOBS.index('PARTES_RELACIONADAS')] = 'window.PARTES_RELACIONADAS=[];'
    if dados['DESTAQUES_MANUAIS'] is None:
        partes[BLOBS.index('DESTAQUES_MANUAIS')] = 'window.DESTAQUES_MANUAIS={};'
    return ''.join(partes), dados['MAXYM_DRE']


def gerar(pasta_comp):
    """Devolve o HTML da versão em Atos para os dados da pasta da competência."""
    conferir_manifesto()
    blob, max_ym_dre = _blob(pasta_comp)
    MES_ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    base_lab = (MES_ABR[(max_ym_dre % 100) - 1] + '/' + str(max_ym_dre // 100)) if max_ym_dre else 'atualizada'
    with _trava:                     # os módulos do Kit trabalham com globais de módulo e arquivos
        rel = _modulo('gerar_relatorio')
        doc = rel.montar_doc(blob, base_lab)
        tmp = tempfile.mkdtemp(prefix='app55-atos-')
        origem, saida = os.path.join(tmp, 'relatorio.html'), os.path.join(tmp, 'relatorio_atos.html')
        io.open(origem, 'w', encoding='utf-8').write(doc)
        os.environ['ATOS_ORIGEM'], os.environ['ATOS_SAIDA'] = origem, saida
        try:
            atos = _modulo('gerar_html_atos')
            atos.main()
        finally:
            os.environ.pop('ATOS_ORIGEM', None)
            os.environ.pop('ATOS_SAIDA', None)
        return io.open(saida, encoding='utf-8').read()


def caminho_cache(codigo):
    return os.path.join(current_app.config['DATA_DIR'], 'apresentacoes', codigo + '_atos.html')


def obter(codigo):
    """A apresentação da competência, gerada uma vez e guardada — são ~5 MB e alguns segundos."""
    pasta = os.path.join(comp_mod.pasta_competencias(current_app.config), codigo)
    destino = caminho_cache(codigo)
    fontes = [os.path.join(pasta, n + '.json') for n in BLOBS if os.path.exists(os.path.join(pasta, n + '.json'))]
    mais_novo = max([os.path.getmtime(f) for f in fontes] + [os.path.getmtime(os.path.join(PASTA_KIT, 'MANIFESTO.json'))])
    if not os.path.exists(destino) or os.path.getmtime(destino) < mais_novo:
        html = gerar(pasta)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        tmp = destino + '.tmp'
        io.open(tmp, 'w', encoding='utf-8', newline='').write(html)
        os.replace(tmp, destino)
    return destino


def pode_ver_inteiro(ctx):
    """O documento do Kit leva os dados do mês inteiros: só quem enxerga todos os blocos o recebe."""
    if not ctx:
        return False
    return ctx['admin'] or all(U.pode(ctx, 'bloco:' + b['id']) for b in C.BLOCOS)

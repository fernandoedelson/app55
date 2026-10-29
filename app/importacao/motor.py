# -*- coding: utf-8 -*-
"""Motor da importação mensal: das planilhas enviadas aos dados da competência.

É a mesma leitura do Kit (kit_parser.py, cópia literal do gerar_relatorio.py congelado) chamada na
mesma ordem do main() dele. A diferença é que cada competência tem a sua pasta de fontes, e o
resultado sai em JSON por base — o formato que o cálculo do app já consome.

    motor.processar(pasta_fontes, base=pasta_com_config) -> {'DATA': ..., 'DRE': ..., ...}
    motor.gravar(blobs, pasta_da_competencia)

Uma importação por vez: o parser do Kit guarda as pastas em variáveis de módulo."""
import json
import os
import threading

from . import kit_parser as K
from . import mapa_vendas, recorte

_trava = threading.Lock()

# base -> o que ela alimenta no relatório (o id é o mesmo do catálogo, em base:upload:<id>)
# reaproveitavel: planilha que não muda todo mês — dá para usar a do mês anterior sem subir de novo.
# As duas carteiras são a mesma planilha (VENDAS LOJA) em dois momentos: a posição de fechamento do
# mês (a "Carteira" do relatório) e a posição mais recente (a "Carteira dinâmica", que é atualizada
# quantas vezes for preciso, mesmo depois de o mês estar publicado).
BASES = {
    'comercial': {'padroes': ['*Controle*Vendas*.xlsx'], 'obrigatoria': True,
                  'titulo': 'Base comercial (Controle ADM de Vendas)'},
    'painel': {'padroes': ['*Painel*Resultado*.xlsm', '*Resultado*.xlsm'], 'obrigatoria': True,
               'titulo': 'Painel de Resultado (DRE e razão do custo fixo)'},
    'carteira_fech': {'padroes': ['Carteira_Fechamento/VENDAS LOJA*.xlsx'], 'obrigatoria': False,
                      'titulo': 'Carteira — posição de fechamento (VENDAS LOJA)'},
    'carteira': {'padroes': ['VENDAS LOJA*.xlsx'], 'obrigatoria': False,
                 'titulo': 'Carteira dinâmica — posição mais recente (VENDAS LOJA)', 'atualizavel': True},
    'metas': {'padroes': ['Metas*Vendas*.xlsx'], 'obrigatoria': False, 'titulo': 'Metas de venda do ano',
              'reaproveitavel': True},
    'aportes': {'padroes': ['Aportes*.xlsx'], 'obrigatoria': False, 'titulo': 'Dívida com o acionista (Aportes)',
                'reaproveitavel': True},
    'apelidos': {'padroes': ['Apelidos.xlsx'], 'obrigatoria': False, 'titulo': 'Apelidos (de-para de nomes)',
                 'reaproveitavel': True},
    'designers': {'padroes': ['Designers.xlsx'], 'obrigatoria': False, 'titulo': 'Designers',
                  'reaproveitavel': True},
    'custos': {'padroes': ['Custos/*.xlsx'], 'obrigatoria': False, 'titulo': 'Fontes de custo (pasta Custos)',
               'reaproveitavel': True},
    'fabloja': {'padroes': ['Modelo_Gerencial_Fabrica_Loja/*.xlsx'], 'obrigatoria': False,
                'titulo': 'Modelo gerencial Fábrica × Loja', 'reaproveitavel': True},
}

# blob -> arquivo json da competência (o cálculo lê por esses nomes)
BLOBS = ['DATA', 'DRE', 'DPNL', 'DECK', 'CF', 'CUSTOS', 'CARTDIN', 'CFMENSAL', 'MAXYM_DRE', 'APORTES',
         'METAS', 'FABLOJA', 'PARTES_RELACIONADAS', 'DESTAQUES_MANUAIS', 'CARTDIN_FECH', 'DREDIN', 'INTERCOMPANY', 'MAPAVENDAS']
PASTA_CARTEIRA_FECH = 'Carteira_Fechamento'


def _config(base):
    caminho = os.path.join(base, 'config_apresentacao.json')
    if not os.path.exists(caminho):
        return {}
    return json.load(open(caminho, encoding='utf-8'))


def _fabloja(fontes, base):
    """O Modelo Fábrica × Loja sobe para a pasta de fontes do mês; o parser, porém, procura "ao lado" de
    `base` (onde fica o config_apresentacao.json). Quando a configuração mora noutra pasta, o modelo
    enviado não era achado e a seção "Estudos e Análises" saía em branco, sem aviso."""
    subpasta = os.path.join('Modelo_Gerencial_Fabrica_Loja', 'Modelo_Gerencial_Fabrica_Loja.xlsx')
    if base == fontes or not os.path.exists(os.path.join(fontes, subpasta)):
        return K.parse_fabloja()
    K.AQUI = fontes
    try:
        return K.parse_fabloja()
    finally:
        K.AQUI = base


def _intercompany(fontes, base):
    """O Analise_Intercompany_<ano>.xlsx sobe junto com o Modelo (mesma pasta); o parser procura ao lado de `base`,
    como o do Modelo — quando a configuração mora noutra pasta, aponta para a pasta de fontes do mês."""
    if base == fontes or not os.path.isdir(os.path.join(fontes, 'Modelo_Gerencial_Fabrica_Loja')):
        return K.parse_intercompany()
    K.AQUI = fontes
    try:
        return K.parse_intercompany()
    finally:
        K.AQUI = base


def processar(fontes, base=None, custos=None, ate_ym=None):
    """Lê as planilhas da pasta e devolve os blobs, na mesma ordem do gerador do Kit.
    `ate_ym` (AAAAMM): competência reconstruída — recorta tudo no fim desse mês (ver recorte.py)."""
    base = base or fontes
    with _trava:
        K.definir_pastas(fontes, custos, base)
        comercial = K.achar_estrito(['*Controle*Vendas*.xlsx'])
        painel = K.achar_estrito(['*Painel*Resultado*.xlsm', '*Resultado*.xlsm'])
        if not comercial:
            raise ValueError('não encontrei a base comercial (Controle ADM de Vendas .xlsx) nas fontes.')
        if not painel:
            raise ValueError('não encontrei o Painel de Resultado (.xlsm) nas fontes.')
        cfg = _config(base)
        data = K.parse_vendas(comercial, ate_ym)
        dpnl = recorte.dpnl(K.parse_dre(painel), ate_ym)
        dre = K.derivar_receita(dpnl)
        custos_blob = recorte.custos(K.carregar_custos(), ate_ym)
        cart_din = recorte.sem_foto(K.parse_carteira_dinamica(), ate_ym)
        cf_mensal = recorte.cf_mensal(K.parse_custo_fixo_mensal(painel), ate_ym)
        max_ym_dre = recorte.teto(K.max_ym_bd2024(painel), ate_ym)
        cf = K.derivar_custo_fixo(cfg.get('custo_fixo'), cf_mensal, dpnl, max_ym_dre)
        return {
            'DATA': data, 'DRE': dre, 'DPNL': dpnl, 'DECK': cfg.get('carteira_apresentacao'),
            'CF': cf, 'CUSTOS': custos_blob, 'CARTDIN': cart_din, 'CFMENSAL': cf_mensal,
            'MAXYM_DRE': max_ym_dre, 'APORTES': recorte.aportes(K.parse_aportes(), ate_ym), 'METAS': K.parse_metas(),
            'FABLOJA': recorte.sem_foto(_fabloja(fontes, base), ate_ym),
            'INTERCOMPANY': recorte.sem_foto(_intercompany(fontes, base), ate_ym),   # foto do período todo: não se recorta
            'PARTES_RELACIONADAS': cfg.get('partes_relacionadas', []),
            'MAPAVENDAS': mapa_vendas.ler(painel, ate_ym),        # receita bruta por UF do cliente (aba MPP DB do Painel)
            'DREDIN': recorte.dredin(K.parse_dre_din(painel), ate_ym),     # DRE no padrão da empresa (aba DRE DINÂMICO)
            'DESTAQUES_MANUAIS': cfg.get('destaques_manuais', {}),
            'CARTDIN_FECH': recorte.sem_foto(
                _carteira_em(os.path.join(fontes, PASTA_CARTEIRA_FECH), fontes, custos, base), ate_ym),
        }


def _carteira_em(pasta, fontes, custos, base):
    """A mesma leitura da carteira dinâmica, apontada para outra pasta (chamar com a trava tomada)."""
    if not os.path.isdir(pasta):
        return None
    try:
        K.definir_pastas(pasta, custos, base)
        return K.parse_carteira_dinamica()
    finally:
        K.definir_pastas(fontes, custos, base)


def carteira_dinamica(fontes, base=None, custos=None):
    """Só a carteira dinâmica: a atualização do meio do mês não relê as outras bases."""
    base = base or fontes
    with _trava:
        K.definir_pastas(fontes, custos, base)
        return K.parse_carteira_dinamica()


def gravar(blobs, pasta):
    """Um arquivo por base, como o gabarito importado — o cálculo lê blob a blob, sob demanda."""
    os.makedirs(pasta, exist_ok=True)
    for nome in BLOBS:
        if nome == 'CARTDIN_FECH' and blobs.get(nome) is None:
            continue                     # sem a carteira de fechamento, a Carteira usa a dinâmica (como o Kit)
        caminho = os.path.join(pasta, nome + '.json')
        tmp = caminho + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(blobs.get(nome), f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, caminho)
    return pasta


def gravar_um(nome, blob, pasta):
    """Regrava um blob só (a carteira dinâmica atualizada no meio do mês)."""
    caminho = os.path.join(pasta, nome + '.json')
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(blob, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, caminho)


def fontes_encontradas(fontes):
    """O que a pasta de fontes já tem, por base — para a tela de importação."""
    achados = {}
    for bid, b in BASES.items():
        arquivos = []
        for padrao in b['padroes']:
            import glob
            arquivos += [os.path.basename(p) for p in glob.glob(os.path.join(fontes, padrao))]
        achados[bid] = sorted(set(arquivos))
    return achados

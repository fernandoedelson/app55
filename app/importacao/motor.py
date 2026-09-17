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

_trava = threading.Lock()

# base -> o que ela alimenta no relatório (o id é o mesmo do catálogo, em base:upload:<id>)
BASES = {
    'comercial': {'padroes': ['*Controle*Vendas*.xlsx'], 'obrigatoria': True,
                  'titulo': 'Base comercial (Controle ADM de Vendas)'},
    'painel': {'padroes': ['*Painel*Resultado*.xlsm', '*Resultado*.xlsm'], 'obrigatoria': True,
               'titulo': 'Painel de Resultado (DRE e razão do custo fixo)'},
    'carteira': {'padroes': ['VENDAS LOJA*.xlsx'], 'obrigatoria': False,
                 'titulo': 'Carteira dinâmica (VENDAS LOJA)'},
    'metas': {'padroes': ['Metas*Vendas*.xlsx'], 'obrigatoria': False, 'titulo': 'Metas de venda do ano'},
    'aportes': {'padroes': ['Aportes*.xlsx'], 'obrigatoria': False, 'titulo': 'Dívida com o acionista (Aportes)'},
    'apelidos': {'padroes': ['Apelidos.xlsx'], 'obrigatoria': False, 'titulo': 'Apelidos (de-para de nomes)'},
    'designers': {'padroes': ['Designers.xlsx'], 'obrigatoria': False, 'titulo': 'Designers'},
    'custos': {'padroes': ['Custos/*.xlsx'], 'obrigatoria': False, 'titulo': 'Fontes de custo (pasta Custos)'},
    'fabloja': {'padroes': ['Modelo_Gerencial_Fabrica_Loja/*.xlsx'], 'obrigatoria': False,
                'titulo': 'Modelo gerencial Fábrica × Loja'},
}

# blob -> arquivo json da competência (o cálculo lê por esses nomes)
BLOBS = ['DATA', 'DRE', 'DPNL', 'DECK', 'CF', 'CUSTOS', 'CARTDIN', 'CFMENSAL', 'MAXYM_DRE', 'APORTES',
         'METAS', 'FABLOJA', 'PARTES_RELACIONADAS', 'DESTAQUES_MANUAIS']


def _config(base):
    caminho = os.path.join(base, 'config_apresentacao.json')
    if not os.path.exists(caminho):
        return {}
    return json.load(open(caminho, encoding='utf-8'))


def processar(fontes, base=None, custos=None):
    """Lê as planilhas da pasta e devolve os blobs, na mesma ordem do gerador do Kit."""
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
        data = K.parse_vendas(comercial)
        dpnl = K.parse_dre(painel)
        dre = K.derivar_receita(dpnl)
        custos_blob = K.carregar_custos()
        cart_din = K.parse_carteira_dinamica()
        cf_mensal = K.parse_custo_fixo_mensal(painel)
        max_ym_dre = K.max_ym_bd2024(painel)
        cf = K.derivar_custo_fixo(cfg.get('custo_fixo'), cf_mensal, dpnl, max_ym_dre)
        return {
            'DATA': data, 'DRE': dre, 'DPNL': dpnl, 'DECK': cfg.get('carteira_apresentacao'),
            'CF': cf, 'CUSTOS': custos_blob, 'CARTDIN': cart_din, 'CFMENSAL': cf_mensal,
            'MAXYM_DRE': max_ym_dre, 'APORTES': K.parse_aportes(), 'METAS': K.parse_metas(),
            'FABLOJA': K.parse_fabloja(),
            'PARTES_RELACIONADAS': cfg.get('partes_relacionadas', []),
            'DESTAQUES_MANUAIS': cfg.get('destaques_manuais', {}),
        }


def gravar(blobs, pasta):
    """Um arquivo por base, como o gabarito importado — o cálculo lê blob a blob, sob demanda."""
    os.makedirs(pasta, exist_ok=True)
    for nome in BLOBS:
        caminho = os.path.join(pasta, nome + '.json')
        tmp = caminho + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(blobs.get(nome), f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, caminho)
    return pasta


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

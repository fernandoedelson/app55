# -*- coding: utf-8 -*-
"""Dados de uma competência e as datas de referência derivadas deles.

As regras de data são as mesmas do app.js do Kit (bloco DATAS DE REFERÊNCIA), portadas uma a uma:
nada de ano ou mês escrito à mão.
"""
import json
import os
import threading
from functools import cached_property

_cache = {}
_trava = threading.Lock()


def pasta_competencias(app_config):
    return app_config.get('COMPETENCIAS_DIR') or os.path.join(app_config['DATA_DIR'], 'competencias')


def disponiveis(app_config):
    p = pasta_competencias(app_config)
    return sorted(d for d in os.listdir(p) if os.path.isdir(os.path.join(p, d))) if os.path.isdir(p) else []


def carregar(app_config, comp):
    """Competência em memória (cache por processo). Os dados de um mês publicado não mudam."""
    pasta = os.path.join(pasta_competencias(app_config), comp)
    chave = os.path.abspath(pasta)
    with _trava:
        if chave not in _cache:
            if not os.path.isdir(pasta):
                raise FileNotFoundError(comp)
            _cache[chave] = Competencia(comp, pasta)
        return _cache[chave]


class Competencia:
    def __init__(self, comp, pasta):
        self.comp = comp
        self.pasta = pasta
        self._blobs = {}

    def blob(self, nome):
        if nome not in self._blobs:
            caminho = os.path.join(self.pasta, nome + '.json')
            self._blobs[nome] = json.load(open(caminho, encoding='utf-8')) if os.path.exists(caminho) else None
        return self._blobs[nome]

    # ------------------------------------------------ datas de referência (app.js: DATAS DE REFERÊNCIA)
    @cached_property
    def maxym_vendas_base(self):
        d = self.blob('DATA')
        return max((r[0] for r in d['rows']), default=None) if d and d.get('rows') else None

    @cached_property
    def maxym_dre(self):
        return self.blob('MAXYM_DRE') or self._ultimo_mes_serie_dre() or self.maxym_vendas_base

    def _ultimo_mes_serie_dre(self):
        dre = self.blob('DRE')
        if not dre:
            return None
        for ano in sorted((int(a) for a in dre if str(a).isdigit()), reverse=True):
            m = (dre.get(str(ano)) or {}).get('months') or []
            for i in range(len(m) - 1, -1, -1):
                if m[i]:
                    return ano * 100 + i + 1
        return None

    @cached_property
    def maxym_vendas(self):
        return self.maxym_vendas_base or self.maxym_dre

    @cached_property
    def minym_vendas(self):
        d = self.blob('DATA')
        return min(r[0] for r in d['rows']) if d and d.get('rows') else self.maxym_vendas

    @cached_property
    def minym_dre(self):
        fonte = self.blob('DRE') or (self.blob('DPNL') or {}).get('CONSOLIDADO') or {}
        anos = [int(a) for a in fonte if str(a).isdigit() and int(a)]
        return min(anos) * 100 + 1 if anos else self.minym_vendas

    @cached_property
    def _custos_yms(self):
        cu = self.blob('CUSTOS')
        return [r[0] for r in cu['cpv']] if cu and cu.get('cpv') else []

    @cached_property
    def minym_custos(self):
        return min(self._custos_yms) if self._custos_yms else None

    @cached_property
    def maxym_custos(self):
        return max(self._custos_yms) if self._custos_yms else None

    @cached_property
    def ano_c(self):
        return (self.maxym_custos or 0) // 100

    @cached_property
    def ano_v(self):
        return (self.maxym_vendas or 0) // 100

    @cached_property
    def ano_d(self):
        return (self.maxym_dre or 0) // 100

    @cached_property
    def ano_ini_serie(self):
        m = self.minym_vendas
        return m // 100 + (0 if m % 100 == 1 else 1)

    def anos_fechados(self, ano_corrente):
        return list(range(self.ano_ini_serie, ano_corrente))

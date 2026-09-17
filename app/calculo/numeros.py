# -*- coding: utf-8 -*-
"""Aritmética igual à do JavaScript do Kit.

ATENÇÃO: o sum() do Python 3.12+ usa soma compensada para floats e dá resultado diferente de
[...].reduce((a,b)=>a+b,0) nos últimos dígitos. Toda soma do porte usa soma() daqui."""
import math


def soma(valores):
    t = 0
    for v in valores:
        t += v
    return t


def pot(base, exp):
    return math.pow(base, exp)


def cagr(val, base, n):
    """cagrCalc do app.js: (val==null||!base||n<=0) ? null : (val/base)^(1/n) - 1"""
    if val is None or not base or n <= 0:
        return None
    return pot(val / base, 1 / n) - 1


def _chave_indice(k):
    """Chave que o JavaScript trata como índice de array: inteiro canônico de 0 a 2^32-2."""
    s = str(k)
    return s.isdigit() and (s == '0' or not s.startswith('0')) and int(s) < 4294967295


def ordem_chaves_js(chaves):
    """Ordem de Object.keys(): índices inteiros em ordem crescente, depois o resto na ordem de inserção."""
    chaves = list(chaves)
    return sorted((k for k in chaves if _chave_indice(k)), key=lambda k: int(str(k))) + \
        [k for k in chaves if not _chave_indice(k)]

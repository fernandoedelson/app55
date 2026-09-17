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

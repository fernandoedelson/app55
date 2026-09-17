# -*- coding: utf-8 -*-
"""Aritmética de ano/mês (aaaamm), igual às funções do app.js."""

MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']


def ym_list(a, b):
    out, y, m = [], a // 100, a % 100
    while y * 100 + m <= b:
        out.append(y * 100 + m)
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def ym_shift(ym, delta):
    y, m = ym // 100, ym % 100 + delta
    while m < 1:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return y * 100 + m


def ym_lab(ym):
    return '%s/%s' % (MES[ym % 100 - 1], str(ym // 100)[2:])

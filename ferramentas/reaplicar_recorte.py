# -*- coding: utf-8 -*-
"""Reaplica em app/importacao/kit_parser.py o recorte de competência reconstruída (ate_ym em parse_vendas).

O kit_parser.py é extraído do Kit por extrair_parser.py, que SOBRESCREVE o arquivo; o recorte é um acréscimo da
aplicação (o Kit não o conhece). Depois de extrair o parser, rode este script.

    python ferramentas/reaplicar_recorte.py
"""
import os

CAMINHO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'importacao', 'kit_parser.py')


def trocar(s, old, new):
    nl = '\r\n' if '\r\n' in s else '\n'
    old, new = old.replace('\n', nl), new.replace('\n', nl)
    if new in s:
        return s                                    # já aplicado
    assert s.count(old) == 1, old[:70]
    return s.replace(old, new)


s = open(CAMINHO, encoding='utf-8', newline='').read()
s = trocar(s, "def parse_vendas(path):\n    print('  base comercial:', os.path.basename(path))",
           "def parse_vendas(path, ate_ym=None):\n    print('  base comercial:', os.path.basename(path))")
s = trocar(s, "           a1=60,a1v=55,a2=67,a2v=62,a3=74,a3v=69,a4=81,a4v=76,desg=88,roy=83)\n",
           """           a1=60,a1v=55,a2=67,a2v=62,a3=74,a3v=69,a4=81,a4v=76,desg=88,roy=83)
    if ate_ym:
        # competência reconstruída: só o que existia no fim do mês (pedido feito até lá; NF emitida depois
        # ainda não existia, então o pedido estava em carteira) — a carteira e o histórico saem desse corte
        fim=datetime.date(ate_ym//100, ate_ym%100, calendar.monthrange(ate_ym//100, ate_ym%100)[1])
        corte=[]
        for r in data:
            r=list(r); p=d_only(r[C['ped']])
            if p is not None and p>fim: continue
            nf=d_only(r[C['nf']])
            if nf is not None and nf>fim: r[C['nf']]=None
            corte.append(r)
        data=corte
""")
open(CAMINHO, 'w', encoding='utf-8', newline='').write(s)
print('recorte reaplicado em', CAMINHO)

# -*- coding: utf-8 -*-
"""O Modelo Fábrica × Loja enviado ao mês tem de ser achado mesmo quando a configuração mora noutra pasta."""
import os

from app.importacao import kit_parser as K
from app.importacao import motor


def _modelo(pasta):
    destino = os.path.join(pasta, 'Modelo_Gerencial_Fabrica_Loja')
    os.makedirs(destino)
    open(os.path.join(destino, 'Modelo_Gerencial_Fabrica_Loja.xlsx'), 'wb').write(b'x')


def test_modelo_do_mes_e_achado_com_a_config_em_outra_pasta(tmp_path, monkeypatch):
    fontes, config = tmp_path / 'fontes', tmp_path / 'config'
    fontes.mkdir()
    config.mkdir()
    _modelo(str(fontes))
    K.definir_pastas(str(fontes), None, str(config))
    visto = []
    monkeypatch.setattr(K, 'parse_fabloja', lambda: visto.append(K.AQUI) or {'ok': True})
    assert motor._fabloja(str(fontes), str(config)) == {'ok': True}
    assert visto == [str(fontes)]                    # leu o modelo que subiu com o mês
    assert K.AQUI == str(config)                     # e devolveu o parser à configuração


def test_sem_modelo_no_mes_segue_como_antes(tmp_path, monkeypatch):
    fontes, config = tmp_path / 'fontes', tmp_path / 'config'
    fontes.mkdir()
    config.mkdir()
    K.definir_pastas(str(fontes), None, str(config))
    visto = []
    monkeypatch.setattr(K, 'parse_fabloja', lambda: visto.append(K.AQUI) or None)
    assert motor._fabloja(str(fontes), str(config)) is None
    assert visto == [str(config)]

# -*- coding: utf-8 -*-
"""Fechamento > Publicar: os botões de marcar/desmarcar todos os blocos estão na tela."""
from conftest import post


def test_publicar_tem_marcar_todos(app, admin):
    from app.db import get_db
    post(admin, '/fechamento/nova', codigo='2026-08')
    with app.app_context():                    # a seção Publicar só aparece depois de processar
        db = get_db()
        db.execute("UPDATE competencias SET processada_em='2026-10-20T10:00:00' WHERE codigo='2026-08'")
        db.commit()
    html = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'id="marcar-blocos"' in html and 'marcar_blocos.js' in html
    assert 'data-marcar="1"' in html and 'data-marcar="0"' in html
    assert html.count('name="bloco"') >= 30      # os blocos do catálogo, todos em checkbox da mesma caixa

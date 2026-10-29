# -*- coding: utf-8 -*-
"""Fechamento: a tela oferece o envio de todos os arquivos escolhidos de uma vez."""
from conftest import csrf, post


def test_tela_tem_o_envio_em_lote(app, admin):
    post(admin, '/fechamento/nova', codigo='2026-08')
    html = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'id="up-todos"' in html and 'envio_lote.js' in html
    assert 'id="up-data-geral"' in html
    n_bases = html.count('class="actions upload-form"')
    assert n_bases >= 8                                  # uma linha de envio por base
    # as bases de pasta (Custos, Fábrica × Loja, Carteiras dos vendedores) aceitam vários arquivos na mesma escolha
    assert html.count(' multiple hidden>') == 3
    # e também permitem escolher a pasta inteira (a tela dizia "pasta" mas só pedia arquivo)
    assert html.count('webkitdirectory') == 3


def test_envio_um_a_um_continua_valendo(app, admin):
    """O envio em lote usa o mesmo /upload de sempre, um arquivo por pedido."""
    import io
    post(admin, '/fechamento/nova', codigo='2026-08')
    for nome in ('CPV_Acumulado.xlsx', 'NDPRO359.xlsx'):
        r = admin.post('/fechamento/2026-08/upload', data={
            'csrf_token': csrf(admin), 'base': 'custos', 'data_posicao': '2026-08-31',
            'arquivo': (io.BytesIO(b'x'), nome)}, follow_redirects=True)
        assert 'recebido como' in r.get_data(as_text=True)
    html = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'CPV_Acumulado.xlsx' in html and 'NDPRO359.xlsx' in html     # as duas ficam: base de pasta


def test_botoes_de_arquivo_com_rotulo_certo_e_troca_de_linha_sem_recarregar(app, admin):
    post(admin, '/fechamento/nova', codigo='2026-08')
    html = admin.get('/fechamento/2026-08').get_data(as_text=True)
    assert 'Escolher pasta' in html and 'Escolher planilhas' in html and 'Escolher planilha ' in html
    assert 'id="tabela-bases"' in html and 'reuso_inline.js' in html

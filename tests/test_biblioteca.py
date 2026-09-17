# -*- coding: utf-8 -*-
"""A Biblioteca só entrega os blocos que o perfil pode ver — o dado dos outros nem sai do servidor."""
import json
import os
import re

import pytest

from conftest import criar_usuario, csrf, entrar, post

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMP = os.path.join(RAIZ, 'data', 'competencias', '2026-07')
pytestmark = pytest.mark.skipif(not os.path.isdir(COMP), reason='competência 2026-07 não importada nesta máquina')


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('APP55_ADMIN_LOGIN', 'admin')
    monkeypatch.setenv('APP55_ADMIN_SENHA', 'Inicial12345')
    from app import criar_app
    return criar_app({'TESTING': True, 'DATA_DIR': str(tmp_path), 'DB_PATH': str(tmp_path / 't.db'),
                      'SECRET_KEY': 't', 'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')})


def _payload(html):
    m = re.search(r'<script type="application/json" id="payload">(.*?)</script>', html, re.S)
    return json.loads(m.group(1))


def _perfil_com(app, admin, nome, perms):
    admin.post('/admin/perfis/novo', data={'nome': nome, 'csrf_token': csrf(admin)})
    from app.db import get_db
    with app.app_context():
        pid = get_db().execute('SELECT id FROM perfis WHERE nome=?', (nome,)).fetchone()['id']
        codigo = get_db().execute('SELECT codigo FROM perfis WHERE id=?', (pid,)).fetchone()['codigo']
    admin.post('/admin/perfis/%d' % pid, data={'nome': nome, 'perm': perms, 'csrf_token': csrf(admin)})
    return codigo


def test_payload_so_com_blocos_permitidos(app, admin):
    codigo = _perfil_com(app, admin, 'Só a curva', ['bloco:ytd-linha'])
    prov = criar_usuario(app, admin, 'curva', [codigo])
    c = app.test_client()
    entrar(c, 'curva', prov)
    post(c, '/trocar-senha', new_password='Curva2026abcd', confirm_password='Curva2026abcd')
    r = c.get('/biblioteca/ytd?comp=2026-07')
    assert r.status_code == 200
    p = _payload(r.get_data(as_text=True))
    assert set(p) == {'ytd-linha'}
    # a tabela por vendedor (nomes e valores) não saiu do servidor
    assert 'LUCIANA' not in r.get_data(as_text=True)


def test_secao_sem_nenhum_bloco_liberado_e_403(app, admin):
    codigo = _perfil_com(app, admin, 'Nada de YTD', ['bloco:mn-evol'])
    prov = criar_usuario(app, admin, 'semytd', [codigo])
    c = app.test_client()
    entrar(c, 'semytd', prov)
    post(c, '/trocar-senha', new_password='SemYtd2026abcd', confirm_password='SemYtd2026abcd')
    assert c.get('/biblioteca/ytd?comp=2026-07').status_code == 403


def test_admin_recebe_todos_os_blocos_da_secao(admin):
    p = _payload(admin.get('/biblioteca/ytd?comp=2026-07').get_data(as_text=True))
    assert set(p) == {'ytd.abertura', 'ytd-kpi', 'ytd-linha', 'ytd-ind', 'ytd-vendedor'}


def test_filtro_de_mes_pela_api(admin):
    r = admin.get('/api/biblioteca/mensal?comp=2026-07&ym=202606')
    assert r.status_code == 200
    p = r.get_json()
    assert p['mensal.abertura']['ym'] == 202606 and p['mn-evol']['meses'][-1] == 202606
    # mês fora da base cai no último mês disponível, nunca em erro
    assert admin.get('/api/biblioteca/mensal?comp=2026-07&ym=199901').get_json()['mensal.abertura']['ym'] == 202607


def test_detalhe_exige_recurso_detalhar(app, admin):
    p = admin.get('/api/biblioteca/mensal?comp=2026-07').get_json()
    cli = p['mn-cli']['linhas'][0]['idx']
    ok = admin.get('/api/biblioteca/mensal/detalhe/itens?comp=2026-07&ym=202607&cli=%d' % cli)
    assert ok.status_code == 200 and ok.get_json()['itens']
    codigo = _perfil_com(app, admin, 'Mensal sem detalhe', ['bloco:mn-cli', 'bloco:mensal.abertura'])
    prov = criar_usuario(app, admin, 'semdetalhe', [codigo])
    c = app.test_client()
    entrar(c, 'semdetalhe', prov)
    post(c, '/trocar-senha', new_password='SemDetalhe2026x', confirm_password='SemDetalhe2026x')
    assert c.get('/api/biblioteca/mensal?comp=2026-07').status_code == 200
    assert c.get('/api/biblioteca/mensal/detalhe/itens?comp=2026-07&ym=202607&cli=%d' % cli).status_code == 403


def test_api_respeita_blocos_permitidos(app, admin):
    codigo = _perfil_com(app, admin, 'Só evolução mensal', ['bloco:mn-evol'])
    prov = criar_usuario(app, admin, 'soevol', [codigo])
    c = app.test_client()
    entrar(c, 'soevol', prov)
    post(c, '/trocar-senha', new_password='SoEvol2026abcd', confirm_password='SoEvol2026abcd')
    assert set(c.get('/api/biblioteca/mensal?comp=2026-07&ym=202605').get_json()) == {'mn-evol'}


def test_detalhe_de_pedido_da_carteira_dinamica(admin):
    p = admin.get('/api/biblioteca/carteira_dinamica?comp=2026-07').get_json()
    status, peds = next((b, l) for b, l in p['cd-status']['pedidos'].items() if l)
    # a lista por status vai sem os itens; eles só vêm pelo detalhamento
    assert all(len(x) == 4 for x in peds)
    r = admin.get('/api/biblioteca/carteira_dinamica/detalhe/pedido',
                  query_string={'comp': '2026-07', 'ped': peds[0][0], 'status': status})
    assert r.status_code == 200 and r.get_json()['itens']


def test_custo_fixo_por_entidade_fecha_com_o_consolidado(admin):
    tot = {e: admin.get('/api/biblioteca/custofixo', query_string={'comp': '2026-07', 'ent': e}).get_json()['cf-cat']['tot']
           for e in ('CONSOLIDADO', 'FABRICA', 'DESIGN')}
    assert abs(tot['FABRICA'] + tot['DESIGN'] - tot['CONSOLIDADO']) < 1


def test_custo_fixo_mensal_ano_e_composicao_batem_com_os_pacotes(admin):
    q = {'comp': '2026-07', 'emp': 'FABRICA', 'dim': 'c'}
    mes = admin.get('/api/biblioteca/custofixo_mensal', query_string=q).get_json()['cfm-pacotes']
    assert mes['modo'] == 'mes'
    pac, valor = next((r[0], r[1]) for r in mes['linhas'] if r[1])
    det = admin.get('/api/biblioteca/custofixo_mensal/detalhe/composicao', query_string=dict(q, pac=pac)).get_json()
    assert abs(det['tot'][0] - valor) < 0.01
    ano = admin.get('/api/biblioteca/custofixo_mensal', query_string=dict(q, ym='Y2026')).get_json()['cfm-pacotes']
    assert ano['modo'] == 'ano' and len(ano['yms']) == len(ano['col_tot'])
    det = admin.get('/api/biblioteca/custofixo_mensal/detalhe/composicao',
                    query_string=dict(q, ym='Y2026', pac=pac)).get_json()
    linha = next(r for r in ano['linhas'] if r['p'] == pac)
    assert abs(det['tot'] - linha['tot']) < 0.01


def test_dre_filtro_invalido_cai_no_ytd(admin):
    p = admin.get('/api/biblioteca/dre', query_string={'comp': '2026-07', 'de': 'x', 'ate': '202613', 'ent': 'NADA'}).get_json()
    A = p['dre.abertura']
    assert (A['ent'], A['a'], A['b']) == ('CONSOLIDADO', A['ano'] * 100 + 1, A['maxym'])
    assert 'dre-fabloja' in p
    assert 'dre-fabloja' not in admin.get('/api/biblioteca/dre', query_string={'comp': '2026-07', 'ent': 'FABRICA'}).get_json()

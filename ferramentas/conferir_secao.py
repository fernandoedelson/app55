# -*- coding: utf-8 -*-
"""
Confere uma seção da Biblioteca (cálculo no servidor + desenho do Kit) contra o gabarito sem
destaques, bloco a bloco. É o critério de pronto da fase 3.

    python ferramentas/conferir_secao.py ytd [mais seções...] [--comp 2026-07]

Monta a página logado como administrador (banco temporário, dados reais da competência), salva como
HTML estático, desenha num Edge sem janela e compara o texto exibido e os valores de gráfico de cada
bloco com os do gabarito. Saída: _revisao/conferencia_<secao>.md
"""
import argparse
import difflib
import io
import json
import os
import re
import shutil
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
sys.path.insert(0, os.path.join(KIT, 'ferramentas'))
REVISAO = os.path.join(RAIZ, '_revisao')

os.environ['APP55_ADMIN_LOGIN'] = 'admin'
os.environ['APP55_ADMIN_SENHA'] = 'Conferencia2026ab'


def cliente_admin():
    from app import criar_app
    tmp = tempfile.mkdtemp(prefix='app55-conf-')
    app = criar_app({'TESTING': True, 'DATA_DIR': tmp, 'DB_PATH': os.path.join(tmp, 'c.db'), 'SECRET_KEY': 'conf',
                     'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')})
    c = app.test_client()

    def token():
        c.get('/entrar')
        with c.session_transaction() as s:
            return s.get('_csrf')
    c.post('/entrar', data={'username': 'admin', 'password': 'Conferencia2026ab', 'csrf_token': token()})
    c.post('/trocar-senha', data={'new_password': 'Conferencia2026cd', 'confirm_password': 'Conferencia2026cd',
                                  'csrf_token': token()})
    return c


def blocos_do_retrato(r, secao):
    out = {}
    for k in r['ordem']:
        sid, blk = k.split('/', 1)
        if sid == secao:
            b = r['blocos'][k]
            out[blk] = (' '.join(b['texto']), b['graficos'])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('secoes', nargs='+')
    ap.add_argument('--comp', default='2026-07')
    a = ap.parse_args()
    import retrato

    gab = json.load(open(os.path.join(KIT, '_referencia', 'gabarito', a.comp, 'retrato_sem_destaques.json'), encoding='utf-8'))
    os.makedirs(REVISAO, exist_ok=True)
    destino_static = os.path.join(REVISAO, 'static')
    shutil.rmtree(destino_static, ignore_errors=True)
    shutil.copytree(os.path.join(RAIZ, 'app', 'static'), destino_static)
    c = cliente_admin()
    total_ok = True
    for secao in a.secoes:
        resp = c.get('/biblioteca/%s?comp=%s' % (secao, a.comp))
        if resp.status_code != 200:
            print('%s: HTTP %d' % (secao, resp.status_code))
            total_ok = False
            continue
        html = resp.get_data(as_text=True).replace('"/static/', '"static/')
        arq = os.path.join(REVISAO, 'biblioteca_%s.html' % secao)
        io.open(arq, 'w', encoding='utf-8').write(html)
        atual = blocos_do_retrato(retrato.extrair(retrato.renderizar(arq)), secao)
        esperado = blocos_do_retrato(gab, secao)
        linhas, iguais = [], 0
        for blk in list(dict.fromkeys(list(esperado) + list(atual))):
            e, t = esperado.get(blk), atual.get(blk)
            if e == t:
                iguais += 1
                continue
            linhas.append('### %s' % blk)
            if e is None or t is None:
                linhas.append('só no %s' % ('gabarito' if t is None else 'app'))
                continue
            for nome, x, y in (('texto', e[0].split(' '), t[0].split(' ')), ('gráficos', e[1], t[1])):
                d = [l for l in difflib.unified_diff(x, y, lineterm='', n=0) if l[:1] in '+-' and not l.startswith(('+++', '---'))]
                if d:
                    linhas.append('**%s**\n```diff\n%s\n```' % (nome, '\n'.join(d[:80])))
        n = len(set(esperado) | set(atual))
        ok = iguais == n
        total_ok &= ok
        io.open(os.path.join(REVISAO, 'conferencia_%s.md' % secao), 'w', encoding='utf-8').write(
            '# %s: %d de %d blocos iguais ao gabarito\n\n%s\n' % (secao, iguais, n, '\n'.join(linhas)))
        print('%-18s %s  %d/%d blocos iguais ao gabarito' % (secao, 'OK ' if ok else 'DIF', iguais, n))
    sys.exit(0 if total_ok else 1)


if __name__ == '__main__':
    main()

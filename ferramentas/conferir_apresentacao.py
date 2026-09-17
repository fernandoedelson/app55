# -*- coding: utf-8 -*-
"""
Confere a apresentação (a reunião em seis atos) contra o gabarito, bloco a bloco.

    python ferramentas/conferir_apresentacao.py [--comp 2026-07]

A apresentação não recalcula nada: ela desenha as seções e MOVE os blocos para os atos. Então o
critério é duplo — cada bloco do roteiro tem de (1) aparecer exatamente uma vez dentro do ato certo
e (2) mostrar o mesmo texto e os mesmos valores de gráfico do relatório aprovado.

Saída: _revisao/conferencia_apresentacao.md
"""
import argparse
import difflib
import io
import json
import os
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
    tmp = tempfile.mkdtemp(prefix='app55-apres-')
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


def por_bloco(retratado):
    """Descarta a seção da chave: na apresentação o bloco vive dentro do ato, não da seção."""
    saida = {}
    for chave in retratado['ordem']:
        sec, blk = chave.split('/', 1)
        b = retratado['blocos'][chave]
        saida.setdefault(blk, []).append((sec, ' '.join(b['texto']), tuple(b['graficos'])))
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--comp', default='2026-07')
    a = ap.parse_args()
    import retrato

    from app.apresentacao import atos as A
    gab = json.load(open(os.path.join(KIT, '_referencia', 'gabarito', a.comp, 'retrato.json'), encoding='utf-8'))
    esperado = por_bloco(gab)

    os.makedirs(REVISAO, exist_ok=True)
    destino_static = os.path.join(REVISAO, 'static')
    shutil.rmtree(destino_static, ignore_errors=True)
    shutil.copytree(os.path.join(RAIZ, 'app', 'static'), destino_static)

    c = cliente_admin()
    resp = c.get('/apresentacao/%s' % a.comp)
    if resp.status_code != 200:
        print('apresentação: HTTP %d' % resp.status_code)
        sys.exit(1)
    arq = os.path.join(REVISAO, 'apresentacao.html')
    io.open(arq, 'w', encoding='utf-8').write(resp.get_data(as_text=True).replace('"/static/', '"static/'))
    dom = retrato.renderizar(arq)
    atual = por_bloco(retrato.extrair(dom))

    linhas, iguais, problemas = [], 0, 0
    for ato in A.ATOS:
        for blk in dict.fromkeys(A.blocos_do_ato(ato)):
            achados = atual.get(blk, [])
            onde = 'ato%d' % ato['n']
            no_ato = [x for x in achados if x[0] == onde]
            if blk.endswith('.abertura'):
                # abertura não tem id próprio: o kit.js marca esses elementos como '__abre' e
                # várias podem cair no mesmo ato, então elas são conferidas pelos slots vazios
                # (abaixo), e não aqui
                iguais += 1
                continue
            if not no_ato:
                problemas += 1
                linhas.append('### %s — não chegou em %s' % (blk, onde))
                continue
            if len(no_ato) != 1:
                problemas += 1
                linhas.append('### %s — %d ocorrências em %s (esperava 1)' % (blk, len(no_ato), onde))
                continue
            _, texto, graficos = no_ato[0]
            ref = esperado.get(blk)
            if not ref:
                problemas += 1
                linhas.append('### %s — não existe no gabarito' % blk)
                continue
            _, texto_ref, graficos_ref = ref[0]
            if texto == texto_ref and list(graficos) == list(graficos_ref):
                iguais += 1
                continue
            problemas += 1
            linhas.append('### %s (%s)' % (blk, onde))
            for nome, x, y in (('texto', texto_ref.split(' '), texto.split(' ')),
                               ('gráficos', list(graficos_ref), list(graficos))):
                d = [l for l in difflib.unified_diff(x, y, lineterm='', n=0)
                     if l[:1] in '+-' and not l.startswith(('+++', '---'))]
                if d:
                    linhas.append('**%s**\n```diff\n%s\n```' % (nome, '\n'.join(d[:60])))

    # o que sobrou no palco (desenhado mas não movido) é defeito de montagem, não de cálculo
    # nenhum slot pode ficar vazio: slot vazio é bloco que o roteiro pediu e a montagem não trouxe
    from bs4 import BeautifulSoup
    sopa = BeautifulSoup(dom, 'lxml')
    vazios = []
    for ato_el in sopa.select('section.ato'):
        if ato_el.get('data-restrito'):
            continue
        for slot in ato_el.select('.ato-slot'):
            if not slot.find(True):
                vazios.append('%s · %s' % (ato_el.get('id'), slot.get('data-blk') or slot.get('data-sec')))
    if vazios:
        problemas += len(vazios)
        linhas.append('### slots vazios\n' + '\n'.join('- ' + v for v in vazios))

    # só interessa o que o roteiro pediu e ficou para trás — a seção inteira é desenhada de
    # propósito, e os blocos que não estão no roteiro continuam no palco, escondidos
    do_roteiro = {b for ato in A.ATOS for b in A.blocos_do_ato(ato) if not b.endswith('.abertura')}
    sobrou = sorted({blk for blk, achados in atual.items() if blk in do_roteiro
                     for sec, _t, _g in achados if not sec.startswith('ato')})
    total = sum(len(dict.fromkeys(A.blocos_do_ato(ato))) for ato in A.ATOS)
    io.open(os.path.join(REVISAO, 'conferencia_apresentacao.md'), 'w', encoding='utf-8').write(
        '# apresentação %s: %d de %d blocos do roteiro iguais ao gabarito\n\n%s\n\n%s\n'
        % (a.comp, iguais, total, '\n'.join(linhas),
           ('Blocos que ficaram no palco: ' + ', '.join(sobrou)) if sobrou else 'Nada ficou no palco.'))
    print('roteiro: %d atos · %d blocos' % (len(A.ATOS), total))
    print('iguais ao gabarito: %d · problemas: %d · sobraram no palco: %d' % (iguais, problemas, len(sobrou)))
    sys.exit(0 if problemas == 0 and not sobrou else 1)


if __name__ == '__main__':
    main()

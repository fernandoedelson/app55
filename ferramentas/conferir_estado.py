# -*- coding: utf-8 -*-
"""
Confere estados FILTRADOS de uma seção contra o Kit congelado — o gabarito só guarda a tela inicial.

Para cada caso: no Kit (relatorio_sem_destaques.html do gabarito) roda um roteiro de cliques depois
que a página desenha; no app, pede a mesma seção com os filtros na URL (o servidor devolve o payload
já filtrado) e, se o caso pedir, roda um roteiro no app também (interações que não vão ao servidor).
Compara bloco a bloco, como o conferir_secao.

    python ferramentas/conferir_estado.py dre [custofixo ...] [--comp 2026-07]

Detalhamentos (itens de pedido, composição de pacote, clientes de um segmento): a página é aberta como
arquivo e não alcança a API, então a resposta é buscada antes pelo cliente de teste e servida à página
por um fetch substituto. O caso declara {nome do detalhe: função(payload) -> parâmetros}.
Saída: _revisao/estado_<secao>.md
"""
import argparse
import difflib
import io
import json
import os
import shutil
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conferir_secao as CS  # noqa: E402

sys.path.insert(0, os.path.join(CS.KIT, 'ferramentas'))
import retrato  # noqa: E402


def _sel(css, valor):
    return ("(function(){var e=document.querySelector(%r);e.value=%r;e.dispatchEvent(new Event('change'));})();"
            % (css, str(valor)))


def _clic(css):
    return "document.querySelector(%r).click();" % css


# secao -> [(nome do caso, filtros na URL do app, roteiro no Kit, roteiro no app[, detalhes pré-buscados])]
CASOS = {
    'mensal': [
        ('mês 2026-03', {'ym': 202603}, _sel('#mn-sel', 202603), ''),
        ('itens do 1º cliente', {}, _clic('#mensal .cli-row'), _clic('#mensal .cli-row'),
         {'itens': lambda P: {'ym': P['mn-cli']['ym'], 'cli': P['mn-cli']['linhas'][0]['idx']}}),
    ],
    'custofixo': [
        ('Fábrica', {'ent': 'FABRICA'}, _clic('#custofixo .cfb[data-e="FABRICA"]'), ''),
        ('Loja', {'ent': 'DESIGN'}, _clic('#custofixo .cfb[data-e="DESIGN"]'), ''),
    ],
    'custofixo_mensal': [
        ('Loja · mar/26 · conta', {'emp': 'LOJA', 'ym': 202603, 'dim': 'c'},
         _sel('#cfm-emp', 'LOJA') + _sel('#cfm-mes', 202603) + _sel('#cfm-dim', 'c'), ''),
        ('Fábrica · ano 2026', {'emp': 'FABRICA', 'ym': 'Y2026'},
         _sel('#cfm-emp', 'FABRICA') + _sel('#cfm-mes', 'Y2026'), ''),
        ('composição de PESSOAL', {}, _clic('.cfm-pac-row[data-p="PESSOAL"]'), _clic('.cfm-pac-row[data-p="PESSOAL"]'),
         {'composicao': lambda P: {'pac': 'PESSOAL'}}),
        ('ano 2026 · composição de FACILITIES', {'ym': 'Y2026'},
         _sel('#cfm-mes', 'Y2026') + _clic('.cfm-pac-row[data-p="FACILITIES"]'), _clic('.cfm-pac-row[data-p="FACILITIES"]'),
         {'composicao': lambda P: {'ym': 'Y2026', 'pac': 'FACILITIES'}}),
    ],
    'carteira_dinamica': [
        ('status 3', {}, _sel('#cartdin-status-sel', 2), _sel('#cartdin-status-sel', 2)),
        ('itens do 1º pedido', {}, _clic('#cartdin-status-detail .cartdin-ped-row'),
         _clic('#cartdin-status-detail .cartdin-ped-row'),
         {'pedido': lambda P: {'ped': P['cd-status']['pedidos'][P['cd-status']['status'][0][0]][0][0],
                               'status': P['cd-status']['status'][0][0]}}),
    ],
    'periodo': [
        ('Histórico', {'de': 200001, 'ate': 300000}, _clic('#periodo .preset[data-a="200001"]'), ''),
        ('2024', {'de': 202401, 'ate': 202412}, _clic('#periodo .preset[data-a="202401"]'), ''),
        ('jul/26', {'de': 202607, 'ate': 202607}, _clic('#periodo .preset[data-a="202607"]'), ''),
        ('nov/24–mar/25', {'de': 202411, 'ate': 202503},
         _sel('#f-de', 202503) + _sel('#f-ate', 202411) + _clic('#f-apply'), ''),
    ],
    'vendas': [
        ('janela 6m', {'janela': 6}, _sel('#av-janela', 6), ''),
        ('janela 24m', {'janela': 24}, _sel('#av-janela', 24), ''),
        ('clientes Em risco', {}, _clic('#vendas .rfv-seg-row[data-seg="Em risco"]'),
         _clic('#vendas .rfv-seg-row[data-seg="Em risco"]'), {'segmento': lambda P: {'janela': 12, 'seg': 'Em risco'}}),
    ],
    'arquitetos': [
        ('janela 24m', {'janela': 24}, _sel('#aq-janela', 24), ''),
        ('carteira do 1º vendedor', {}, _clic('#arquitetos .aq-vend-row'), _clic('#arquitetos .aq-vend-row'),
         {'vendedor': lambda P: {'vend': P['aq-quantos']['linhas'][0][0]}}),
        ('arquitetos Em risco', {}, _clic('#arquitetos .aqrfv-row[data-seg="Em risco"]'),
         _clic('#arquitetos .aqrfv-row[data-seg="Em risco"]'), {'segmento': lambda P: {'seg': 'Em risco'}}),
    ],
    'estudos': [
        ('subgrupos abertos', {'grp': 1}, _clic('#est-grp-toggle'), ''),
    ],
    'custosx': [
        ('ano anterior', {'de': 202501, 'ate': 202512}, _clic('#custosx .cxpreset[data-a="202501"]'), ''),
        ('último mês', {'de': 202607, 'ate': 202607}, _clic('#custosx .cxpreset[data-a="202607"][data-b="202607"]'), ''),
        ('últimos 12m', {'de': 202508, 'ate': 202607}, _clic('#custosx .cxpreset[data-a="202508"]'), ''),
        ('A/B mai x jul', {'cxa': 202605, 'cxb': 202607},
         _sel('#cxg-a', 202605) + _sel('#cxg-b', 202607) + _clic('#cxg-apply'), ''),
        ('desagrupar CPV', {}, _clic('#cx-grp-toggle'), _clic('#cx-grp-toggle')),
        ('busca de produto', {}, "var i=document.getElementById('cx-prodsearch');i.value='mesa';"
         "i.dispatchEvent(new Event('input'));",
         "var i=document.getElementById('cx-prodsearch');i.value='mesa';i.dispatchEvent(new Event('input'));"),
        ('materiais de uma categoria', {}, _clic('#cx-mat-pie .pl-row[data-cat]'), _clic('#cx-mat-pie .pl-row[data-cat]'),
         {'material': lambda P: {'cat': P['cx-materia']['materiais'][0][0]}}),
        ('produtos de um driver', {}, _clic('.cxg-driver-cell'), _clic('.cxg-driver-cell'),
         {'driver': lambda P: {'grp': P['cx-drivers']['grupos'][0][0]}}),
    ],
    'dre': [
        ('Fábrica', {'ent': 'FABRICA'}, _clic('#dre .entb[data-e="FABRICA"]'), ''),
        ('Loja · 2025', {'ent': 'DESIGN', 'de': 202501, 'ate': 202512},
         _clic('#dre .entb[data-e="DESIGN"]') + _clic('#dre .dpreset[data-a="202501"]'), ''),
        ('Histórico', {'de': 200001, 'ate': 300000}, _clic('#dre .dpreset[data-a="200001"]'), ''),
        ('Consolidado · mar/25–fev/26', {'de': 202503, 'ate': 202602},
         _sel('#d-de', 202503) + _sel('#d-ate', 202602) + _clic('#d-apply'), ''),
        ('comparativo Fábrica · mar/26', {'emp': 'FABRICA', 'ym': 202603},
         _sel('#dresnap-emp', 'FABRICA') + _sel('#dresnap-mes', 202603), ''),
    ],
}


def _com_roteiro(html, js, respostas=None):
    if not js:
        return html
    falso = ''
    if respostas:
        # fetch substituto: devolve a resposta pré-buscada de cada detalhamento, pelo nome na URL
        falso = (r"<script>(function(){var R=%s;window.fetch=function(u){var m=/\/detalhe\/([^?]+)/.exec(String(u));"
                 r"if(m&&R[m[1]])return Promise.resolve({ok:true,json:function(){return Promise.resolve(R[m[1]]);}});"
                 r"return Promise.reject(new Error('sem resposta pré-buscada: '+u));};})();</script>"
                 % json.dumps(respostas, ensure_ascii=False).replace('</', r'<\/'))
    tag = falso + ("<script>window.addEventListener('load',function(){setTimeout(function(){"
           "try{%s}catch(e){document.body.setAttribute('data-erro-roteiro',String(e));}},1500);});</script>" % js)
    i = html.rfind('</body>')
    return html[:i] + tag + html[i:] if i >= 0 else html + tag


def _render(arq):
    dom = retrato.renderizar(arq)
    erro = 'data-erro-roteiro="' in dom
    return retrato.extrair(dom), erro


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('secoes', nargs='+')
    ap.add_argument('--comp', default='2026-07')
    a = ap.parse_args()
    kit_html = io.open(os.path.join(CS.KIT, '_referencia', 'gabarito', a.comp, 'relatorio_sem_destaques.html'),
                       encoding='utf-8').read()
    os.makedirs(CS.REVISAO, exist_ok=True)
    shutil.rmtree(os.path.join(CS.REVISAO, 'static'), ignore_errors=True)
    shutil.copytree(os.path.join(CS.RAIZ, 'app', 'static'), os.path.join(CS.REVISAO, 'static'))
    c = CS.cliente_admin()
    gab = json.load(io.open(os.path.join(CS.KIT, '_referencia', 'gabarito', a.comp, 'retrato_sem_destaques.json'),
                            encoding='utf-8'))
    tudo_ok = True
    for secao in a.secoes:
        linhas_md = []
        for n, caso in enumerate(CASOS.get(secao, [])):
            nome, params, js_kit, js_app = caso[:4]
            detalhes = caso[4] if len(caso) > 4 else {}
            kit_arq = os.path.join(CS.REVISAO, 'estado_kit_%s_%d.html' % (secao, n))
            io.open(kit_arq, 'w', encoding='utf-8').write(_com_roteiro(kit_html, js_kit))
            q = urllib.parse.urlencode(dict(params, comp=a.comp))
            resp = c.get('/biblioteca/%s?%s' % (secao, q))
            app_html = resp.get_data(as_text=True).replace('"/static/', '"static/')
            app_arq = os.path.join(CS.REVISAO, 'estado_app_%s_%d.html' % (secao, n))
            respostas = {}
            if detalhes:
                P = c.get('/api/biblioteca/%s?%s' % (secao, q)).get_json()
                for det, fn in detalhes.items():
                    dq = urllib.parse.urlencode(dict(params, comp=a.comp, **fn(P)))
                    r = c.get('/api/biblioteca/%s/detalhe/%s?%s' % (secao, det, dq))
                    if r.status_code != 200:
                        raise SystemExit('%s/%s: HTTP %d' % (secao, det, r.status_code))
                    respostas[det] = r.get_json()
            io.open(app_arq, 'w', encoding='utf-8').write(_com_roteiro(app_html, js_app, respostas))
            rk, erro_k = _render(kit_arq)
            ra, erro_a = _render(app_arq)
            esperado, atual = CS.blocos_do_retrato(rk, secao), CS.blocos_do_retrato(ra, secao)
            difs = []
            for blk in list(dict.fromkeys(list(esperado) + list(atual))):
                e, t = esperado.get(blk), atual.get(blk)
                if e == t:
                    continue
                difs.append('#### %s' % blk)
                if e is None or t is None:
                    difs.append('só no %s' % ('Kit' if t is None else 'app'))
                    continue
                for rot, x, y in (('texto', e[0].split(' '), t[0].split(' ')), ('gráficos', e[1], t[1])):
                    d = [l for l in difflib.unified_diff(x, y, lineterm='', n=0)
                         if l[:1] in '+-' and not l.startswith(('+++', '---'))]
                    if d:
                        difs.append('**%s**\n```diff\n%s\n```' % (rot, '\n'.join(d[:80])))
            total = len(set(esperado) | set(atual))
            # o roteiro precisa ter mudado a tela; senão o caso não prova nada
            inerte = esperado == CS.blocos_do_retrato(gab, secao)
            ok = not difs and not erro_k and not erro_a and total > 0 and not inerte
            tudo_ok &= ok
            aviso = (' (filtro não mudou a tela do Kit)' if inerte else '') + (' (roteiro falhou no Kit)' if erro_k else '') + (' (roteiro falhou no app)' if erro_a else '')
            print('%-18s %-34s %s  %d/%d blocos%s' % (secao, nome, 'OK ' if ok else 'DIF', total - sum(
                1 for l in difs if l.startswith('#### ')), total, aviso))
            linhas_md.append('## %s — %s%s\n\n%s\n' % (nome, 'OK' if ok else 'DIFERENTE', aviso, '\n'.join(difs)))
            for arq in (kit_arq, app_arq):
                os.remove(arq)
        io.open(os.path.join(CS.REVISAO, 'estado_%s.md' % secao), 'w', encoding='utf-8').write(
            '# Estados filtrados: %s\n\n%s' % (secao, '\n'.join(linhas_md)))
    sys.exit(0 if tudo_ok else 1)


if __name__ == '__main__':
    main()

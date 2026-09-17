# -*- coding: utf-8 -*-
"""
Gera app/catalogo/dados.py a partir do Kit congelado (tag gabarito-v1) e do gabarito.

Roda UMA vez para criar o catálogo inicial. Depois disso o catálogo é mantido à mão, no git
(decisão da especificação: estrutura só muda por commit). Rodar de novo sobrescreve — use
--saida para gerar em outro arquivo e comparar.

    python ferramentas/extrair_catalogo.py [--kit C:\\Scripts\\Kit_Relatorio_Vendas_DRE_55Design] [--saida caminho]
"""
import argparse, json, os, pprint, re, sys

from bs4 import BeautifulSoup

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

# grupos e bases por seção — herdados do portal antigo, com a carteira passando a exigir CARTDIN
# (a carteira por status agora vem da carteira dinâmica) e o custo fixo a exigir DPNL (reconciliado)
SECAO_META = {
    'resumo':            ('Comercial', ['DATA', 'DRE', 'DPNL', 'METAS']),
    'evolutiva':         ('Comercial', ['DATA', 'DRE']),
    'ytd':               ('Comercial', ['DATA']),
    'mensal':            ('Comercial', ['DATA']),
    'periodo':           ('Comercial', ['DATA', 'DRE']),
    'performance':       ('Comercial', ['DATA', 'METAS']),
    'vendas':            ('Comercial', ['DATA']),
    'arquitetos':        ('Comercial', ['DATA']),
    'carteira':          ('Comercial', ['DATA', 'CARTDIN']),
    'carteira_dinamica': ('Comercial', ['CARTDIN']),
    'dre':               ('Gestão',    ['DPNL', 'DRE']),
    'custofixo':         ('Gestão',    ['CF']),
    'custofixo_mensal':  ('Gestão',    ['CFMENSAL']),
    'divida':            ('Gestão',    ['DPNL', 'DRE', 'APORTES']),
    'custosx':           ('Fábrica',   ['CUSTOS']),
    'custos':            ('Fábrica',   ['CUSTOS']),
    'estudos':           ('Gestão',    ['FABLOJA']),
}

# blocos que exibem nome de pessoa (cliente, arquiteto, pedido com cliente) — recurso "nomes_pf".
# Heurística inicial pelo id; revisar bloco a bloco antes de a permissão valer.
PADRAO_NOMES = re.compile(r'(cli|rfv|parados|peds|lider|jogo|aq-|arq|cd-status|mn-cli|pe-desig|dre-snap)')


def secoes_do_kit(kit):
    js = open(os.path.join(kit, 'app.js'), encoding='utf-8').read()
    m = re.search(r"const _ALL_SECTIONS=\[(.*?)\];", js, re.S)
    secs = re.findall(r"\['([a-z_]+)','([^']+)'", m.group(1))
    # títulos dos blocos que só existem em estados de filtro (não aparecem no gabarito)
    titulos_codigo = {}
    for t, blk in re.findall(r"H3\('([^']*)',\s*(?:'[^']*'|[^,]*?),\s*'([a-z0-9_-]+)'\)", js):
        titulos_codigo.setdefault(blk, t)
    ids_codigo = set(titulos_codigo)
    for pat in (r'data-blk="([a-z0-9_-]+)"', r"\bB\('([a-z0-9_-]+)'"):
        ids_codigo |= set(re.findall(pat, js))
    rotulos = dict(re.findall(r"'([a-z0-9_-]+)':'([^']+)'", re.search(r"const BLK_LABEL=\{(.*?)\};", js, re.S).group(1)))
    return secs, titulos_codigo, ids_codigo, rotulos, js


def titulos_do_gabarito(html_path):
    import retrato  # ferramentas/ do Kit, posta no sys.path por main()
    dom = retrato.renderizar(html_path)
    soup = BeautifulSoup(dom, 'lxml')
    out = {}
    for h in soup.select('section[id] h3[data-blk]'):
        for tag in h.select('.tag'):
            tag.decompose()
        out.setdefault(h['data-blk'], ' '.join(h.get_text(' ').split()))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kit', default=r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design')
    ap.add_argument('--saida', default=os.path.join(RAIZ, 'app', 'catalogo', 'dados.py'))
    a = ap.parse_args()

    gab = os.path.join(a.kit, '_referencia', 'gabarito', '2026-07')
    secs, tit_cod, ids_cod, rotulos, js = secoes_do_kit(a.kit)
    ret = json.load(open(os.path.join(gab, 'retrato.json'), encoding='utf-8'))
    sys.path.insert(0, os.path.join(a.kit, 'ferramentas'))
    import retrato  # noqa
    tit_dom = titulos_do_gabarito(os.path.join(gab, 'relatorio.html'))

    # seção de cada bloco: pelo gabarito; os que só aparecem com filtro, pela proximidade no código
    secao_de = {}
    for k in ret['ordem']:
        s, b = k.split('/', 1)
        if b != '__abre':
            secao_de.setdefault(b, s)
    for b in ids_cod - set(secao_de):
        pref = b.split('-')[0]
        vizinho = next((s for bb, s in secao_de.items() if bb.startswith(pref + '-')), None)
        secao_de[b] = vizinho or 'custos'

    ordem_gab = [k.split('/', 1)[1] for k in ret['ordem']]
    secoes, blocos = [], []
    for sid, rot in secs:
        grupo, bases = SECAO_META[sid]
        secoes.append({'id': sid, 'titulo': rot, 'grupo': grupo, 'bases': bases})
        blocos.append({'id': sid + '.abertura', 'secao': sid, 'titulo': 'Abertura — título, indicadores e resumo',
                       'bases': bases, 'nomes_pf': False, 'vigencia': '2026-07', 'depende_de': []})
        membros = [b for b in dict.fromkeys(ordem_gab + sorted(ids_cod)) if secao_de.get(b) == sid]
        for b in membros:
            titulo = tit_dom.get(b) or rotulos.get(b) or tit_cod.get(b) or b
            titulo = re.sub(r'\s+', ' ', titulo).strip()
            blocos.append({'id': b, 'secao': sid, 'titulo': titulo, 'bases': bases,
                           'nomes_pf': bool(PADRAO_NOMES.search(b)), 'vigencia': '2026-07', 'depende_de': []})

    cab = ('# -*- coding: utf-8 -*-\n'
           '"""Catálogo de seções e blocos do relatório +55.\n\n'
           'Gerado em 17/09/2026 por ferramentas/extrair_catalogo.py a partir do Kit (tag gabarito-v1).\n'
           'Daqui em diante é mantido À MÃO e só muda por commit: é a estrutura do relatório.\n\n'
           'Bloco: id imutável · secao · titulo · bases (de quais dados depende) · nomes_pf (exibe nome\n'
           'de pessoa; sem o recurso o nome sai mascarado) · vigencia (aaaa-mm em que passou a existir)\n'
           '· depende_de (liberar este bloco libera também estes).\n'
           'Regra: mudou o significado do número -> bloco novo; mudou só a forma -> nova vigência.\n'
           '"""\n\n')
    corpo = 'SECOES = ' + pprint.pformat(secoes, width=110, sort_dicts=False) + '\n\n' + \
            'BLOCOS = ' + pprint.pformat(blocos, width=110, sort_dicts=False) + '\n'
    open(a.saida, 'w', encoding='utf-8').write(cab + corpo)
    print('seções: %d | blocos: %d (%d aberturas) | com nomes de pessoa: %d -> %s'
          % (len(secoes), len(blocos), len(secoes), sum(b['nomes_pf'] for b in blocos), a.saida))


if __name__ == '__main__':
    main()

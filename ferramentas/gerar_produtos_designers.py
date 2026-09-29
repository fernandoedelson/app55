# -*- coding: utf-8 -*-
"""Apresentação HTML "Produtos e designers mais vendidos" — só QUANTIDADES, com filtro de período.

Lê a base comercial de uma competência (data/competencias/<comp>/DATA.json), agrupa as linhas de
venda por modelo e por designer e grava UM arquivo HTML que abre sem a aplicação. Os valores em
reais nem chegam ao arquivo: só entram unidades por mês, modelo e designer.

    python ferramentas/gerar_produtos_designers.py                 # competência mais recente
    python ferramentas/gerar_produtos_designers.py 2026-07 saida.html
"""
import base64
import collections
import io
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO = os.path.join(RAIZ, 'ferramentas', 'produtos_designers.modelo.html')
LOGO = os.path.join(RAIZ, 'app', 'static', 'logo-wide.png')
SAIDA_PADRAO = os.path.join(os.path.dirname(RAIZ), 'Apresentacoes')

# linhas que não são venda de peça
CLASSES_FORA = {'CANCELADO'}
FAMILIAS_FORA = {'Frete/Serviço'}
RE_MEDIDA = re.compile(r'\s*\d{2,5}\s*X\s*\d')          # "540X530X810H": daqui em diante é medida/acabamento
PALAVRAS_PEQUENAS = {'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'em'}


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


def corte(nome):
    """O nome do modelo: o texto do produto até a medida (ou até o primeiro ' - ')."""
    s = re.sub(r'\s+', ' ', nome.upper()).strip()
    m = RE_MEDIDA.search(s)
    s = s[:m.start()] if m else s.split(' - ')[0]
    s = re.sub(r'\bMESA JANTAR\b', 'MESA DE JANTAR', s)
    return re.sub(r'[\s\-]+$', '', s).strip()


def titulo(s):
    """CADEIRA GARÇA -> Cadeira Garça; MK27 e siglas com número ficam como estão."""
    palavras = []
    for i, p in enumerate(s.lower().split()):
        if any(c.isdigit() for c in p) or p in ('ii', 'iii', 'iv'):
            palavras.append(p.upper())
        elif i and p in PALAVRAS_PEQUENAS:
            palavras.append(p)
        else:
            palavras.append(p[:1].upper() + p[1:])
    return ' '.join(palavras)


# o que não é a peça em si: encostos, kits, capas e almofadas de reposição não entram no ranking
ACESSORIOS = {'ENCOSTO', 'KIT', 'CAPA', 'CAPAS', 'ALMOFADA', 'ALMOFADAS', 'PROTETOR', 'PROTETORA', 'REFIL'}
# complementos de um sofá que são outra peça (a mesa e o puff do conjunto Bello)
COMPLEMENTOS_SOFA = ('MESA', 'PUFF', 'APARADOR')
SUFIXOS_DO_MODELO = {'OUTDOOR', 'INDOOR'}                             # fazem parte do nome
ROMANOS = {'II', 'III', 'IV', 'V'}                                        # versões do mesmo modelo: somam (Max II = Max)
MODELOS_COMPOSTOS = {'PAN': ['AM'], 'FORA': ['DA', 'CURVA'], 'MRS': ['SMITH'], 'JET': ['SET']}
TIPOS_DE_MESA = {'DE', 'JANTAR', 'CENTRO', 'CABECEIRA', 'APOIO', 'LATERAL', 'AUXILIAR'}


def modelo(texto, familia):
    """O modelo de uma linha de venda: (chave sem acento, nome para exibir), ou None quando a linha é
    acessório/complemento (fica de fora do ranking, mas é contada à parte)."""
    s = corte(texto)
    if not s:
        return None
    if ' - ' in s:
        base, variante = s.split(' - ', 1)
        if familia == 'Sofá' and variante.strip().startswith(COMPLEMENTOS_SOFA):
            return None
        s = base
    tokens = [t.strip('.,;') for t in s.split() if t.strip('.,;')]
    if familia not in ('Mesa', 'Mesa de apoio') and tokens and sem_acento(tokens[0]) == sem_acento(familia).upper():
        tokens = tokens[1:]              # CADEIRA MAX -> MAX; SOFA PAN AM -> PAN AM; POLTRONA SOFT -> SOFT
    if not tokens or tokens[0] in ACESSORIOS:
        return None
    nome, i = [], 0
    if familia in ('Mesa', 'Mesa de apoio'):
        if tokens[0] == 'MESA':
            nome, i = ['MESA'], 1
        while i < len(tokens) and tokens[i] in TIPOS_DE_MESA and len(nome) < 4:
            nome.append(tokens[i])
            i += 1
        if i >= len(tokens):
            return None
    nome.append(tokens[i])
    i += 1
    resto = MODELOS_COMPOSTOS.get(nome[-1])
    if resto and tokens[i:i + len(resto)] == resto:
        nome += resto
        i += len(resto)
    while i < len(tokens) and (tokens[i] in SUFIXOS_DO_MODELO or tokens[i] in ROMANOS):
        if tokens[i] not in ROMANOS:
            nome.append(tokens[i])
        i += 1
    return sem_acento(' '.join(nome)), titulo(' '.join(nome))


def produto_do_designer(texto, familia):
    """O produto para a abertura do designer: 'Cadeira Capincho', 'Sofá Pan Am', 'Mesa de Jantar Apache'.
    Encostos, kits e capas viram um item só, para a soma do designer fechar."""
    r = modelo(texto, familia)
    if r is None:
        return 'encostos-kits-capas', 'Encostos, kits, capas e complementos'
    chave, exibir = r
    if familia in ('Mesa', 'Mesa de apoio') or exibir.lower().startswith(sem_acento(familia).lower()):
        return chave, exibir
    return sem_acento(familia).upper() + ' ' + chave, familia + ' ' + exibir


def agrupar(linhas, resolver):
    """[(ym, texto, qtd)] -> (nomes, [(ym, idx, qtd)], fora[(ym, qtd)]). `resolver(texto)` devolve
    (chave, nome) ou None (acessório); o nome exibido de cada chave é o mais frequente."""
    total = collections.defaultdict(float)
    nomes = collections.defaultdict(collections.Counter)
    fora = collections.defaultdict(float)
    for ym, texto, q in linhas:
        r = resolver(texto)
        if r is None:
            fora[ym] += q
            continue
        k, exibir = r
        total[(ym, k)] += q
        nomes[k][exibir] += 1
    ordem = sorted(nomes)
    pos = {k: i for i, k in enumerate(ordem)}
    return ([nomes[k].most_common(1)[0][0] for k in ordem], [(ym, pos[k], round(q, 2)) for (ym, k), q in total.items()],
            [(ym, round(q, 2)) for ym, q in fora.items()])


MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']


def _esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def _nf(n):
    return '{:,}'.format(int(n + 0.5)).replace(',', '.')


def _pc(x):
    return ('%.1f' % x).replace('.', ',') + '%'


def _un(q, s, p):
    return s if q == 1 else p


def _somar(linhas, a, b):
    m = collections.OrderedDict()
    for i, k, q in linhas:
        if a <= i <= b:
            m[k] = m.get(k, 0) + q
    return m


def _ordenar(m):
    return sorted([e for e in m.items() if e[1] > 0], key=lambda e: -e[1])


def pre_renderizar(out, meses=24):
    """O HTML do período padrão (últimos `meses`), igual ao que o script desenha ao abrir. A pré-visualização
    do iPhone (WhatsApp, e-mail, Arquivos) não executa JavaScript: sem isto ela mostra a página vazia."""
    yms = out['yms']
    de, ate = max(0, len(yms) - meses), len(yms) - 1
    rot = lambda ym: '%s/%s' % (MES[ym % 100 - 1], str(ym // 100)[2:])
    rot_l = lambda ym: '%s/%d' % (MES[ym % 100 - 1], ym // 100)
    f = {}
    f['de'] = ''.join('<option value="%d"%s>%s</option>' % (i, ' selected' if i == de else '', rot_l(y)) for i, y in enumerate(yms))
    f['ate'] = ''.join('<option value="%d"%s>%s</option>' % (i, ' selected' if i == ate else '', rot_l(y)) for i, y in enumerate(yms))
    f['base'] = rot_l(yms[-1])
    f['per-capa'] = '%s a %s · %d %s' % (rot_l(yms[de]), rot_l(yms[ate]), ate - de + 1, 'mês' if ate == de else 'meses')
    f['per-resumo'] = '(%s a %s)' % (rot(yms[de]), rot(yms[ate]))

    # resumo
    n = ate - de + 1
    aP, bP = max(0, de - n), de - 1
    fam = out['familias']
    atual = _somar(fam['rows'], de, ate)
    ant = _somar(fam['rows'], aP, bP) if bP >= 0 else None
    total = sum(atual.values())
    tot_ant = sum(ant.values()) if ant is not None else None
    var = lambda a, b: (a / b - 1) * 100 if b else None

    def fmt_var_(v):
        if v is None:
            return '<span class="var-0">—</span>'
        cl = 'var-up' if v > 0.05 else 'var-dn' if v < -0.05 else 'var-0'
        return '<span class="%s">%s%s%%</span>' % (cl, '+' if v > 0 else '', ('%.1f' % v).replace('.', ','))

    def cartao(rotulo, nome):
        q = atual.get(fam['nomes'].index(nome), 0) if nome in fam['nomes'] else 0
        return '<div class="card"><div class="l">%s</div><div class="v">%s</div><div class="d">unidades</div></div>' % (rotulo, _nf(q))
    f['numeros'] = ('<div class="card"><div class="l">Peças vendidas</div><div class="v">%s</div><div class="d">%s</div></div>'
                    % (_nf(total), 'sem período anterior' if tot_ant is None else fmt_var_(var(total, tot_ant)) + ' vs. anterior')
                    + cartao('Cadeiras', 'Cadeira') + cartao('Mesas', 'Mesa') + cartao('Sofás', 'Sofá') + cartao('Poltronas', 'Poltrona'))
    lista = _ordenar(atual)
    mx = lista[0][1] if lista else 1
    TOPO = 7

    def linha(k, q):
        a = ant.get(k, 0) if ant is not None else None
        return ('<tr><td>%s</td><td><i class="barra-mini" style="width:%dpx"></i>%s</td><td class="c-pct">%s</td><td class="c-ant">%s</td><td>%s</td></tr>'
                % (_esc(fam['nomes'][k]), int(80 * q / mx + 0.5), _nf(q), _pc(100 * q / total), '—' if a is None else _nf(a),
                   fmt_var_(None if a is None else var(q, a))))
    resto = lista[TOPO:]
    outras = ''
    if resto:
        q = sum(e[1] for e in resto)
        a = sum(ant.get(e[0], 0) for e in resto) if ant is not None else None
        outras = ('<tr class="outras"><td>Demais %d famílias</td><td>%s</td><td class="c-pct">%s</td><td class="c-ant">%s</td><td>%s</td></tr>'
                  % (len(resto), _nf(q), _pc(100 * q / total), '—' if a is None else _nf(a), fmt_var_(None if a is None else var(q, a))))
    f['tab-fam'] = ('<thead><tr><th>Família</th><th>Unidades</th><th class="c-pct">% do total</th><th class="c-ant">Período anterior</th><th>Variação</th></tr></thead><tbody>'
                    + ''.join(linha(k, q) for k, q in lista[:TOPO]) + outras + '</tbody>')
    f['sub-resumo'] = ('Comparado com %s a %s.' % (rot_l(yms[aP]), rot_l(yms[bP]))) if ant is not None else 'Não há meses anteriores para comparar.'

    # rankings
    def ranking(id_, dados, unidade, artigo, limite, sel=None, com_destaque=True):
        lst = _ordenar(_somar(dados['rows'], de, ate))
        tot = sum(e[1] for e in lst)
        fora = sum(q for i, q in dados.get('fora', []) if de <= i <= ate)
        if id_ != 'des':
            f['n-' + id_] = ('Não entram no ranking: %s %s de encostos, kits, capas, almofadas e complementos (mesa e puff do conjunto).'
                             % (_nf(fora), _un(fora, 'peça', 'peças'))) if fora > 0 else ''
        if not lst:
            f['r-' + id_] = ''; f['m-' + id_] = ''
            f['d-' + id_] = '<p class="vazio">Nenhuma venda neste período.</p>'
            return lst
        topo, mx_ = lst[0], lst[0][1]
        if com_destaque:
            emp = [e for e in lst if e[1] == mx_]
            fem, plural = artigo == 'A', len(emp) > 1
            frase = (('Empate entre as mais vendidas' if fem else 'Empate entre os mais vendidos') + ' do período:') if plural \
                else artigo + ' mais vendid' + ('a' if fem else 'o') + ' do período:'
            f['d-' + id_] = ('<div class="destaque"><span>%s</span> <b>%s</b> <span>%s %s%s</span></div>'
                             % (frase, ' e '.join(_esc(dados['nomes'][e[0]]) for e in emp), _nf(mx_), _un(mx_, *unidade), ' cada' if plural else ''))
        mostra = lst[:limite]
        itens = []
        for i, (k, q) in enumerate(mostra):
            attrs = ''
            if id_ == 'des':
                attrs = ' data-i="%d" tabindex="0" role="button"' % k + (' class="sel" aria-pressed="true"' if k == sel else ' aria-pressed="false"')
            itens.append('<li%s><span class="n">%d</span><span class="nome">%s</span><span class="fio"><i style="width:%s%%"></i></span>'
                         '<span class="q"><b>%s</b> %s<small>%s</small></span></li>'
                         % (attrs, i + 1, _esc(dados['nomes'][k]), ('%.1f' % (100 * q / mx_)), _nf(q), _un(q, *unidade), _pc(100 * q / tot)))
        f['r-' + id_] = ''.join(itens)
        f['m-' + id_] = '<button class="mais" type="button">Mostrar todos (%d)</button>' % len(lst) if len(lst) > limite else ''
        return lst

    for id_, chave, art in (('cad', 'cadeira', 'A'), ('mes', 'mesa', 'A'), ('sof', 'sofa', 'O')):
        ranking(id_, out[chave], ('unidade', 'unidades'), art, 10)
    des = out['designers']
    ld = ranking('des', des, ('peça', 'peças'), 'O', 8, sel=_somar(des['rows'], de, ate) and _ordenar(_somar(des['rows'], de, ate))[0][0], com_destaque=False)

    # painel do primeiro designer
    if ld:
        sel, total_d = ld[0]
        por = collections.OrderedDict()
        for i, d, k, q in des['prod']:
            if d == sel and de <= i <= ate:
                por[k] = por.get(k, 0) + q
        prod = _ordenar(por)
        mxp, TOP = (prod[0][1] if prod else 1), 12
        vistos, sobra = prod[:TOP], sum(e[1] for e in prod[TOP:])
        f['p-des'] = ('<h3>%s<small>%s %s em %d %s</small></h3><ul class="prod">%s%s</ul>'
                      % (_esc(des['nomes'][sel]), _nf(total_d), _un(total_d, 'peça', 'peças'), len(prod), _un(len(prod), 'produto', 'produtos'),
                         ''.join('<li><span>%s</span><span class="fio"><i style="width:%s%%"></i></span><span class="q"><b>%s</b> · %s</span></li>'
                                 % (_esc(des['prodNomes'][k]), '%.1f' % (100 * q / mxp), _nf(q), _pc(100 * q / total_d)) for k, q in vistos),
                         ('<li class="outros"><span>Outros %d produtos</span><span></span><span class="q">%s</span></li>' % (len(prod) - TOP, _nf(sobra))) if sobra > 0 else ''))
    else:
        f['p-des'] = ''
    return f


def gerar(codigo=None, saida=None, raiz_dados=None):
    raiz_dados = raiz_dados or os.path.join(RAIZ, 'data', 'competencias')
    codigo = codigo or sorted(d for d in os.listdir(raiz_dados) if os.path.isdir(os.path.join(raiz_dados, d)))[-1]
    d = json.load(io.open(os.path.join(raiz_dados, codigo, 'DATA.json'), encoding='utf-8'))
    fam, cls, prod, ds = d['fam'], d['cls'], d['prod'], d['ds']

    por_familia = collections.defaultdict(float)
    linhas = {'Cadeira': [], 'Mesa': [], 'Sofá': []}
    designers = []                        # (ym, designer, produto_chave, produto_nome, qtd)
    for r in d['rows']:
        ym, q, f = r[0], r[2], fam[r[4]]
        if cls[r[6]] in CLASSES_FORA or f in FAMILIAS_FORA:
            continue
        por_familia[(ym, f)] += q
        if f in linhas:
            linhas[f].append((ym, prod[r[17]], q))
        if r[7] >= 0:
            pk, pn = produto_do_designer(prod[r[17]], f)
            designers.append((ym, ds[r[7]], pk, pn, q))

    yms = sorted({ym for ym, _ in por_familia})
    ym_idx = {ym: i for i, ym in enumerate(yms)}

    def ajustar(rows):
        return [[ym_idx[ym], i, q] for ym, i, q in rows if ym in ym_idx]

    out = {'yms': yms}
    for chave, familia in (('cadeira', 'Cadeira'), ('sofa', 'Sofá'), ('mesa', 'Mesa')):
        nomes, rows, fora = agrupar(linhas[familia], lambda t, f=familia: modelo(t, f))
        out[chave] = {'nomes': nomes, 'rows': ajustar(rows),
                      'fora': [[ym_idx[ym], q] for ym, q in fora if ym in ym_idx]}
    dchave = lambda t: sem_acento(t.upper().strip())
    nomes, rows, _ = agrupar([(ym, t, q) for ym, t, _pk, _pn, q in designers], lambda t: (dchave(t), titulo(t)))
    # a mesma chave do agrupar: o índice do designer é a posição na ordem alfabética das chaves
    ordem = sorted({dchave(t) for _, t, *_ in designers})
    dpos = {k: i for i, k in enumerate(ordem)}
    pnomes, ppos, tot = [], {}, collections.defaultdict(float)
    for ym, t, pk, pn, q in designers:
        if pk not in ppos:
            ppos[pk] = len(pnomes)
            pnomes.append(pn)
        tot[(ym, dpos[dchave(t)], ppos[pk])] += q
    out['designers'] = {'nomes': nomes, 'rows': ajustar(rows), 'fora': [], 'prodNomes': pnomes,
                        'prod': [[ym_idx[ym], di, pi, round(q, 2)] for (ym, di, pi), q in tot.items() if ym in ym_idx]}
    fams = sorted({f for _, f in por_familia})
    out['familias'] = {'nomes': fams, 'rows': ajustar([(ym, fams.index(f), round(q, 2)) for (ym, f), q in por_familia.items()])}

    logo = 'data:image/png;base64,' + base64.b64encode(open(LOGO, 'rb').read()).decode('ascii')
    html = io.open(MODELO, encoding='utf-8').read()
    assert html.count('/*__DADOS__*/null') == 1 and html.count('__LOGO__') == 1
    html = html.replace('/*__DADOS__*/null', json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))
    html = html.replace('__LOGO__', logo)
    for chave, trecho in pre_renderizar(out).items():
        marca = '<!--SSR:%s-->' % chave
        assert html.count(marca) == 1, chave
        html = html.replace(marca, trecho)
    assert '<!--SSR:' not in html
    saida = saida or os.path.join(SAIDA_PADRAO, 'Produtos_e_Designers_%s.html' % codigo)
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    io.open(saida, 'w', encoding='utf-8', newline='').write(html)
    return saida, out


if __name__ == '__main__':
    destino, dados = gerar(*(sys.argv[1:3]))
    print(destino)
    print('meses: %d..%d · modelos: %d cadeiras, %d mesas, %d sofás · %d designers'
          % (dados['yms'][0], dados['yms'][-1], len(dados['cadeira']['nomes']), len(dados['mesa']['nomes']),
             len(dados['sofa']['nomes']), len(dados['designers']['nomes'])))

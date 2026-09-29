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

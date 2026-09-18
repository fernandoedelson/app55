# -*- coding: utf-8 -*-
"""
+55 Design — Gerador do Relatório Interativo de Vendas e DRE
=============================================================
Lê as planilhas-fonte em ./fontes, extrai toda a inteligência e regenera o
arquivo HTML interativo (único, offline). Para atualizar o relatório, basta
substituir as planilhas em ./fontes pelas versões novas e rodar este script.

USO:
    python gerar_relatorio.py

REQUISITOS:
    Python 3.9+  e  openpyxl   ->   pip install openpyxl

FONTES ESPERADAS (na pasta ./fontes):
    1) "Controle ADM de Vendas 55 ...xlsx"  (base comercial; aba Controle_Comercial)
    2) "Painel Resultado 55 Design ...xlsm"  (DRE; abas REAL {ano} - {entidade})

DADOS DA APRESENTAÇÃO:
    config_apresentacao.json  -> carteira (status/orçado da apresentação) e custo
    fixo por categoria. Atualize quando houver nova apresentação trimestral.

FONTES DE CUSTO (seção "Custos"):
    Lidas de ./fontes/Custos (CPV_Acumulado.xlsx, NDPRO359.xlsx, NDVAL666.xlsx,
    Razão CC.xlsx, Valorização_Ordens.xlsx). Atualize as planilhas nessa pasta para
    refletir no relatório. Pode ser sobrescrito com a variável de ambiente CUSTOS_DIR.

FONTE DA CARTEIRA DINÂMICA (seção "Carteira dinâmica", opcional):
    fontes/VENDAS LOJA 2025.xlsx (aba "VENDAS GERAL"). Se ausente, a seção não é gerada.

FONTE DAS METAS DE VENDA (seção "Performance Comercial", opcional):
    fontes/Metas Vendas 2026.xlsx (colunas "Data" e "Vendas Previstas", uma linha por mês).
    Se ausente, a seção não é gerada. Troque pela planilha do ano novo e o relatório acompanha.

FONTE DA DÍVIDA COM O ACIONISTA (seção "Dívida e endividamento", opcional):
    fontes/Aportes.xlsx (aba "BD Nova"), saldo diário corrigido. Se ausente, a seção
    mostra só a leitura de geração de endividamento a partir da DRE, sem o saldo real.

SAÍDA:
    Analise_Vendas_e_DRE_55Design.html
"""
import openpyxl, json, unicodedata, datetime, glob, os, re, sys, difflib, calendar
from openpyxl.utils.datetime import to_excel
from collections import defaultdict

AQUI   = os.path.dirname(os.path.abspath(__file__))
FONTES = os.path.join(AQUI, 'fontes')
FONTES_CUSTOS = os.environ.get('CUSTOS_DIR') or os.path.join(FONTES, 'Custos')
SAIDA  = os.path.join(AQUI, 'Analise_Vendas_e_DRE_55Design.html')

def achar_estrito(padroes, pasta=None):
    """Como achar(), mas sem o fallback "qualquer arquivo da extensão": base ausente é base ausente."""
    pasta = pasta or FONTES
    for pad in padroes:
        achados = sorted([f for f in glob.glob(os.path.join(pasta, pad)) if not os.path.basename(f).startswith('~$')],
                         key=os.path.getmtime, reverse=True)
        if achados: return achados[0]
    return None

def data_posicao(chave, path):
    """Data de posição de uma base (dd/mm/aaaa). Vem de config_apresentacao.json > datas_posicao,
    que é o que quem sobe a base declara; sem declaração, usa a data de gravação do arquivo e avisa."""
    try:
        cfg = json.load(open(os.path.join(AQUI, 'config_apresentacao.json'), encoding='utf-8'))
        d = (cfg.get('datas_posicao') or {}).get(chave)
        if d: return d
    except Exception:
        pass
    d = datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%d/%m/%Y')
    print('    AVISO: data de posição de "%s" não declarada em config_apresentacao.json > datas_posicao; usando a data do arquivo (%s)' % (chave, d))
    return d

def achar(padroes, ext, pasta=None):
    pasta = pasta or FONTES
    def semlock(lista): return [f for f in lista if not os.path.basename(f).startswith('~$')]
    for pad in padroes:
        achados = sorted(semlock(glob.glob(os.path.join(pasta, pad))), key=os.path.getmtime, reverse=True)
        if achados: return achados[0]
    # fallback: qualquer arquivo da extensão
    achados = sorted(semlock(glob.glob(os.path.join(pasta, '*'+ext))), key=os.path.getmtime, reverse=True)
    return achados[0] if achados else None

# ---------------- helpers de valor ----------------
def num(v):
    if isinstance(v,(datetime.datetime,datetime.date)):
        try: return float(to_excel(v))
        except: return None
    return float(v) if isinstance(v,(int,float)) else None
def nm(v):
    s=str(v).strip() if v is not None else ''
    return None if s in ('','-') else s
def dtv(v): return v if isinstance(v,(datetime.datetime,datetime.date)) else None
def _espacos(s):
    """Normaliza espaco nao-quebravel (NBSP) e sequencias de espacos.

    Sem isto, a conta 320200100000035 aparece na base com dois nomes que so diferem por NBSP
    no lugar de espaco comum, e o mesmo item sairia como duas linhas no detalhe."""
    if not s: return s
    return ' '.join(str(s).replace(chr(160), ' ').split())
def _norm(s):
    if not isinstance(s,str): return ''
    return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().upper().strip()
def _chave_nome(s):
    """Chave de comparação p/ nomes (vendedor/cliente/arquiteto): espaço+acento+caixa-insensível."""
    return _norm(_espacos(s))
# Palavras genéricas (forma jurídica e ramo de atuação) descartadas SÓ no cálculo de similaridade
# do relatório de proximidade. Sem isto "STUDIO L ARQUITETURA LTDA" e "STUDIO DF ARQUITETURA LTDA"
# batem 94% — quase toda a string é palavra genérica —, quando o que os distingue é "L" x "DF".
# Não afeta a indexação nem o de-para: os nomes seguem inteiros na base e no relatório.
SIM_STOPWORDS = {
    # forma jurídica
    'LTDA','LTD','ME','EPP','MEI','EIRELI','SA','S/A','S/S','SS','CIA','E','DE','DA','DO','DAS','DOS',
    # ramo de atuação
    'ARQUITETURA','ARQUITETURAS','ARQUITETO','ARQUITETOS','STUDIO','STUDIOS','ESTUDIO','ESTUDIOS',
    'DESIGN','INTERIORES','DECORACAO','DECORACOES','COMERCIO','SERVICO','SERVICOS','SERV',
    'PARTICIPACOES','EMPREENDIMENTOS','IMOBILIARIOS','IMOBILIARIA','PROJETOS','HOLDING',
}
def _chave_similaridade(s):
    """Chave usada só para MEDIR proximidade: remove as palavras genéricas de SIM_STOPWORDS,
    deixando o que de fato identifica a entidade. Se sobrar vazio (nome feito só de genéricos),
    cai de volta na chave completa, senão todos esses nomes casariam entre si."""
    k = _chave_nome(s) or ''
    toks = [t for t in ''.join(c if c.isalnum() else ' ' for c in k.replace('&',' E ')).split()
            if t not in SIM_STOPWORDS]
    return ' '.join(toks) or k
def relatorio_proximidade(nome, lista, limiar=0.86, top=40):
    """Aponta pares de nomes parecidos que sobraram como entradas distintas mesmo depois da
    normalização automática (espaço/acento/caixa) — apoio para curar fontes/Apelidos.xlsx.
    Item 10.5 da ata de 26/08/2026: verificação por proximidade, mas como relatório para
    decisão humana, nunca fusão automática (evita juntar duas pessoas/clientes diferentes que
    só coincidem no nome). Comparação limitada a nomes com o mesmo prefixo normalizado de 3
    caracteres, para não explodir em O(n²) em bases de milhares de clientes."""
    blocos = defaultdict(list)
    for a in lista:
        k = _chave_similaridade(a)
        if k: blocos[k[:3]].append((a, k))
    pares = []
    for grupo in blocos.values():
        for i in range(len(grupo)):
            for j in range(i+1, len(grupo)):
                a, ka = grupo[i]; b, kb = grupo[j]
                r = difflib.SequenceMatcher(None, ka, kb).ratio()
                if r >= limiar: pares.append((r, a, b))
    pares.sort(key=lambda x: -x[0])
    if pares:
        print(f'  aviso: {len(pares)} par(es) de nome(s) parecido(s) em "{nome}" — revisar p/ fontes/Apelidos.xlsx:')
        for r, a, b in pares[:top]:
            print(f'    {r:.0%}  "{a}"  x  "{b}"')
        if len(pares) > top:
            print(f'    ... e mais {len(pares)-top} par(es).')
    return pares
def d_only(v):
    if isinstance(v,datetime.datetime): return v.date()
    if isinstance(v,datetime.date): return v
    return None

def familia(prod):
    if not prod: return 'Outros'
    s=unicodedata.normalize('NFKD',str(prod).upper()).encode('ascii','ignore').decode()
    h=lambda *w: any(x in s for x in w)
    if h('FRETE','SERVIC','MONTAGEM','PROJETO','DESLOC'): return 'Frete/Serviço'
    if h('SOFA'): return 'Sofá'
    if h('BANQUETA'): return 'Banqueta'
    if h('POLTRONA'): return 'Poltrona'
    if h('CADEIRA'): return 'Cadeira'
    if h('MESA DE APOIO','MESA APOIO','MESA LATERAL','MESA DE CANTO','MESA DE CENTRO','LATERAL'): return 'Mesa de apoio'
    if h('MESA'): return 'Mesa'
    if h('APARADOR'): return 'Aparador'
    if h('PUFF','POUF','PUF '): return 'Puff'
    if h('BUFFET','BUFE'): return 'Buffet'
    if h('BANCO'): return 'Banco'
    if h('LUMINARIA','PENDENTE','ABAJUR','ARANDELA','LUSTRE'): return 'Luminária'
    if h('ESCRIVANINHA'): return 'Escrivaninha'
    if h('BIOMBO'): return 'Biombo'
    if h('ESTANTE'): return 'Estante'
    if h('CARRINHO'): return 'Carrinho'
    if h('TAPETE'): return 'Tapete'
    if h('BALANCO'): return 'Balanço'
    if h('ESPELHO'): return 'Espelho'
    return 'Outros'

class Enc:
    """Indexador de nomes. `canon` (opcional) agrupa por chave normalizada — usado para
    vendedor/cliente/arquiteto, onde 'Carla' e 'CARLA ' devem virar a mesma entrada; as demais
    listas (família, classe, designer, pedido, produto) seguem exatas como antes."""
    def __init__(s, canon=None): s.m={}; s.l=[]; s.canon=canon or (lambda x: x)
    def i(s,x):
        x=x or 'Não informado'
        k=s.canon(x)
        if k not in s.m: s.m[k]=len(s.l); s.l.append(x)
        return s.m[k]

def carregar_apelidos():
    """De-para manual de nomes (fontes/Apelidos.xlsx, opcional). Colunas: tipo
    (vendedor/cliente/arquiteto), nome_como_esta, nome_canonico. Cobre casos de julgamento que a
    normalização automática de espaço/acento/caixa não resolve — ex.: 'Carla - Expo' tratado
    como pseudônimo de canal de exportação em vez de vendedora nova (item 2.4/10.5 da ata de
    26/08/2026). Curado a partir do relatório de proximidade impresso ao gerar o relatório."""
    mapa = {'vendedor':{}, 'cliente':{}, 'arquiteto':{}}
    # caminho exato, sem achar(): o glob 'Apelidos*.xlsx' também casaria com a planilha de
    # trabalho Apelidos_Candidatos.xlsx (que tem as mesmas 3 primeiras colunas, mas com pares
    # ainda NÃO revisados) e, sendo mais recente, venceria por mtime — aplicando silenciosamente
    # centenas de fusões não aprovadas. O fallback de achar() é igualmente perigoso aqui: sem
    # Apelidos.xlsx ele devolveria qualquer .xlsx da pasta (a própria base comercial, por ex.).
    path = os.path.join(FONTES, 'Apelidos.xlsx')
    if not os.path.exists(path): return mapa
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    total = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or len(r) < 3 or not r[0] or not r[1] or not r[2]: continue
        tipo, de, para = nm(r[0]), nm(r[1]), nm(r[2])
        if tipo and de and para and tipo in mapa:
            mapa[tipo][_chave_nome(de)] = para; total += 1
    wb.close()
    if total: print('  de-para apelidos:', total, 'nomes carregados de', os.path.basename(path))
    return mapa

def carregar_designers():
    """De-para Razão Social -> Nome do designer (fontes/Designers.xlsx). Opcional: se ausente, usa a razão social."""
    path = achar(['Designers*.xlsx'], '.xlsx')
    if not path: return {}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    mapa = {}
    for r in ws.iter_rows(min_row=1, values_only=True):
        if not r or not r[0] or not r[1]: continue
        razao, nome = nm(r[0]), nm(r[1])
        if razao and nome and razao != 'Razão Social Designer': mapa[razao] = nome
    wb.close()
    print('  de-para designers:', len(mapa), 'nomes carregados de', os.path.basename(path))
    return mapa

# ---------------- 1) BASE COMERCIAL ----------------
def parse_vendas(path):
    print('  base comercial:', os.path.basename(path))
    designers = carregar_designers()
    apelidos = carregar_apelidos()
    def apelido(tipo, s):
        """Aplica o de-para manual (fontes/Apelidos.xlsx) antes de indexar o nome."""
        if not s: return s
        return apelidos[tipo].get(_chave_nome(s), s)
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['Controle_Comercial'] if 'Controle_Comercial' in wb.sheetnames else wb[wb.sheetnames[0]]
    data=list(ws.iter_rows(min_row=4, values_only=True)); wb.close()
    C=dict(focco=4,dsl=2,dsf=3,ped=5,prev=6,prod=10,classe=12,qnt=13,venda=14,nf=15,cli=18,vend=19,
           cpf=22,dsr=23,prem=25,vpj=33,cger=41,rp=46,cur=48,
           a1=60,a1v=55,a2=67,a2v=62,a3=74,a3v=69,a4=81,a4v=76,desg=88,roy=83)
    # vendedor/cliente/arquiteto usam Enc com chave normalizada (espaço/acento/caixa) — camada 1
    # da auditoria de nomes (item 10.5). O de-para manual (apelido) roda antes, para casos de
    # julgamento como "Carla - Expo" que a normalização automática não resolve.
    VD,CL,ARQ=Enc(_chave_nome),Enc(_chave_nome),Enc(_chave_nome)
    FAM,CLS,DS,PED,PROD=Enc(),Enc(),Enc(),Enc(),Enc()
    rows=[]; tot=0.0
    for r in data:
        v=num(r[C['venda']]); d=dtv(r[C['ped']])
        if v is None or not d: continue
        ym=d.year*100+d.month
        vd=VD.i(apelido('vendedor',nm(r[C['vend']]))); prod_desc=nm(r[C['prod']]); fm=FAM.i(familia(prod_desc))
        cl=CL.i(apelido('cliente',nm(r[C['cli']]))); cls=CLS.i(nm(r[C['classe']]))
        dsn=nm(r[C['desg']]); dsn=designers.get(dsn,dsn) if dsn else dsn; ds=DS.i(dsn) if dsn else -1
        R=lambda x: round(x or 0)
        arqs=[]
        for ncol,vcol in [('a1','a1v'),('a2','a2v'),('a3','a3v'),('a4','a4v')]:
            an=apelido('arquiteto',nm(r[C[ncol]]))
            if an: arqs.append([ARQ.i(an), R(num(r[C[vcol]]))])
        pk=nm(r[C['focco']]) or nm(r[C['dsl']]) or nm(r[C['dsf']])
        pd=PED.i(pk) if pk else -1
        pv=dtv(r[C['prev']])
        rows.append([ym,R(v),round((num(r[C['qnt']]) or 0),2),vd,fm,cl,cls,ds,R(num(r[C['roy']])),
                     R(num(r[C['cpf']])),R(num(r[C['dsr']])),R(num(r[C['prem']])),R(num(r[C['vpj']])),
                     R(num(r[C['cger']])),R(num(r[C['cur']])),pd,arqs,
                     PROD.i(prod_desc), pv.strftime('%d/%m/%Y') if pv else None])
        tot+=v
    # carteira base-derived (pendente = sem NF), aging vs 30/06 do ano/mês mais recente
    ref=None
    for r in data:
        d=dtv(r[C['ped']])
        if d: ref = d.date() if ref is None else max(ref, d.date())
    ref = ref or datetime.date(2026,6,30)
    cart_aging=defaultdict(lambda:[0.0,0]); cart_vend=defaultdict(lambda:[0.0,0]); cart_ped={}; cart_total=0.0
    for r in data:
        v=num(r[C['venda']]); d=dtv(r[C['ped']])
        if v is None or v<=0 or not d: continue
        if d_only(r[C['nf']]) is not None: continue
        cart_total+=v
        prev=d_only(r[C['prev']])
        if prev is None: bucket='Sem previsão'
        elif prev>=ref: bucket='A vencer'
        else:
            dd=(ref-prev).days
            bucket='1-30 dias' if dd<=30 else '31-60 dias' if dd<=60 else '61-90 dias' if dd<=90 else '>90 dias'
        cart_aging[bucket][0]+=v; cart_aging[bucket][1]+=1
        vn=apelido('vendedor',nm(r[C['vend']])) or 'Não informado'; cart_vend[vn][0]+=v; cart_vend[vn][1]+=1
        pk=nm(r[C['focco']]) or nm(r[C['dsl']]) or nm(r[C['dsf']]) or ''; cli=apelido('cliente',nm(r[C['cli']])) or ''
        if pk:
            if pk not in cart_ped: cart_ped[pk]=[cli,vn,0.0]
            cart_ped[pk][2]+=v
    order=['A vencer','1-30 dias','31-60 dias','61-90 dias','>90 dias','Sem previsão']
    # série histórica de carteira: saldo em aberto no fim de cada mês, reconstruído da data do
    # pedido e da data da NF (mesmo critério "pendente = sem NF" da foto atual, aplicado a cada
    # mês-fim passado em vez de só a hoje). Item 5.1 da ata de 26/08/2026.
    ped_nf=[(d_only(r[C['ped']]),d_only(r[C['nf']]),num(r[C['venda']])) for r in data
            if num(r[C['venda']]) and num(r[C['venda']])>0 and d_only(r[C['ped']]) is not None]
    if ped_nf:
        ini=min(p[0] for p in ped_nf); ym_ini=ini.year*100+ini.month; ym_fim=ref.year*100+ref.month
        yms_hist=[]; y,m=divmod(ym_ini,100)
        while y*100+m<=ym_fim:
            yms_hist.append(y*100+m); m+=1
            if m>12: m=1; y+=1
        def _fim_mes(ym):
            yy,mm=divmod(ym,100); return datetime.date(yy,mm,calendar.monthrange(yy,mm)[1])
        hist_yms=[]; hist_val=[]
        for ym in yms_hist:
            me=_fim_mes(ym)
            saldo=sum(v for (pd,nf,v) in ped_nf if pd<=me and (nf is None or nf>me))
            hist_yms.append(ym); hist_val.append(round(saldo))
        carteira_hist=dict(yms=hist_yms, valor=hist_val)
    else:
        carteira_hist=dict(yms=[], valor=[])
    carteira=dict(total=round(cart_total),
        aging=[[b,round(cart_aging[b][0]),cart_aging[b][1]] for b in order if b in cart_aging],
        vend=sorted([[k,round(v[0]),v[1]] for k,v in cart_vend.items()],key=lambda x:-x[1])[:12],
        peds=sorted([[k,c[0],c[1],round(c[2])] for k,c in cart_ped.items()],key=lambda x:-x[3])[:15],
        hist=carteira_hist)
    print('    linhas de venda:', len(rows), '| total R$ %s' % format(tot,',.0f'), '| ref carteira', ref)
    # camada 3 da auditoria de nomes: relatório de proximidade p/ revisão manual (item 10.5)
    relatorio_proximidade('vendedores', VD.l)
    relatorio_proximidade('clientes', CL.l)
    relatorio_proximidade('arquitetos/RTs', ARQ.l)
    return dict(vd=VD.l,fam=FAM.l,cl=CL.l,cls=CLS.l,ds=DS.l,arq=ARQ.l,prod=PROD.l,rows=rows,
                total=round(tot),ncli=len(CL.l),carteira=carteira)

# ---------------- 2) DRE (P&L por entidade) ----------------
DRE_TARGETS=[
 ('deducoes', lambda s: s.startswith('(-) DEDUCOES')),
 ('receita_liquida', lambda s: s=='RECEITA OPERACIONAL LIQUIDA'),
 ('custos_var', lambda s: s=='CUSTOS VARIAVEIS'),
 ('margem_contrib', lambda s: s=='MARGEM DE CONTRIBUICAO'),
 ('despesas_op', lambda s: s=='DESPESAS OPERACIONAIS'),
 ('ebitda', lambda s: s=='EBITDA'),
 ('deprec', lambda s: s=='DEPRECIACAO E AMORTIZACAO'),
 ('financeiro', lambda s: s=='DESPESAS/RECEITAS FINANCEIRAS'),
 ('result_op', lambda s: s=='RESULTADO OPERACIONAL'),
 ('result_liq', lambda s: s=='RESULTADO LIQUIDO'),
 ('cpv', lambda s: s=='CUSTO DO PRODUTO VENDIDO'),
 ('volume', lambda s: s=='VOLUME'),
 ('gvv', lambda s: s=='GASTOS VARIAVEIS COM VENDAS'),
 ('endividamento', lambda s: s=='ENDIVIDAMENTO'),
 ('juros_passivos', lambda s: s=='JUROS PASSIVOS A TERCEIROS'),
]
def _extrai_sheet(wb, sh):
    ws=wb[sh]; rows=list(ws.iter_rows(values_only=True)); janc=None
    for r in rows[:14]:
        for j,c in enumerate(r):
            if isinstance(c,str) and c.strip().upper()=='JAN': janc=j; break
        if janc is not None: break
    if janc is None: return None
    def mrow(r): return [(r[janc+k] if janc+k<len(r) and isinstance(r[janc+k],(int,float)) else 0) for k in range(12)]
    def desc(r):
        for c in r[:4]:
            if isinstance(c,str) and c.strip(): return c
        return None
    out={}
    for i,r in enumerate(rows):
        if _norm(desc(r))=='RECEITA MERCADO INTERNO' and i>0:
            out['receita_bruta']=mrow(rows[i-1]); break
    for key,match in DRE_TARGETS:
        for r in rows:
            d=desc(r)
            if d and match(_norm(d)): out[key]=mrow(r); break
    return out
def parse_dre(path):
    print('  DRE:', os.path.basename(path))
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    ENT={'CONSOLIDADO':'CONSOLIDADO','FABRICA':'55 FABRICA','DESIGN':'55 DESIGN'}
    dpnl={}
    # anos lidos das próprias abas (sem faixa fixa de anos): "REAL 2027 - CONSOLIDADO" entra sozinha
    alvo={epat:ek for ek,epat in ENT.items()}
    for sh in wb.sheetnames:
        m=re.fullmatch(r'REAL (\d{4}) - (.+)', sh.strip())
        if not m or m.group(2) not in alvo: continue
        ex=_extrai_sheet(wb,sh)
        if ex: dpnl.setdefault(alvo[m.group(2)],{})[m.group(1)]=ex
    for ek in dpnl: dpnl[ek]=dict(sorted(dpnl[ek].items()))
    wb.close()
    anos=sorted(dpnl.get('CONSOLIDADO',{}).keys())
    print('    entidades:', list(dpnl.keys()), '| anos consolidado:', anos)
    return dpnl
def derivar_receita(dpnl):
    """DRE (receita bruta consolidada) para o gráfico da evolutiva."""
    DRE={}
    for y,d in dpnl.get('CONSOLIDADO',{}).items():
        rb=d.get('receita_bruta',[0]*12)
        DRE[y]={'months':rb,'annual':round(sum(rb),2)}
    return DRE

def aba_bd(wb):
    """Nome da aba de razão do Painel (hoje "_BD2024"). Achada pelo prefixo "_BD": se a aba for
    renomeada (ex.: "_BD2027"), a DRE não corta num mês velho sem avisar. Com mais de uma,
    vence a de maior número no nome."""
    cand=[s for s in wb.sheetnames if s.upper().startswith('_BD')]
    if not cand: return None
    return sorted(cand, key=lambda s: int(re.sub(r'\D','',s) or 0))[-1]

def max_ym_bd2024(path):
    """Último mês com lançamento na coluna DATA da aba _BD (Painel de Resultado) — usado
    para saber até quando a DRE está alimentada, sem depender de mês fixo no código/app.js."""
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    bd=aba_bd(wb)
    if not bd:
        print('  AVISO: aba _BD não encontrada no Painel — o último mês da DRE será deduzido da série')
        wb.close(); return None
    maxd=None
    for r in wb[bd].iter_rows(min_row=2, values_only=True, max_col=2):
        d=dtv(r[1]) if r else None
        if d and (maxd is None or d>maxd): maxd=d
    wb.close()
    return maxd.year*100+maxd.month if maxd else None

def parse_aportes():
    """Saldo da dívida com o acionista (fontes/Aportes.xlsx, aba 'BD Nova').

    As colunas prontas 'Saldo' e 'Correção + Princ.' têm um bug de sinal na própria planilha-fonte
    (ficam negativas, sem motivo, de 01/02/2023 a 31/12/2025 — verificado célula a célula). Por isso
    o saldo é reconstruído aqui a partir de duas colunas que continuam corretas o período inteiro:
    REMESSAS/RECEBIMENTOS (movimentação de caixa) e 'Correção e Juros' (correção do dia, sempre
    positiva). Acumulando as duas dá exatamente o saldo real, já separado em aporte × correção
    (validado batendo em centavos com a última linha da planilha: R$73.523.825,20 em 31/07/2026)."""
    path = achar(['Aportes*.xlsx'], '.xlsx')
    if not path:
        print('  ("Aportes.xlsx" não encontrado em fontes/ — saldo de dívida com acionista não será gerado)')
        return None
    print('  Aportes (dívida com acionista):', os.path.basename(path))
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['BD Nova'] if 'BD Nova' in wb.sheetnames else wb[wb.sheetnames[0]]
    aporte_acum=0.0; correcao_acum=0.0
    aporte_mes={}; correcao_mes={}; remessas_mes={}; recebimentos_mes={}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r: continue
        d = dtv(r[0])
        if not d: continue
        ym = d.year*100+d.month
        rem = r[2] if isinstance(r[2],(int,float)) else 0
        rec = r[3] if isinstance(r[3],(int,float)) else 0
        cj  = r[8] if isinstance(r[8],(int,float)) else 0
        aporte_acum+=rem+rec; correcao_acum+=cj
        aporte_mes[ym]=aporte_acum; correcao_mes[ym]=correcao_acum  # último dia do mês fica (ordem cronológica)
        remessas_mes[ym]=remessas_mes.get(ym,0)+rem
        recebimentos_mes[ym]=recebimentos_mes.get(ym,0)+rec
    wb.close()
    yms=sorted(aporte_mes.keys())
    if not yms: return None
    return dict(
        yms=yms,
        aporte=[round(aporte_mes[y],2) for y in yms],
        correcao=[round(correcao_mes[y],2) for y in yms],
        remessas=[round(remessas_mes.get(y,0),2) for y in yms],
        recebimentos=[round(recebimentos_mes.get(y,0),2) for y in yms],
        saldo_atual=round(aporte_mes[yms[-1]]+correcao_mes[yms[-1]],2),
        total_remessas=round(sum(remessas_mes.values()),2),
        total_recebimentos=round(sum(recebimentos_mes.values()),2),
        total_correcao=round(correcao_mes[yms[-1]],2),
    )

# ---------------- 2a) CUSTO FIXO MENSAL (razão contábil · aba _BD2024) ----------------
# De-para "Pacote" bruto -> pacote de custo fixo (6 categorias), confirmado célula a célula
# cruzando esta base com a planilha de controle Razão.xlsm (164/164 contas, sem ambiguidade).
# Pacotes brutos fora deste mapa (CPV, depreciação, financeiro, devoluções, tributos, receita,
# resultado não operacional etc.) não são custo fixo e ficam de fora.
RAW_PACOTE_TO_CF = {
    'PESSOAL':'PESSOAL', 'PROVISOES TRABALHISTAS':'PESSOAL', 'BENEFICIOS':'PESSOAL',
    'FACILITIES':'FACILITIES', 'COMBUSTIVEIS E LUBRIFICANTES':'FACILITIES',
    'MANUTENCAO INDUSTRIAL/PREDIAL':'FACILITIES', 'COMUNICACAO':'FACILITIES',
    'MATERIAL DE CONSUMO':'CONSUMO', 'VIAGENS':'CONSUMO',
    'DESPESAS COM PROPAGANDA E MARKETING':'MARKETING',
    'TERCEIROS':'TERCEIROS',
    'MANUTENCAO DE VEICULOS':'OUTROS', 'ALUGUEL /FRETES':'OUTROS', 'SEGUROS /TAXAS':'OUTROS',
    'OUTRAS DESPESAS E RECEITAS OPERACIONAIS':'OUTROS', 'DESPESAS COM POS VENDAS':'OUTROS',
}

def parse_custo_fixo_mensal(path):
    """Lê a aba _BD2024 do Painel de Resultado (razão contábil linha a linha) e agrega
    Saldo por Empresa × Mês × Pacote (custo fixo) × Terceiro × Conta contábil, para a análise
    mensal interativa (mês atual × mês anterior, com composição ao selecionar um pacote).

    As duas dimensões de detalhe vão na MESMA linha em vez de dois agregados separados: são
    1.701 linhas contra 2.016 de dois blobs, e o JS passa a poder agregar por qualquer uma
    das duas — ou cruzá-las — sem novo parsing."""
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    bd=aba_bd(wb)
    if not bd:
        wb.close(); return None
    print('  Custo fixo mensal:', bd)
    TER=Enc(); CTA=Enc()
    agg={}  # (empresa,ym,pacote,terceiro_idx,conta_idx) -> saldo
    for r in wb[bd].iter_rows(min_row=2, values_only=True):
        if not r or r[0] is None: continue
        pacote=RAW_PACOTE_TO_CF.get(_norm(r[13]))
        if not pacote: continue
        ano,mes=r[15],r[14]
        if not ano or not mes: continue
        v=r[5]
        if not isinstance(v,(int,float)): continue
        empresa=r[0]; ym=int(ano)*100+int(mes)
        tidx=TER.i(_espacos(nm(r[12])))       # [12] Terceiro nome
        cidx=CTA.i(_espacos(nm(r[9])))        # [9]  Conta nome
        k=(empresa,ym,pacote,tidx,cidx)
        agg[k]=agg.get(k,0.0)+v
    wb.close()
    rows=[[e,ym,p,t,c,round(v,2)] for (e,ym,p,t,c),v in agg.items() if round(v,2)!=0]
    yms=sorted(set(r[1] for r in rows))
    print('    detalhe: %d terceiros, %d contas | %d linhas' % (len(TER.l), len(CTA.l), len(rows)))
    return dict(yms=yms, terceiros=TER.l, contas=CTA.l, rows=rows)

# ---------------- 2b) CUSTOS DE PRODUÇÃO / CPV (fábrica) ----------------
# Toda a seção "Custos" exporta dados em nível MENSAL (compacto) para o JS agregar
# dinamicamente por período, no mesmo espírito de DATA.rows/dreAgg() usados em Vendas/DRE.
MESMAP={'JAN':1,'FEV':2,'MAR':3,'ABR':4,'MAI':5,'JUN':6,'JUL':7,'AGO':8,'SET':9,'OUT':10,'NOV':11,'DEZ':12}
def _periodo_to_ym(p):
    if not isinstance(p,str) or len(p)<5: return None
    m=MESMAP.get(p[:3].upper())
    if not m: return None
    return (2000+int(p[3:5]))*100+m

def _clean(s):
    if not isinstance(s,str): return s
    return ' '.join(s.replace('\xa0',' ').split())

_DTVLR_RE = __import__('re').compile(r'Data Vlr:\s*(\d{2})/(\d{2})/(\d{2})')
def _ordem_ym(texto):
    m=_DTVLR_RE.search(texto) if isinstance(texto,str) else None
    if not m: return None
    dd,mm,yy=m.groups()
    return (2000+int(yy))*100+int(mm)

CC_MAP_HORAS={  # centro de trabalho (NDPRO359) -> centro de custo (Valorização_Ordens)
 'USINAGEM':'USINAGEM','PREPARAR MADEIRA':'MARCENARIA','MARCENARIA':'MARCENARIA',
 'SOLDA':'METALURGIA','METALURGIA':'METALURGIA','CORTE DE ESPUMA':'CORTE DE ESPUMA',
 'MONTAGEM':'MONTAGEM E EMBALAGEM','EMBALAGEM':'MONTAGEM E EMBALAGEM','QUALIDADE':'QUALIDADE',
 'TAPECARIA':'TAPECARIA','COSTURA':'TAPECARIA','COURO':'TAPECARIA','PINTURA':'PINTURA','LIXAMENTO':'PINTURA',
}
def _mat_categoria(desc):
    s=_norm(desc)
    h=lambda *w: any(x in s for x in w)
    if h('COURO','LEATHER'): return 'Couro'
    if h('TECIDO','LINHO','VELUDO','ALGODAO','LONA','CHENILLE','SUEDE','JACQUARD'): return 'Tecido'
    if h('MARMORE','GRANITO','QUARTZO','MINERAL','PEDRA'): return 'Pedra'
    if h('ESPUMA'): return 'Espuma'
    if h('ACO','FERRO','ALUMINIO','METAL','INOX','LATAO'): return 'Metal'
    if h('MDF','MADEIRA','SUCUPIRA','TAUARI','CUMARU','IPE','FREIJO','CEDRO','COMPENSADO','PINUS','EUCALIPTO','CARVALHO','NOGUEIRA','TECA'): return 'Madeira'
    return None

_ORDEM_HDR_RE = __import__('re').compile(
    r'^(\d+)\s*-\s*(\w+),\s*Data Vlr:\s*(\d{2})/(\d{2})/(\d{2}),\s*Qtde:\s*([\d.,]+)\s*(\w+),\s*Item:\s*(\S+)\s*ID:\s*(\S*)\s*-\s*(.+)$')

def parse_nivel_zero():
    """Custo à nível zero: para cada produto acabado (vendido, presente no CPV_Acumulado), a lista de
    matéria-prima direta (TP='C') consumida nas ordens de produção desse item, por mês e por ID de ordem.
    Retorna: produtos [[coditem,desc]], materiais [[ym,coditem,id,material,unidade,qtd,custo]], volume [[ym,coditem,id,vol]],
    ordens [[coditem,ym,ordem,id,qtde]] (para popular os filtros de ID por período)."""
    cpv_path=achar(['CPV_Acumulado*.xlsx','*CPV*.xlsx'],'.xlsx',FONTES_CUSTOS)
    val_path=achar(['NDVAL666*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not cpv_path or not val_path: return [],[],[],[]
    wbc=openpyxl.load_workbook(cpv_path, read_only=True, data_only=True)
    cpv_rows=list(wbc[wbc.sheetnames[0]].iter_rows(min_row=4, values_only=True)); wbc.close()
    cpv_items=set(str(r[9]).strip() for r in cpv_rows if r[9])

    print('  NDVAL666 (custo a nível zero):', os.path.basename(val_path))
    wb=openpyxl.load_workbook(val_path, read_only=True, data_only=True)
    rows=list(wb[wb.sheetnames[0]].iter_rows(min_row=5, values_only=True)); wb.close()

    ordens={}; ordens_by_num_desc={}
    for r in rows:
        txt=r[1]
        if not isinstance(txt,str): continue
        m=_ORDEM_HDR_RE.match(txt.strip())
        if not m: continue
        num=m.group(1)
        if num in ordens: continue
        dd,mm,yy=m.group(3),m.group(4),m.group(5)
        ym=(2000+int(yy))*100+int(mm)
        coditem=m.group(8).strip(); idd=m.group(9).strip()
        qtde=float(m.group(6).replace(',','.')) if m.group(6) else 0.0
        desc=_clean(m.group(10)) or 'Não informado'
        ordens[num]=dict(ym=ym,coditem=coditem,id=idd,qtde=qtde,desc=desc)

    desc_count={}
    for o in ordens.values():
        if o['coditem'] not in cpv_items: continue
        d=desc_count.setdefault(o['coditem'],{}); d[o['desc']]=d.get(o['desc'],0)+1
    produtos=[[ci, max(d.items(), key=lambda x:x[1])[0]] for ci,d in desc_count.items()]
    produtos.sort(key=lambda x:x[1])

    vol_agg={}; ordens_l=[]
    for num,o in ordens.items():
        if o['coditem'] not in cpv_items: continue
        k=(o['ym'],o['coditem'],o['id']); vol_agg[k]=vol_agg.get(k,0.0)+o['qtde']
        ordens_l.append([o['coditem'],o['ym'],num,o['id'],round(o['qtde'],2)])

    mat_agg={}; mat_um={}
    for r in rows:
        txt=r[1]
        if not isinstance(txt,str): continue
        m=_ORDEM_HDR_RE.match(txt.strip())
        if not m: continue
        o=ordens.get(m.group(1))
        if not o or o['coditem'] not in cpv_items: continue
        if r[10] is not None: continue  # só linhas de material (sem operação)
        if r[2]!='C': continue  # só matéria-prima direta
        custo=r[17] or 0
        if not custo: continue
        matdesc=_clean(r[5]) or 'Não informado'
        k=(o['ym'],o['coditem'],o['id'],matdesc)
        v=mat_agg.setdefault(k,dict(qtd=0.0,custo=0.0))
        v['qtd']+=(r[7] or 0); v['custo']+=custo
        if matdesc not in mat_um and r[8]: mat_um[matdesc]=_clean(r[8])

    materiais=[[ym,ci,idd,md,mat_um.get(md,''),round(v['qtd'],4),round(v['custo'],2)] for (ym,ci,idd,md),v in sorted(mat_agg.items())]
    volume=[[ym,ci,idd,round(v,2)] for (ym,ci,idd),v in sorted(vol_agg.items())]
    return produtos, materiais, volume, ordens_l

def _grupo_por_descricao(desc):
    """Classifica um item pela descrição quando ele não aparece no CPV_Acumulado (ex.: componentes/
    semi-acabados, cujo custo já é parte do produto acabado 'pai'). Usa palavras-chave do próprio
    nome do produto acabado citado na descrição técnica — mesma lógica de _mat_categoria(), mas para
    grupo de produto. Itens sem nenhuma palavra-chave reconhecida caem em 'COMPONENTES'."""
    s=_norm(desc)
    h=lambda *w: any(x in s for x in w)
    if h('SOFA'): return 'SOFÁS'
    if h('CADEIRA'): return 'CADEIRAS'
    if h('POLTRONA','PUFF','POUF'): return 'POLTRONAS'
    if h('CHAISE'): return 'CHAISE'
    if h('BIOMBO'): return 'BIOMBO'
    if h('BANCO','BANQUETA'): return 'BANCOS E BANQUETAS'
    if h('MESA DE JANTAR','MESA JANTAR'): return 'MESA DE JANTAR'
    if h('MESA'): return 'MESAS AUXILIARES'
    if h('BANCADA'): return 'BANCADAS E APOIOS'
    if h('ESTANTE','ESCRIVANINHA'): return 'ESCRIVANINHAS E ESTANTES'
    if h('ALMOFADA'): return 'ALMOFADAS'
    if h('ACESSORIO','BOLSA','SACOLA','SACO ','CARDAPIO','TAG ','PORTA CANETA'): return 'ACESSÓRIOS'
    return 'COMPONENTES'

def parse_producao():
    """Custo de Produção (CPP): consumo de matéria-prima direta (NDVAL666, TP=C) + absorção de
    Mão de Obra e GGF (Valorização_Ordens), por item de produção — multiplicado pelo VOLUME DE
    PRODUÇÃO DE PRODUTO ACABADO (NDVAL666, ordens de itens presentes no CPV_Acumulado). O custo de
    componentes/semi-acabados (código 'filho', sem ordem própria de produto acabado) entra no CPP do
    grupo normalmente, mas sua quantidade NÃO soma ao volume — já está embutida no volume do 'pai'.
    Formato de saída idêntico ao de parse_cpv_acumulado() (linhas por grupo e por produto), para
    reaproveitar a mesma agregação por período no app.js.
    Mapeamento item -> grupo: 1) grupo exato do CPV_Acumulado quando o item também foi vendido;
    2) senão, por palavras-chave na própria descrição técnica (_grupo_por_descricao) — os
    componentes/semi-acabados herdam o grupo do produto acabado citado em sua descrição."""
    cpv_path=achar(['CPV_Acumulado*.xlsx','*CPV*.xlsx'],'.xlsx',FONTES_CUSTOS)
    item_grupo={}; item_desc={}
    if cpv_path:
        wbc=openpyxl.load_workbook(cpv_path, read_only=True, data_only=True)
        for r in wbc[wbc.sheetnames[0]].iter_rows(min_row=4, values_only=True):
            if len(r)<=12 or not r[9]: continue
            ci=str(r[9]).strip()
            item_grupo.setdefault(ci, r[12] or 'Outros')
            if r[11]: item_desc.setdefault(ci, _clean(r[11]))
        wbc.close()
    # produto acabado = item presente no CPV_Acumulado (mesma definição já usada em parse_nivel_zero
    # para "produtos"); componentes/semi-acabados (código 'filho') não contam volume — seu custo já
    # compõe o CPP do 'pai' (produto acabado), mas a peça em si não é uma unidade de produto vendável.
    itens_acabados=set(item_grupo.keys())

    val_path=achar(['NDVAL666*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not val_path: return None,None
    print('  NDVAL666 (volume e consumo de produção — CPP):', os.path.basename(val_path))
    wb=openpyxl.load_workbook(val_path, read_only=True, data_only=True)
    rows=list(wb[wb.sheetnames[0]].iter_rows(min_row=5, values_only=True)); wb.close()

    ordens={}
    for r in rows:
        txt=r[1]
        if not isinstance(txt,str): continue
        m=_ORDEM_HDR_RE.match(txt.strip())
        if not m: continue
        num=m.group(1)
        if num in ordens: continue
        dd,mm,yy=m.group(3),m.group(4),m.group(5)
        ym=(2000+int(yy))*100+int(mm)
        coditem=m.group(8).strip()
        qtde=float(m.group(6).replace(',','.')) if m.group(6) else 0.0
        desc=_clean(m.group(10)) or 'Não informado'
        ordens[num]=dict(ym=ym,coditem=coditem,qtde=qtde,desc=desc)
        item_desc.setdefault(coditem, desc)

    vol_agg={}  # (ym,coditem) -> qtde produzida, só de produto acabado (presente no CPV_Acumulado)
    for o in ordens.values():
        if o['coditem'] not in itens_acabados: continue
        k=(o['ym'],o['coditem']); vol_agg[k]=vol_agg.get(k,0.0)+o['qtde']

    mat_agg={}  # (ym,coditem) -> custo de matéria-prima direta (TP=C)
    for r in rows:
        txt=r[1]
        if not isinstance(txt,str): continue
        m=_ORDEM_HDR_RE.match(txt.strip())
        if not m: continue
        o=ordens.get(m.group(1))
        if not o: continue
        if r[10] is not None: continue  # só linhas de material (sem operação)
        if r[2]!='C': continue  # só matéria-prima direta
        custo=r[17] or 0
        if not custo: continue
        k=(o['ym'],o['coditem']); mat_agg[k]=mat_agg.get(k,0.0)+custo

    val2_path=achar(['Valorização_Ordens*.xlsx','Valorizacao_Ordens*.xlsx','*Valoriza*Ordens*.xlsx'],'.xlsx',FONTES_CUSTOS)
    modggf_agg={}
    if val2_path:
        print('  Valorização_Ordens (MOD/GGF por item — CPP):', os.path.basename(val2_path))
        wb2=openpyxl.load_workbook(val2_path, read_only=True, data_only=True)
        vrows=list(wb2[wb2.sheetnames[0]].iter_rows(min_row=5, values_only=True)); wb2.close()
        for r in vrows:
            d=r[1]
            ym=d.year*100+d.month if isinstance(d,datetime.datetime) else None
            if not ym or not r[5]: continue
            ci=str(r[5]).strip()
            mod=(r[19] or 0)+(r[20] or 0)          # REAL MOD + REAL MOT
            ggf=(r[22] or 0)+(r[21] or 0)+(r[23] or 0)  # REAL GGF + REAL MOI + REAL GGV
            k=(ym,ci); o=modggf_agg.setdefault(k, dict(mod=0.0,ggf=0.0))
            o['mod']+=mod; o['ggf']+=ggf
            if ci not in item_desc and r[7]: item_desc.setdefault(ci, _clean(r[7]))

    def grupo_de(ci):
        if ci in item_grupo: return item_grupo[ci]
        g=_grupo_por_descricao(item_desc.get(ci,''))
        item_grupo[ci]=g
        return g

    todas_chaves=set(vol_agg)|set(mat_agg)|set(modggf_agg)
    agg_grp={}; agg_prod={}
    for k in todas_chaves:
        ym,ci=k
        qtd=vol_agg.get(k,0.0); mat=mat_agg.get(k,0.0)
        mg=modggf_agg.get(k) or {}
        mod=mg.get('mod',0.0); ggf=mg.get('ggf',0.0)
        custo=mat+mod+ggf
        if not qtd and not custo: continue
        grp=grupo_de(ci); prod=item_desc.get(ci,ci)
        vg=agg_grp.setdefault((ym,grp), dict(qtd=0.0,mat=0.0,mod=0.0,ggf=0.0,custo=0.0))
        vg['qtd']+=qtd; vg['mat']+=mat; vg['mod']+=mod; vg['ggf']+=ggf; vg['custo']+=custo
        vp=agg_prod.setdefault((ym,prod,grp), dict(qtd=0.0,mat=0.0,mod=0.0,ggf=0.0,custo=0.0))
        vp['qtd']+=qtd; vp['mat']+=mat; vp['mod']+=mod; vp['ggf']+=ggf; vp['custo']+=custo

    linhas=[[ym,grp,round(v['qtd']),round(v['mat']),round(v['mod']),round(v['ggf']),round(v['custo'])]
            for (ym,grp),v in sorted(agg_grp.items())]
    linhas_prod=[[ym,prod,grp,round(v['qtd']),round(v['mat']),round(v['mod']),round(v['ggf']),round(v['custo'])]
            for (ym,prod,grp),v in sorted(agg_prod.items())]
    return linhas, linhas_prod

def parse_cpv_acumulado():
    """Retorna (linhas [ym,grupo,qtd,mat,mod,ggf,custo] por grupo,
    linhas [ym,produto,grupo,qtd,mat,mod,ggf,custo] por produto, lista de grupos)."""
    path=achar(['CPV_Acumulado*.xlsx','*CPV*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not path: return None,None,None
    print('  CPV_Acumulado:', os.path.basename(path))
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows=list(wb[wb.sheetnames[0]].iter_rows(min_row=4, values_only=True)); wb.close()
    agg={}; agg_prod={}
    for r in rows:
        ym=_periodo_to_ym(r[35]) if len(r)>35 else None
        if not ym: continue
        mat,mod,mot,moi,ggf,ggv=(r[25] or 0),(r[26] or 0),(r[27] or 0),(r[28] or 0),(r[29] or 0),(r[30] or 0)
        custo=r[18] or 0; qtd=r[14] or 0; grp=r[12] or 'Outros'
        modtot=mod+mot; ggftot=ggf+moi+ggv
        k=(ym,grp)
        v=agg.setdefault(k,dict(qtd=0.0,mat=0.0,mod=0.0,ggf=0.0,custo=0.0))
        v['qtd']+=qtd; v['mat']+=mat; v['mod']+=modtot; v['ggf']+=ggftot; v['custo']+=custo
        prod=_clean(r[11]) or 'Não informado'
        kp=(ym,prod,grp)
        vp=agg_prod.setdefault(kp,dict(qtd=0.0,mat=0.0,mod=0.0,ggf=0.0,custo=0.0))
        vp['qtd']+=qtd; vp['mat']+=mat; vp['mod']+=modtot; vp['ggf']+=ggftot; vp['custo']+=custo
    linhas=[[ym,grp,round(v['qtd']),round(v['mat']),round(v['mod']),round(v['ggf']),round(v['custo'])]
            for (ym,grp),v in sorted(agg.items())]
    linhas_prod=[[ym,prod,grp,round(v['qtd']),round(v['mat']),round(v['mod']),round(v['ggf']),round(v['custo'])]
            for (ym,prod,grp),v in sorted(agg_prod.items())]
    grupos=sorted(set(grp for _,grp in agg.keys()))
    return linhas, linhas_prod, grupos

def parse_composicao_materiais():
    """Retorna (linhas [ym,categoria,valor], linhas [ym,categoria,material,unidade,qtd,valor]) a partir das linhas de
    material direto (TP='C', sem operação) do NDVAL666. Componentes fabricados internamente (TP='F') ficam de
    fora — seu custo (MAT+M.O+GGF) já foi contabilizado na etapa de produção em que foram fabricados."""
    path=achar(['NDVAL666*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not path: return [],[]
    print('  NDVAL666 (composição de materiais):', os.path.basename(path))
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows=list(wb[wb.sheetnames[0]].iter_rows(min_row=5, values_only=True)); wb.close()
    agg={}; agg_item={}; item_um={}
    for r in rows:
        if r[10] is not None: continue  # só linhas de material/componente (sem operação)
        if r[2]!='C': continue  # só matéria-prima direta; componentes fabricados (TP='F') ficam de fora
        matv=r[17] or 0
        if not matv: continue
        ym=_ordem_ym(r[1])
        if not ym: continue
        cat=_mat_categoria(r[5]) or 'Outros materiais'
        k=(ym,cat); agg[k]=agg.get(k,0.0)+matv
        item=_clean(r[5]) or 'Não informado'
        ki=(ym,cat,item); v=agg_item.setdefault(ki,dict(qtd=0.0,custo=0.0))
        v['qtd']+=(r[7] or 0); v['custo']+=matv
        if item not in item_um and r[8]: item_um[item]=_clean(r[8])
    linhas=[[ym,cat,round(v)] for (ym,cat),v in sorted(agg.items())]
    linhas_item=[[ym,cat,item,item_um.get(item,''),round(v['qtd'],4),round(v['custo'])] for (ym,cat,item),v in sorted(agg_item.items())]
    return linhas, linhas_item

def parse_razao_cc():
    """Retorna linhas [ym,classif,agrupador,valor] (só PRODUTIVO e AUXILIAR/APOIO)."""
    path=achar(['Razão CC*.xlsx','Razao CC*.xlsx','*Raz*CC*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not path: return [], {}
    print('  Razão CC (custos operacionais):', os.path.basename(path))
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    cc_classif={}
    for r in wb['TD1'].iter_rows(min_row=2, values_only=True):
        if r[0] and r[0]!='Total Geral': cc_classif[_norm(r[0])]=r[1]
    rows=list(wb['RAZAO COM CC'].iter_rows(min_row=4, values_only=True)); wb.close()
    agg={}; rotulos={}
    for r in rows:
        ccd=_norm(r[14]) if r[14] else None
        classif=cc_classif.get(ccd) or r[15]
        if classif not in ('PRODUTIVO','AUXILIAR/APOIO'): continue
        d=r[1]
        if not isinstance(d,datetime.datetime): continue
        ym=d.year*100+d.month
        val=r[23] if r[23] not in (None,'') else (r[12] or 0)
        val=val if isinstance(val,(int,float)) else 0
        agrraw=r[5]; agr=_norm(agrraw) or 'NAO INFORMADO'
        rotulos.setdefault(agr, agrraw.strip().title() if isinstance(agrraw,str) else 'Não informado')
        k=(ym,classif,agr); agg[k]=agg.get(k,0.0)+val
    linhas=[[ym,classif,agr,round(v)] for (ym,classif,agr),v in sorted(agg.items())]
    return linhas, rotulos

def parse_valorizacao_ordens():
    """Retorna: linhas de absorção por CC [ym,cc,mod,ggf,real], linhas de retrabalho [ym,cc,produto,real]
    e linhas de assistência técnica [ym,produto,real]."""
    path=achar(['Valorização_Ordens*.xlsx','Valorizacao_Ordens*.xlsx','*Valoriza*Ordens*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not path: return [],[],[],None
    print('  Valorização_Ordens (absorção CC, retrabalho, ass. técnica):', os.path.basename(path))
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows=list(wb[wb.sheetnames[0]].iter_rows(min_row=5, values_only=True)); wb.close()
    cc_agg={}; ret_agg={}; ass_agg={}; ymmin=None
    for r in rows:
        d=r[1]; ym=d.year*100+d.month if isinstance(d,datetime.datetime) else None
        if not ym: continue
        if ymmin is None or ym<ymmin: ymmin=ym
        cc=r[10] or 'Não informado'
        real=r[14] or 0; mod=r[19] or 0; ggf=r[22] or 0
        kc=(ym,cc); v=cc_agg.setdefault(kc,dict(mod=0.0,ggf=0.0,real=0.0))
        v['mod']+=mod; v['ggf']+=ggf; v['real']+=real
        op=_norm(r[12])
        if op.startswith('RET'):
            prod=_clean(r[7]) or 'Não informado'
            kr=(ym,cc,prod); ret_agg[kr]=ret_agg.get(kr,0.0)+real
        if r[4]==1:
            prod=_clean(r[7]) or 'Não informado'
            ka=(ym,prod); ass_agg[ka]=ass_agg.get(ka,0.0)+real
    cc_l=[[ym,cc,round(v['mod']),round(v['ggf']),round(v['real'])] for (ym,cc),v in sorted(cc_agg.items())]
    ret_l=[[ym,cc,prod,round(v)] for (ym,cc,prod),v in sorted(ret_agg.items())]
    ass_l=[[ym,prod,round(v)] for (ym,prod),v in sorted(ass_agg.items())]
    return cc_l, ret_l, ass_l, ymmin

def parse_horas_producao(ymmin):
    """Retorna linhas [ym,centro_custo,horas] (a partir dos centros de trabalho, já mapeados e em horas)."""
    path=achar(['NDPRO359*.xlsx'],'.xlsx',FONTES_CUSTOS)
    if not path: return []
    print('  NDPRO359 (horas de produção):', os.path.basename(path))
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows=list(wb[wb.sheetnames[0]].iter_rows(min_row=5, values_only=True)); wb.close()
    agg={}
    for r in rows:
        d=r[1]
        if not isinstance(d,datetime.datetime): continue
        ym=d.year*100+d.month
        if ymmin and ym<ymmin: continue  # alinha com período do Valorização_Ordens
        ct=_norm(r[5]); bucket=CC_MAP_HORAS.get(ct, ct)
        hh=r[40] if isinstance(r[40],(int,float)) else 0
        k=(ym,bucket); agg[k]=agg.get(k,0.0)+hh/60.0  # coluna "HORAS HOMEM" vem em minutos na origem
    return [[ym,cc,round(v,2)] for (ym,cc),v in sorted(agg.items())]

def carregar_custos():
    if not os.path.isdir(FONTES_CUSTOS):
        print('  (pasta fontes/custos não encontrada — seção Custos não será gerada)')
        return None
    print('Lendo fontes de custo...')
    linhas_cpv, linhas_prod, grupos = parse_cpv_acumulado()
    if linhas_cpv is None: return None
    linhas_mat, linhas_mat_item = parse_composicao_materiais()
    linhas_cta, rotulos_cta = parse_razao_cc()
    linhas_cc, linhas_ret, linhas_ass, ymmin = parse_valorizacao_ordens()
    linhas_horas = parse_horas_producao(ymmin)
    nz_produtos, nz_materiais, nz_volume, nz_ordens = parse_nivel_zero()
    linhas_cpp, linhas_prod_cpp = parse_producao()
    grupos_cpp = sorted(set(g for _,g in ((r[0],r[1]) for r in (linhas_cpp or []))))
    return dict(
        cpv=linhas_cpv, produtos=linhas_prod, grupos=grupos, materiais=linhas_mat, materiais_item=linhas_mat_item,
        cta=linhas_cta, rotulos_cta=rotulos_cta,
        cc=linhas_cc, horas=linhas_horas, retrabalho=linhas_ret, assistencia=linhas_ass,
        nz_produtos=nz_produtos, nz_materiais=nz_materiais, nz_volume=nz_volume, nz_ordens=nz_ordens,
        cpp=linhas_cpp or [], produtos_cpp=linhas_prod_cpp or [], grupos_cpp=grupos_cpp,
    )

# ---------------- 4) CARTEIRA DINÂMICA (VENDAS LOJA) ----------------
# Lê fontes/VENDAS LOJA 2025.xlsx (aba "VENDAS GERAL") diretamente, reproduzindo a mesma
# classificação de status já usada na planilha legada "PEDIDOS EM CARTEIRA FABRICA - ATUAL.xlsx"
# (aba Planilha1: LIBERADO->FINALIZADO, ANDAMENTO(/TERCEIRO)->ANDAMENTO, ADIADO->ADIADO,
# ATRASADO(/TERCEIRO)->ATRASADO), sem depender daquele workbook nem da sua Power Query.
STATUS_BUCKET = {
    'ANDAMENTO':'ANDAMENTO', 'ANDAMENTO/TERCEIRO':'ANDAMENTO', 'ACABAMENTO A DEFINIR':'ANDAMENTO',
    'LIBERADO':'FINALIZADO',
    'ADIADO':'ADIADO',
    'ATRASADO':'ATRASADO', 'ATRASADO/TERCEIRO':'ATRASADO',
}
STATUS_EXCLUIR = {'', '-', 'CANCELADO', 'ENTREGUE', 'DEVOLUCAO'}

def parse_metas():
    """Metas mensais de venda (fontes/Metas Vendas 2026.xlsx, colunas "Data" | "Vendas Previstas").

    Opcional: se ausente, a seção "Performance Comercial" não é gerada.

    Aqui não se usa achar(): o fallback dele devolve qualquer arquivo da extensão quando nenhum
    padrão casa, e uma planilha de metas ausente viraria silenciosamente a base comercial ou o
    Aportes.xlsx. Casa o nome direto e confere o cabeçalho antes de aceitar o arquivo.

    Agnóstico de ano — os ym saem das próprias datas, então a planilha de 2027 não pede código novo.
    """
    achados = [f for f in sorted(glob.glob(os.path.join(FONTES, 'Metas*Vendas*.xlsx')),
                                 key=os.path.getmtime, reverse=True)
               if not os.path.basename(f).startswith('~$')]
    if not achados:
        print('  ("Metas Vendas *.xlsx" não encontrado em fontes/ — seção "Performance Comercial" não será gerada)')
        return None
    # com metas de dois anos na pasta, vale a do ano mais recente pelas DATAS da planilha —
    # a data de gravação escolheria a de 2026 se alguém a abrisse e salvasse depois da de 2027
    def _ano_max(f):
        try:
            w = openpyxl.load_workbook(f, read_only=True, data_only=True)
            anos = [d.year for d in (dtv(r[0]) for r in w[w.sheetnames[0]].iter_rows(min_row=2, max_col=1, values_only=True) if r) if d]
            w.close(); return max(anos) if anos else 0
        except Exception:
            return 0
    path = max(achados, key=_ano_max) if len(achados) > 1 else achados[0]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    linhas = list(ws.iter_rows(min_row=1, max_col=2, values_only=True)); wb.close()
    cab = [_norm(c) for c in (linhas[0] if linhas else (None, None))]
    if cab[:2] != ['DATA', 'VENDAS PREVISTAS']:
        print('    (cabeçalho inesperado em %s: %s — seção "Performance Comercial" não será gerada)'
              % (os.path.basename(path), cab[:2]))
        return None
    metas = {}
    for r in linhas[1:]:
        d, v = (dtv(r[0]) if r else None), (num(r[1]) if r else None)
        if d is None or v is None: continue
        metas[d.year*100 + d.month] = metas.get(d.year*100 + d.month, 0.0) + v
    if not metas:
        print('    (nenhuma linha válida em %s — seção "Performance Comercial" não será gerada)'
              % os.path.basename(path))
        return None
    yms = sorted(metas)
    print('  metas de venda:', os.path.basename(path), '|', len(yms), 'meses |',
          'total R$ %s' % format(sum(metas.values()), ',.0f'))
    return dict(yms=yms, meta=[round(metas[y], 2) for y in yms])


def parse_carteira_dinamica():
    path = achar_estrito(['VENDAS LOJA*.xlsx'])
    if not path:
        print('  ("VENDAS LOJA *.xlsx" não encontrado em fontes/ — seção "Carteira dinâmica" não será gerada)')
        return None
    print('  carteira dinâmica:', os.path.basename(path))
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if 'VENDAS GERAL' not in wb.sheetnames:
        print('    (aba "VENDAS GERAL" não encontrada — seção "Carteira dinâmica" não será gerada)')
        wb.close(); return None
    ws = wb['VENDAS GERAL']
    C_PEDIDO,C_DVENDA,C_DENTREGA,C_PRODUTO,C_QDT,C_VALOR,C_CLIENTE,C_STATUS,C_VENDEDORA = 2,3,4,8,11,12,16,18,17

    total=0.0; itens=0; pedidos=set()
    status_tot={}
    evol_mensal={}        # ym venda -> {'v':..,'atraso':..}
    adiado_mensal={}      # ym venda -> valor (só ADIADO)
    andamento_entrega={}  # ym entrega -> valor (só ANDAMENTO)
    ped_bucket={}          # bucket -> {pedido: {'cliente':..,'valor':..,'itens':..,'linhas':[[produto,qdt,valor,data_venda,data_entrega]]}}
    vend_tot={}            # vendedora -> {'valor':.., 'pedidos':set()}

    for r in ws.iter_rows(min_row=3, values_only=True):
        if not r: continue
        status_raw = _norm(r[C_STATUS])
        if status_raw in STATUS_EXCLUIR: continue
        v = r[C_VALOR]
        if not isinstance(v,(int,float)): continue
        dven, dent = dtv(r[C_DVENDA]), dtv(r[C_DENTREGA])
        cliente = nm(r[C_CLIENTE]) or 'Não informado'
        pedido = r[C_PEDIDO]
        bucket = STATUS_BUCKET.get(status_raw, 'FINALIZADO')  # status residuais (ex. ESTOQUE) somam a FINALIZADO, como na planilha legada

        total+=v; itens+=1
        if pedido is not None: pedidos.add(pedido)
        status_tot[bucket]=status_tot.get(bucket,0)+v

        vn = nm(r[C_VENDEDORA]) or 'Não informado'
        vt = vend_tot.setdefault(vn, {'valor':0.0,'pedidos':set()})
        vt['valor'] += v
        if pedido is not None: vt['pedidos'].add(pedido)

        if dven:
            ym=dven.year*100+dven.month
            em=evol_mensal.setdefault(ym,{'v':0,'atraso':0}); em['v']+=v
            if bucket=='ATRASADO': em['atraso']+=v
            if bucket=='ADIADO': adiado_mensal[ym]=adiado_mensal.get(ym,0)+v

        if bucket=='ANDAMENTO' and dent:
            ym2=dent.year*100+dent.month
            andamento_entrega[ym2]=andamento_entrega.get(ym2,0)+v

        if pedido is not None:
            pe=ped_bucket.setdefault(bucket,{}).setdefault(pedido,{'cliente':cliente,'valor':0.0,'itens':0,'linhas':[]})
            pe['valor']+=v; pe['itens']+=1
            if pe['cliente']=='Não informado' and cliente!='Não informado': pe['cliente']=cliente
            qdt = r[C_QDT] if isinstance(r[C_QDT],(int,float)) else 0
            pe['linhas'].append([nm(r[C_PRODUTO]) or '', qdt, round(v,2),
                                  dven.strftime('%d/%m/%Y') if dven else None,
                                  dent.strftime('%d/%m/%Y') if dent else None])
    wb.close()

    def acumula(vals):
        acc=0; out=[]
        for v in vals: acc+=v; out.append(round(acc,2))
        return out

    yms_e=sorted(evol_mensal.keys())
    evol_vendas=[round(evol_mensal[y]['v'],2) for y in yms_e]
    evol_atraso=[round(evol_mensal[y]['atraso'],2) for y in yms_e]

    yms_a=sorted(adiado_mensal.keys())
    ad_vals=[round(adiado_mensal[y],2) for y in yms_a]

    yms_g=sorted(andamento_entrega.keys())
    g_vals=[round(andamento_entrega[y],2) for y in yms_g]

    status_list=[[k,round(v,2)] for k,v in sorted(status_tot.items(),key=lambda x:-x[1])]
    # mesma forma da carteira estática (carteira['vend']): [nome, pendente, nº de pedidos]
    vend_list=sorted([[k, round(d['valor'],2), len(d['pedidos'])] for k,d in vend_tot.items()],
                     key=lambda x:-x[1])[:12]
    status_pedidos={bucket: [[p,d['cliente'],round(d['valor'],2),d['itens'],d['linhas']]
                              for p,d in sorted(peds.items(),key=lambda kv:-kv[1]['valor'])]
                     for bucket,peds in ped_bucket.items()}

    return dict(
        # posição da carteira = data declarada por quem subiu a base (config "datas_posicao"),
        # nunca o dia em que o script rodou; sem declaração, a data de gravação do arquivo
        data_base=data_posicao('carteira_dinamica', path),
        fonte=os.path.basename(path),
        total=round(total,2), itens=itens, pedidos=len(pedidos),
        status=status_list, status_pedidos=status_pedidos, vend=vend_list,
        evol=dict(yms=yms_e, vendas=evol_vendas, atrasados=evol_atraso, acum=acumula(evol_vendas)),
        evol_adiado=dict(yms=yms_a, valor=ad_vals, acum=acumula(ad_vals)),
        andamento_entrega=dict(yms=yms_g, valor=g_vals, acum=acumula(g_vals)),
    )

# ---------------- 3) MONTAGEM DO HTML ----------------
def parse_fabloja():
    """Leitura executiva do modelo gerencial Fábrica × Loja (item 7 da ata de 26/08/2026).

    Lê a aba 12_DRE_Antigo_x_Mudanca de Modelo_Gerencial_Fabrica_Loja.xlsx, que compara o DRE
    ANTIGO (por entidade jurídica, como o Painel reporta) com o Modelo A (por função industrial
    x comercial). O modelo não tem unidade corporativa: estrutura e juros entram como despesa
    de Fábrica e de Loja, rateados, então os blocos são só esses dois mais o consolidado.
    Os dois anos da aba vêm juntos — 2025 fechado nas colunas B/C e 2026 YTD nas colunas F/G — e o relatório põe um filtro de ano em cima disso. Todas as linhas do bloco
    são lidas, inclusive os 16 subgrupos de despesa, que no HTML ficam recolhíveis.

    Lê os VALORES EM CACHE (data_only=True) em vez de recalcular: no modelo gerencial os números
    do Modelo A existem apenas como fórmulas Excel, e reimplementar a regra aqui criaria duas
    versões da mesma conta, livres para divergir entre a planilha e o painel.

    Caminho explícito, sem achar(): a pasta é outra e o glob já causou problema antes
    (Apelidos_Candidatos.xlsx sendo lido no lugar de Apelidos.xlsx)."""
    path = os.path.join(AQUI, 'Modelo_Gerencial_Fabrica_Loja', 'Modelo_Gerencial_Fabrica_Loja.xlsx')
    if not os.path.exists(path):
        print('  ("Modelo_Gerencial_Fabrica_Loja.xlsx" não encontrado — seção "Estudos e Análises" não será gerada)')
        return None
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if '12_DRE_Antigo_x_Mudanca' not in wb.sheetnames:
        print('    (aba "12_DRE_Antigo_x_Mudanca" não encontrada — seção não gerada)')
        wb.close(); return None
    ws = wb['12_DRE_Antigo_x_Mudanca']
    grade = [[c for c in r] for r in ws.iter_rows(min_row=1, max_row=200, max_col=9, values_only=True)]
    # O markup de transferencia e premissa calibravel (01_Premissas!B6): o relatorio le o
    # valor em vez de repetir "10%" no texto, senao a legenda mente na primeira recalibragem.
    # Achado pelo rotulo, nao pela linha fixa - a aba de premissas ainda vai crescer.
    markup = None
    if '01_Premissas' in wb.sheetnames:
        for lin in wb['01_Premissas'].iter_rows(min_row=1, max_row=30, max_col=2, values_only=True):
            if isinstance(lin[0], str) and 'markup' in _norm(lin[0]).lower() \
               and isinstance(lin[1], (int, float)):
                markup = lin[1]
                break
    wb.close()
    cel = lambda lin, col: grade[lin-1][col-1] if 0 < lin <= len(grade) else None
    # títulos localizados pelo texto, não por linha fixa: sobrevive a mudança de estrutura da aba
    ALVOS = [('FABRICA','Fábrica'),('LOJA','Loja'),('CONSOLIDADO','Consolidado')]
    # os anos da aba vêm do próprio cabeçalho ("2025 FECHADO", "2026 YTD (JAN-JUL)"): cada um marca
    # a coluna ANTIGO e a seguinte é a MUDANÇA (Mod. A). Nada de ano ou coluna escritos aqui — quando
    # o modelo for regerado com agosto ou com 2027, o rótulo e as colunas acompanham.
    MESES_ABR = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']
    ANOS = []
    for lin in grade[:12]:
        for ci, v in enumerate(lin, start=1):
            m = re.match(r'\s*(20\d\d)\s+(FECHADO|YTD\s*\(\s*JAN\s*-\s*([A-Z]{3})\s*\))', str(v or '').upper())
            if not m: continue
            fim = 'Dez' if m.group(2) == 'FECHADO' else (m.group(3).capitalize() if m.group(3) in MESES_ABR else m.group(3))
            ANOS.append((m.group(1), ci, ci + 1, '%s · Jan–%s' % (m.group(1), fim)))
        if ANOS: break
    if not ANOS:
        print('    (cabeçalho de anos não encontrado na aba 12 — seção "Estudos e Análises" não será gerada)'); return None
    ANO_PADRAO = max(a for a, _, _, _ in ANOS)
    LABEL = {a: rot for a, _, _, rot in ANOS}
    def acha_titulo(chave):
        for i,row in enumerate(grade, start=1):
            v = row[0]
            if isinstance(v,str) and _norm(v).startswith(chave): return i
        return None
    num = lambda v: round(v,2) if isinstance(v,(int,float)) else None
    # A indentação do rótulo é o único lugar onde a planilha guarda a hierarquia do DRE:
    # 0 = subtotal/agrupador, 1 = linha do DRE, 2 = subgrupo de despesa. Medida ANTES do strip.
    nivel = lambda s: 2 if s.startswith('        ') else (1 if s.startswith('    ') else 0)
    blocos=[]
    for chave,rotulo in ALVOS:
        h = acha_titulo(chave)
        if h is None:
            print(f'    (bloco "{chave}" não encontrado na aba 12 — seção não gerada)'); return None
        # o bloco vai do título até o primeiro rótulo vazio: os quatro são separados por linha
        # em branco e o último termina antes da linha de CONFERENCIA. Mais robusto que offsets
        # fixos — incluir ou remover uma linha na planilha não desalinha a leitura.
        anos = {a: [] for a,_,_,_ in ANOS}
        off = 1
        while True:
            rot = cel(h+off, 1)
            if not isinstance(rot,str) or not rot.strip(): break
            niv = nivel(rot)
            for a,ca,cm,_ in ANOS:
                anos[a].append([rot.strip(), num(cel(h+off,ca)), num(cel(h+off,cm)), niv])
            off += 1
        if off == 1:
            print(f'    (bloco "{chave}" sem linhas na aba 12 — seção não gerada)'); return None
        blocos.append({'chave':chave,'rotulo':rotulo,'titulo':str(cel(h,1) or '').strip(),'anos':anos})
    porb = {b['chave']: b for b in blocos}
    def resultado(chave, ano):
        """(antigo, Modelo A) da linha de resultado líquido do bloco."""
        for l in porb[chave]['anos'][ano]:
            if _norm(l[0]).startswith('(=) RESULTADO LIQUIDO'): return l[1], l[2]
        return None, None
    # conciliação por ano: o painel não deve exibir número que não fecha (item 7.6 da ata).
    # Um ano que não fecha cai sozinho — os outros continuam publicáveis.
    ok=[]
    for a,_,_,_ in ANOS:
        ant_c, moda_c = resultado('CONSOLIDADO', a)
        if ant_c is None or moda_c is None or abs(moda_c-ant_c) > 1:
            print(f'    AVISO: {a} — consolidado do Modelo A não bate com o antigo; ano descartado.'); continue
        soma = sum((resultado(k, a)[1] or 0) for k in ('FABRICA','LOJA'))
        if abs(soma-moda_c) > 1:
            print(f'    AVISO: {a} — Fábrica+Loja ({soma:,.2f}) != consolidado ({moda_c:,.2f}); ano descartado.'); continue
        ok.append(a)
    if not ok:
        print('    (nenhum ano da aba 12 concilia — seção não gerada)'); return None
    padrao = ANO_PADRAO if ANO_PADRAO in ok else ok[-1]
    for b in blocos:
        b['anos'] = {a: b['anos'][a] for a in ok}
        b['linhas'] = b['anos'][padrao]   # apelido do ano padrão: o que já lia 'linhas' não quebra
    apurado = datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%d/%m/%Y')
    mk = ('markup %.4f%%' % (markup * 100)) if markup is not None else 'markup nao lido'
    print(f'  modelo Fábrica x Loja: {os.path.basename(path)} | apurado em {apurado} | {mk} | conciliação OK: {", ".join(ok)}')
    return dict(anos=ok, ano_padrao=padrao, periodos={a: LABEL[a] for a in ok},
                periodo=LABEL[padrao], apurado=apurado, markup=markup, blocos=blocos)


# ---------------- 2c) CUSTO FIXO POR CATEGORIA · 12 meses, reconciliado com a DRE ----------------
MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
MESES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
CATS_CF = ['Pessoal','Facilities','Consumo','Marketing','Terceiros','Outros']

def derivar_custo_fixo(cf_cfg, cf_mensal, dpnl, max_ym_dre):
    """Custo fixo por categoria dos 12 meses até o último mês da DRE, com o TOTAL de cada entidade
    em cada mês igual à despesa operacional da DRE (abas REAL) — a mesma que a seção DRE mostra.

    A DRE não abre por categoria. A abertura vem, em ordem de preferência:
      1) do razão da aba _BD (cf_mensal), quando o mês existe nele;
      2) da abertura digitada da apresentação (config_apresentacao.json > custo_fixo), para os
         meses anteriores ao razão.
    Em qualquer caso as categorias são escaladas na proporção até a soma bater com a DRE — o peso
    relativo entre categorias é preservado e o total nunca diverge da seção DRE da mesma página.
    Mês sem abertura nenhuma entra inteiro em "Outros" e é avisado no console."""
    if not max_ym_dre or not dpnl:
        return cf_cfg
    yms = []
    y, m = max_ym_dre // 100, max_ym_dre % 100
    for _ in range(12):
        yms.append(y * 100 + m)
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    yms.reverse()
    ENTS = [('FABRICA', 'FABRICA', 'cat_fabrica', 'Fábrica'), ('DESIGN', 'LOJA', 'cat_loja', 'Loja')]

    # abertura do razão: (empresa, ym) -> {categoria: valor}
    razao = {}
    for e, ym, pac, _t, _c, v in (cf_mensal or {}).get('rows', []):
        cat = pac.capitalize() if pac else 'Outros'
        if cat not in CATS_CF: cat = 'Outros'
        d = razao.setdefault((e, ym), {})
        d[cat] = d.get(cat, 0.0) + v
    # abertura da apresentação: rótulos "Jul/25" -> aaaamm
    apres = {}
    for i, lab in enumerate((cf_cfg or {}).get('meses', [])):
        mm = lab[:3].capitalize(); aa = int(lab[-2:])
        idx = MESES_EN.index(mm) if mm in MESES_EN else (MESES_PT.index(mm) if mm in MESES_PT else None)
        if idx is None: continue
        ym = (2000 + aa) * 100 + idx + 1
        for _dk, _rk, ck, _rot in ENTS:
            apres[(ck, ym)] = {c: cf_cfg[ck][c][i] for c in CATS_CF if c in cf_cfg.get(ck, {})}

    out = {'meses': ['%s/%02d' % (MESES_PT[ym % 100 - 1], (ym // 100) % 100) for ym in yms],
           'entidade': {'Consolidado': [], 'Fábrica': [], 'Loja': []},
           'categoria': {c: [] for c in CATS_CF},
           'cat_fabrica': {c: [] for c in CATS_CF}, 'cat_loja': {c: [] for c in CATS_CF},
           'origem': []}
    for ym in yms:
        ano, mi_ = str(ym // 100), ym % 100 - 1
        origens = []
        cons = {c: 0.0 for c in CATS_CF}
        for dk, rk, ck, rot in ENTS:
            desp = dpnl.get(dk, {}).get(ano, {}).get('despesas_op')
            total = -desp[mi_] if desp else 0.0
            base, org = razao.get((rk, ym)), 'razão'
            if not base:
                base, org = apres.get((ck, ym)), 'apresentação'
            if not base or not sum(base.values()):
                base, org = {'Outros': 1.0}, 'sem abertura'
                print('    AVISO: custo fixo %s %s sem abertura por categoria — total da DRE lançado em Outros' % (rot, ym))
            soma = sum(base.values())
            fator = total / soma if soma else 0.0
            for c in CATS_CF:
                v = round(base.get(c, 0.0) * fator, 2)
                out[ck][c].append(v)
                cons[c] += v
            out['entidade'][rot].append(round(total, 2))
            origens.append(org)
        for c in CATS_CF:
            out['categoria'][c].append(round(cons[c], 2))
        out['entidade']['Consolidado'].append(round(out['entidade']['Fábrica'][-1] + out['entidade']['Loja'][-1], 2))
        out['origem'].append(origens[0] if origens[0] == origens[1] else '/'.join(origens))
    n_raz = sum(1 for o in out['origem'] if o == 'razão')
    print('  custo fixo por categoria: %s–%s | total = DRE | abertura: %d meses do razão, %d da apresentação ajustada'
          % (out['meses'][0], out['meses'][-1], n_raz, len(yms) - n_raz))
    return out

def montar_html(data, DRE, deck, dpnl, cf, custos, cart_din, cf_mensal, max_ym_dre,
                aportes, metas, fabloja=None, partes_rel=None, destaques=None):
    partes_rel = partes_rel or []
    destaques  = destaques  or {}
    j=lambda o: json.dumps(o,ensure_ascii=False,separators=(',',':'))
    MES_ABR=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    base_lab=(MES_ABR[(max_ym_dre%100)-1]+'/'+str(max_ym_dre//100)) if max_ym_dre else 'atualizada'
    blob=(f"window.DATA={j(data)};window.DRE={j(DRE)};window.DECK={j(deck)};window.DPNL={j(dpnl)};"
          f"window.CF={j(cf)};window.CUSTOS={j(custos)};window.CARTDIN={j(cart_din)};"
          f"window.CFMENSAL={j(cf_mensal)};window.MAXYM_DRE={j(max_ym_dre)};window.APORTES={j(aportes)};"
          f"window.METAS={j(metas)};window.FABLOJA={j(fabloja)};window.PARTES_RELACIONADAS={j(partes_rel)};"
          f"window.DESTAQUES_MANUAIS={j(destaques)};")
    doc=montar_doc(blob, base_lab)
    open(SAIDA,'w',encoding='utf-8').write(doc)
    return len(doc)


def montar_doc(blob, base_lab):
    """Monta o HTML final a partir do blob de dados ja serializado.

    Separado de montar_html de proposito: o aplicar_patch_html.py reaproveita esta funcao
    para regravar o relatorio com um app.js/css novo SEM reler as planilhas — os numeros da
    apresentacao ficam exatamente como estao, so o codigo muda."""
    css=open(os.path.join(AQUI,'style2.css'),encoding='utf-8').read()
    appjs=open(os.path.join(AQUI,'app.js'),encoding='utf-8').read()
    # camada de destaques: opcional — sem o arquivo o relatorio sai como antes
    ins_path=os.path.join(AQUI,'insights.js')
    insjs=open(ins_path,encoding='utf-8').read() if os.path.exists(ins_path) else ''
    return f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>+55 Design · Análise de Vendas e DRE</title>
<style>{css}</style></head><body>
<button id="navtoggle" aria-label="menu">☰</button>
<aside id="side"><div class="brand"><b>+55 Design</b><span>Vendas &amp; DRE · base até {base_lab}</span></div>
<nav id="nav"></nav>
<div class="side-foot">Base comercial · DRE por entidade · filtros interativos.</div>
<div class="side-tools"><a href="#" id="admintoggle" role="button" title="Escolher quais seções e blocos aparecem">Selecionar itens</a><a href="#" id="roteirobtn" role="button" title="Roteiro pronto para diretoria e acionistas — aplica a seleção e entra na apresentação">Reunião Executiva</a><a href="#" id="presentbtn" role="button" title="Modo apresentação — setas para navegar, Esc para sair">Apresentar</a></div></aside>
<div id="adminpanel" class="hidden">
  <div class="admin-box">
    <div class="admin-head"><b>Itens da apresentação</b><span>Escolha um roteiro e ajuste o que quiser — seção por seção e, dentro dela, bloco por bloco. A escolha fica salva neste navegador.</span></div>
    <div id="admin-roteiros" class="admin-roteiros"></div>
    <div id="admin-list" class="admin-list"></div>
    <div class="admin-actions">
      <span id="admin-resumo"></span>
      <button id="admin-exportar" title="Copiar esta seleção para levar a outro computador">Exportar</button>
      <button id="admin-importar" title="Colar uma seleção exportada">Importar</button>
      <button id="admin-voltar" title="Descartar os ajustes e recarregar o roteiro">Voltar ao roteiro</button>
      <button id="admin-salvar" title="Guardar esta seleção com um nome">Salvar como…</button>
      <button id="admin-all">Marcar todos</button>
      <button id="admin-none">Desmarcar todos</button>
      <button id="admin-close">Aplicar e fechar</button>
    </div>
  </div>
</div>
<main id="main"></main>
<footer>+55 Design — Análise interativa de vendas, carteira e DRE · gerada por gerar_relatorio.py</footer>
<script>{blob}</script>
<script>{appjs}</script>
{('<script>'+insjs+'</script>') if insjs else ''}
</body></html>"""

def main():
    if not os.path.isdir(FONTES):
        sys.exit('ERRO: pasta "fontes" não encontrada ao lado do script.')
    # sem padrão genérico nem fallback: "*Vendas*.xlsx" casaria com "Metas Vendas" ou "VENDAS LOJA"
    base=achar_estrito(['*Controle*Vendas*.xlsx'])
    dre =achar_estrito(['*Painel*Resultado*.xlsm','*Resultado*.xlsm'])
    if not base: sys.exit('ERRO: não encontrei a base comercial (.xlsx) em ./fontes.')
    if not dre:  sys.exit('ERRO: não encontrei o Painel de Resultado (.xlsm) em ./fontes.')
    print('Lendo fontes...')
    data=parse_vendas(base)
    dpnl=parse_dre(dre)
    DRE=derivar_receita(dpnl)
    cfg=json.load(open(os.path.join(AQUI,'config_apresentacao.json'),encoding='utf-8'))
    deck=cfg['carteira_apresentacao']
    custos=carregar_custos()
    cart_din=parse_carteira_dinamica()
    cf_mensal=parse_custo_fixo_mensal(dre)
    max_ym_dre=max_ym_bd2024(dre)
    cf=derivar_custo_fixo(cfg.get('custo_fixo'), cf_mensal, dpnl, max_ym_dre)
    print('  Painel Resultado — último mês (aba _BD):', max_ym_dre)
    aportes=parse_aportes()
    metas=parse_metas()
    fabloja=parse_fabloja()
    partes_rel=cfg.get('partes_relacionadas',[])
    destaques =cfg.get('destaques_manuais',{})
    n=montar_html(data, DRE, deck, dpnl, cf, custos, cart_din, cf_mensal, max_ym_dre,
                  aportes, metas, fabloja, partes_rel, destaques)
    print('  destaques: %d padroes de parte relacionada, %d textos manuais'
          % (len(partes_rel), len(destaques)))
    print('OK -> %s (%d KB)' % (os.path.basename(SAIDA), n//1024))

if __name__=='__main__':
    main()

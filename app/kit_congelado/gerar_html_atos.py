# -*- coding: utf-8 -*-
"""
+55 Design — Monta a versao "Roteiro em Atos" do relatorio
==========================================================
Le o Analise_Vendas_e_DRE_55Design.html que ja existe, retira dele o bloco de dados
(window.DATA=...) exatamente como esta, e grava um SEGUNDO arquivo com o mesmo
conteudo reorganizado na sequencia da reuniao — seis atos e, ao fim, os anexos
agrupados por tema.

O relatorio original NAO e tocado: este script so le. A reorganizacao inteira vive
no atos.js (movimentacao dos blocos) e no atos.css (o visual dos atos e anexos);
o calculo, os graficos e a interacao continuam sendo os do app.js.

Diferencas em relacao ao montar_doc() do gerar_relatorio.py:
  - entra o atos.css depois do style2.css, e o atos.js depois do insights.js;
  - entra um prelude que aponta o localStorage deste arquivo para chaves proprias,
    para que a selecao de itens/roteiro guardada no relatorio original nao esconda
    blocos aqui (os dois arquivos rodam na mesma origem e dividiriam a mesma chave);
  - o painel "Itens da apresentacao" nao vai para o HTML: aqui o roteiro E o
    documento. Quem quiser montar a propria selecao usa o relatorio original.

USO:
    python gerar_html_atos.py

SAIDA:
    Analise_Vendas_e_DRE_55Design_Atos.html
"""
import io, os, re, sys, json, base64, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(AQUI, 'img')
# ATOS_ORIGEM / ATOS_SAIDA permitem montar a versão em atos de um HTML de teste
# (ferramentas/conferir.py e viagem_tempo.py) sem tocar nos arquivos da raiz
ORIGEM = os.environ.get('ATOS_ORIGEM') or os.path.join(AQUI, 'Analise_Vendas_e_DRE_55Design.html')
SAIDA = os.environ.get('ATOS_SAIDA') or os.path.join(AQUI, 'Analise_Vendas_e_DRE_55Design_Atos.html')

# ---------------------------------------------------------------------------
# Imagens embutidas: o arquivo tem de viajar sozinho
# ---------------------------------------------------------------------------
# As fotos do showroom sao referenciadas como "img/p1.jpg" — caminho relativo,
# que so existe na maquina de quem gerou. Ao mandar o HTML por e-mail a pessoa
# recebe o relatorio sem a direcao de arte. Aqui cada arquivo vira um data: URI
# dentro do proprio documento.
#
# Sem reduzir, os 19 originais (1349x1800) somam 7,9 MB e virariam 10,5 MB em
# base64 — pesado demais para anexo. As fotos so aparecem como FUNDO de faixas
# largas e baixas (hero, abertura de capitulo), com scrim por cima: recortar na
# proporcao 3:2 no mesmo ponto que o CSS ancora (center 35%) e reamostrar para
# 1200x800 mantem a nitidez do que se ve e derruba o peso para ~2,7 MB.
FOTO_W, FOTO_H, FOTO_Q = 1200, 800, 72
LOGO_W = 600          # o logo aparece no maximo a ~380 px; 600 cobre telas retina


def _reduz_foto(caminho):
    """Recorta em 3:2 (ancora vertical em 35%, como o CSS) e reamostra."""
    from PIL import Image
    im = Image.open(caminho).convert('RGB')
    w, h = im.size
    alvo = FOTO_W / float(FOTO_H)
    if w / float(h) < alvo:                      # retrato: corta em cima e embaixo
        nh = int(w / alvo)
        topo = int((h - nh) * 0.35)
        im = im.crop((0, topo, w, topo + nh))
    else:                                        # paisagem larga demais: corta nas laterais
        nw = int(h * alvo)
        esq = int((w - nw) * 0.5)
        im = im.crop((esq, 0, esq + nw, h))
    im = im.resize((FOTO_W, FOTO_H), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=FOTO_Q, optimize=True, progressive=True)
    return buf.getvalue(), 'image/jpeg'


def _reduz_logo(caminho):
    """Mantem PNG (o logo tem transparencia) e so limita a largura."""
    from PIL import Image
    im = Image.open(caminho)
    if im.size[0] > LOGO_W:
        im = im.resize((LOGO_W, int(im.size[1] * LOGO_W / float(im.size[0]))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return buf.getvalue(), 'image/png'


def imagens_embutidas():
    """{nome do arquivo: data: URI}. Sem Pillow, embute o original sem reduzir."""
    if not os.path.isdir(IMG):
        return {}
    try:
        import PIL  # noqa: F401
        tem_pil = True
    except ImportError:
        tem_pil = False
        print('AVISO: Pillow nao encontrado — as imagens vao embutidas em tamanho original '
              '(arquivo bem maior). "pip install pillow" resolve.')
    mapa = {}
    for nome in sorted(os.listdir(IMG)):
        ext = os.path.splitext(nome)[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png'):
            continue
        caminho = os.path.join(IMG, nome)
        if not tem_pil:
            dados = io.open(caminho, 'rb').read()
            mime = 'image/png' if ext == '.png' else 'image/jpeg'
        elif ext == '.png':
            dados, mime = _reduz_logo(caminho)
        else:
            dados, mime = _reduz_foto(caminho)
        mapa[nome] = 'data:%s;base64,%s' % (mime, base64.b64encode(dados).decode('ascii'))
    return mapa


def css_com_imagens(css, mapa):
    """Troca url('img/x.jpg') por var(--art-x-jpg) e diz quais variaveis usou.

    O base64 NAO entra no CSS: ele ja esta no ART_MAP que o JavaScript carrega, e
    repetir aqui custaria mais de 1 MB (o style2.css cita a mesma foto em varias
    secoes). Quem preenche as variaveis e o prelude, a partir do proprio ART_MAP."""
    usados = {}

    def _troca(m):
        nome = m.group(1)
        if nome not in mapa:
            return m.group(0)
        var = '--art-' + re.sub(r'[^a-z0-9]+', '-', nome.lower())
        usados[var] = nome
        return 'var(%s)' % var

    return re.sub(r"url\(['\"]?img/([^'\")]+)['\"]?\)", _troca, css), usados


def css_vars_js(usados):
    """Script que define as variaveis CSS a partir do ART_MAP, antes de pintar."""
    if not usados:
        return ''
    pares = json.dumps(sorted(usados.items()), ensure_ascii=False)
    return ("(function(){var A=window.ART_MAP||{},d=document.documentElement;"
            + pares + ".forEach(function(p){ if(A[p[1]]) "
            "d.style.setProperty(p[0],'url(\"'+A[p[1]]+'\")'); });})();")

# O relatorio original e o de atos rodam na mesma origem (file:// ou o mesmo host),
# entao dividiriam localStorage. Sem isto, um roteiro salvo la esconderia blocos aqui.
PRELUDE = """(function(){
  var M={kit55AdminSel:'kit55AtosAdminSel',kit55Roteiro:'kit55AtosRoteiro',
         kit55Roteiros:'kit55AtosRoteiros'};
  var ls; try{ ls=window.localStorage; }catch(e){ return; }
  if(!ls) return;
  var g=ls.getItem.bind(ls), s=ls.setItem.bind(ls), r=ls.removeItem.bind(ls);
  var shim={
    getItem:function(k){ return g(M[k]||k); },
    setItem:function(k,v){ return s(M[k]||k,v); },
    removeItem:function(k){ return r(M[k]||k); },
    clear:function(){ Object.keys(M).forEach(function(k){ r(M[k]); }); },
    key:function(i){ return ls.key(i); }
  };
  Object.defineProperty(shim,'length',{get:function(){ return ls.length; }});
  try{ Object.defineProperty(window,'localStorage',{configurable:true,value:shim}); }catch(e){}
})();"""


def ler(nome):
    return io.open(os.path.join(AQUI, nome), encoding='utf-8').read()


def main():
    if not os.path.exists(ORIGEM):
        sys.exit('ERRO: nao encontrei %s — rode o gerar_relatorio.py primeiro.'
                 % os.path.basename(ORIGEM))

    html = io.open(ORIGEM, encoding='utf-8').read()

    m = re.search(r'<script>(window\.DATA=.*?)</script>', html, re.S)
    if not m:
        sys.exit('ERRO: nao achei o bloco window.DATA no HTML de origem. Arquivo fora do padrao?')
    blob = m.group(1)

    mb = re.search(r'base at&eacute;\s*([^<]+)</span>|base até\s*([^<]+)</span>', html)
    base_lab = ((mb.group(1) or mb.group(2)).strip() if mb else 'atualizada')

    # ART_MAP tem de existir ANTES do app.js: o pool de fotos (ART_POOL) e montado
    # na carga do arquivo, nao no init. Por isso entra junto do prelude.
    arte = imagens_embutidas()
    art_map = ('window.ART_MAP=' + json.dumps(arte, ensure_ascii=False) + ';') if arte else ''
    # liga os dois blocos do canal (esforco comercial e recorrencia da carteira);
    # o atos_ajustes.js so os monta quando esta chave esta declarada
    art_map += 'window.CANAL_ATIVO=true;'

    css, vars_arte = css_com_imagens(ler('style2.css'), arte)
    art_map += css_vars_js(vars_arte)
    css_atos = ler('atos.css')
    appjs = ler('app.js')
    insjs = ler('insights.js') if os.path.exists(os.path.join(AQUI, 'insights.js')) else ''
    # Os ajustes trocam line(), waterfall() e as regras de destaque; precisam estar
    # no lugar ANTES do init() do app.js, que e quem desenha. Por isso entram entre
    # o insights.js e o atos.js, e nao no fim do documento.
    ajustesjs = ler('atos_ajustes.js')
    atosjs = ler('atos.js')

    doc = u"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>+55 Design &middot; Roteiro Executivo em Atos</title>
<style>%(css)s</style>
<style>%(css_atos)s</style></head><body>
<button id="navtoggle" aria-label="menu">&#9776;</button>
<aside id="side"><div class="brand"><b>+55 Design</b><span>Vendas &amp; DRE &middot; base at&eacute; %(base)s</span></div>
<nav id="nav"></nav>
<div class="side-foot">Seis atos &middot; 46 min &middot; anexos completos ao fim.</div>
<div class="side-tools"><a href="#" id="presentbtn" role="button" title="Modo apresenta&ccedil;&atilde;o &mdash; setas para navegar, Esc para sair">Apresentar</a></div></aside>
<main id="main"></main>
<footer>+55 Design &mdash; Roteiro executivo em atos &middot; mesmo conte&uacute;do do relat&oacute;rio completo, na ordem da reuni&atilde;o &middot; gerado por gerar_html_atos.py</footer>
<script>%(art_map)s%(prelude)s</script>
<script>%(blob)s</script>
<script>%(appjs)s</script>
%(insjs)s
<script>%(ajustesjs)s</script>
<script>%(atosjs)s</script>
</body></html>""" % {
        'css': css, 'css_atos': css_atos, 'base': base_lab, 'prelude': PRELUDE,
        'blob': blob, 'appjs': appjs, 'atosjs': atosjs, 'ajustesjs': ajustesjs,
        'art_map': art_map,
        'insjs': ('<script>' + insjs + '</script>') if insjs else '',
    }

    if os.path.exists(SAIDA) and not os.environ.get('ATOS_SAIDA'):
        bkp = SAIDA + '.bak-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        io.open(bkp, 'w', encoding='utf-8', newline='').write(
            io.open(SAIDA, encoding='utf-8').read())
        print('backup            : %s' % os.path.basename(bkp))

    io.open(SAIDA, 'w', encoding='utf-8', newline='').write(doc)
    print('origem (intacta)  : %s' % os.path.basename(ORIGEM))
    print('imagens embutidas : %d arquivos · %d KB de data: URI'
          % (len(arte), sum(len(v) for v in arte.values()) // 1024))
    print('dados preservados : %d KB de blob (base ate %s)' % (len(blob) // 1024, base_lab))
    print('OK -> %s (%d KB)' % (os.path.basename(SAIDA), len(doc) // 1024))


if __name__ == '__main__':
    main()

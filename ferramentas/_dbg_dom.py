# -*- coding: utf-8 -*-
"""Diagnóstico: renderiza uma página já gerada em _revisao e mostra as réguas de destaque do DOM."""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, 'ferramentas'))
import conferir_secao as CS  # noqa: E402

sys.path.insert(0, os.path.join(CS.KIT, 'ferramentas'))
import retrato  # noqa: E402

arq = sys.argv[1] if len(sys.argv) > 1 else os.path.join(CS.REVISAO, 'biblioteca_ytd.html')
html = io.open(arq, encoding='utf-8').read()
sonda = ("<script>window.addEventListener('load',function(){setTimeout(function(){"
         "var d=window.__DESTAQUES||{};"
         "document.body.setAttribute('data-sonda',JSON.stringify({"
         "texto:typeof window.DESTAQUES_TEXTO, insrt:typeof window.INSRT,"
         "chaves:Object.keys(d),"
         "hl:document.querySelectorAll('.hl').length, digest:document.querySelectorAll('.digest').length,"
         "montou:(function(){try{INSRT.mount(document.getElementById('ytd'));return document.querySelectorAll('.digest').length;}catch(e){return 'ERRO '+e.message;}})(),"
         "strip:(function(){try{return INSRT.strip(d[Object.keys(d)[0]]).slice(0,120);}catch(e){return 'ERRO '+e.message;}})(),"
         "viaIns:(function(){try{return String(ins('serieOscilacao','serie-oscilacao-ytd')).slice(0,120);}catch(e){return 'ERRO '+e.message;}})()}));"
         "},1200);});</script>")
# espia o que chega ao strip(): o que o ins() encontrou no mapa de destaques
espia = ("<script>(function(){var s=INSRT.strip;INSRT.strip=function(o){"
         "(window.__LOG=window.__LOG||[]).push(o?Object.keys(o).join('+'):String(o));return s(o);};})();</script>")
marca = '<script src="static/relatorio/secoes/'
html = html.replace(marca, espia + marca, 1)
i = html.rfind('</body>')
arq_dbg = arq.replace('.html', '_sonda.html')
io.open(arq_dbg, 'w', encoding='utf-8').write(html[:i] + sonda + html[i:])
dom = retrato.renderizar(arq_dbg)
m = re.search(r'data-sonda="([^"]*)"', dom)
print('sonda:', (m.group(1) if m else 'não voltou').replace('&quot;', '"')[:600])
print('réguas no DOM:', dom.count('class="hl "') + dom.count('class="hl t-'), '| com data-ins:', dom.count('data-ins='))
for m in re.finditer(r'(<div class="hl[ "][^>]*>)', dom):
    print('régua:', m.group(1)[:200])
    print('   contexto:', re.sub(r'\s+', ' ', dom[max(0, m.start() - 300):m.start()])[-200:])
for m in re.finditer(r'<div class="hl[^"]*"[^>]*>(.{0,900})', dom, re.S):
    print('---')
    print(re.sub(r'\s+', ' ', m.group(1))[:500])

# -*- coding: utf-8 -*-
"""
Copia do Kit congelado (tag gabarito-v1) as funções de DESENHO e FORMATAÇÃO do app.js para
app/static/relatorio/kit.js, e o style2.css para app/static/relatorio/style2.css.

O desenho não é reescrito: é o mesmo código que gerou o gabarito. O cálculo (aggregate, dreAgg,
custosAgg...) NÃO é copiado — ele vive em Python (app/calculo) e chega ao navegador como números.

    python ferramentas/extrair_desenho.py
"""
import os
import re
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
TAG = 'gabarito-v1'
DESTINO = os.path.join(RAIZ, 'app', 'static', 'relatorio')

NOMES = [
    # cores, meses e formatação pt-BR
    'SER', 'INK', 'GOOD', 'RAMP', 'MES', 'PSEUDO_VEND', 'nf', 'money', 'mi', 'pct', 'spct', 'esc', 'trunc', 'W',
    # primitivas de gráfico e tabela
    'hbar', 'vbars', 'line', 'heatmap', 'stackbar', 'donut', 'pareto', 'shade', 'pie3D', 'table',
    'deltaHtml', 'deltaCost', 'spark', 'waterfall', 'stackedCols', 'evolCombo', 'stackedArea', 'boxLabel',
    'areaCum', 'comboMeta',
    # ferramentas de tabela (ordenar, CSV) e zoom
    '_cellNum', 'setupTableTools', 'addCsvChips', 'exportCsv', 'setupChartZoom', 'setupTableZoom', 'decorateTables',
    # helpers de montagem de HTML
    'kpi', 'call', 'H3', 'fig', 'cap', 'B', 'ymList', 'ymLab', 'ymShift', 'ymAddMonths', 'custosMesLab',
    'MES_LONGO', 'mesLongo',
    # marcação de blocos (data-blk-of)
    'marcarEm',
]


def declaracoes(js):
    """{nome: (inicio, fim)} de cada declaração de nível zero (const/let/function), incluindo o
    comentário que a precede. A declaração vai até o início da próxima."""
    linhas = js.split('\n')
    inicios = []
    for i, l in enumerate(linhas):
        m = re.match(r'(?:const|let|function)\s+([A-Za-z_$][\w$]*)', l)
        if m:
            inicios.append((i, m.group(1)))
    def sobe_comentarios(pos, limite):
        """Recua a partir de `pos` sobre linhas em branco, comentários // e blocos /* ... */ inteiros."""
        j = pos
        while j > limite:
            ant = linhas[j - 1]
            if not ant.strip() or ant.lstrip().startswith('//'):
                j -= 1
                continue
            if ant.rstrip().endswith('*/'):
                k = j - 1
                while k >= limite and '/*' not in linhas[k]:
                    k -= 1
                if k < limite:
                    break
                # só é bloco de comentário puro se nada de código antecede o /* na linha
                if linhas[k].split('/*', 1)[0].strip():
                    break
                j = k
                continue
            break
        return j

    out = {}
    for k, (i, nome) in enumerate(inicios):
        fim = inicios[k + 1][0] if k + 1 < len(inicios) else len(linhas)
        ini_ant = inicios[k - 1][0] + 1 if k > 0 else 0
        j = sobe_comentarios(i, ini_ant)          # comentário acima pertence a esta declaração
        f = sobe_comentarios(fim, i + 1)          # comentário da próxima sai do fim deste trecho
        while j < i and not linhas[j].strip():
            j += 1
        out.setdefault(nome, (j, f))
    return linhas, out


def main():
    js = subprocess.run(['git', '-C', KIT, 'show', TAG + ':app.js'], capture_output=True, text=True,
                        encoding='utf-8').stdout
    css = subprocess.run(['git', '-C', KIT, 'show', TAG + ':style2.css'], capture_output=True, text=True,
                         encoding='utf-8').stdout
    linhas, decl = declaracoes(js)
    faltam = [n for n in NOMES if n not in decl]
    if faltam:
        raise SystemExit('não achei no app.js: %s' % faltam)
    trechos = sorted({decl[n] for n in NOMES})
    corpo = '\n\n'.join('\n'.join(linhas[a:b]).rstrip() for a, b in trechos)
    cab = ('/* ===== +55 · desenho do relatório =====\n'
           '   GERADO por ferramentas/extrair_desenho.py a partir do app.js do Kit na tag %s.\n'
           '   Não editar à mão: é o mesmo código que desenhou o gabarito. O cálculo vem do servidor.\n'
           '   ====================================================================== */\n'
           "'use strict';\n"
           '/* destaques chegam na fase 4: por ora nenhuma régua */\n'
           'const ins=()=>null;\nconst remount=()=>{};\n\n') % TAG
    os.makedirs(DESTINO, exist_ok=True)
    open(os.path.join(DESTINO, 'kit.js'), 'w', encoding='utf-8').write(cab + corpo + '\n')
    open(os.path.join(DESTINO, 'style2.css'), 'w', encoding='utf-8').write(css)
    print('kit.js: %d declarações, %d linhas | style2.css copiado' % (len(NOMES), corpo.count('\n') + 1))


if __name__ == '__main__':
    main()

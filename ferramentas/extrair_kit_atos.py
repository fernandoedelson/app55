# -*- coding: utf-8 -*-
"""
Copia para app/kit_congelado/ o front-end do Kit EXATAMENTE como está na tag gabarito-v1:
o app.js, o insights.js, o style2.css, a camada da versão em Atos (atos.js, atos_ajustes.js,
atos.css), os dois geradores (gerar_relatorio.py e gerar_html_atos.py) e as imagens.

    python ferramentas/extrair_kit_atos.py

Nada é editado na cópia: é por isso que a apresentação sai idêntica ao HTML aprovado. Um
MANIFESTO.json guarda o sha256 de cada arquivo, e a aplicação confere o manifesto antes de
gerar — arquivo mexido à mão faz a geração parar, em vez de sair uma apresentação "quase igual".
"""
import hashlib
import json
import os
import shutil
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = r'C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design'
TAG = 'gabarito-v1'
DESTINO = os.path.join(RAIZ, 'app', 'kit_congelado')
ARQUIVOS = ['app.js', 'insights.js', 'style2.css', 'atos.js', 'atos_ajustes.js', 'atos.css',
            'gerar_relatorio.py', 'gerar_html_atos.py']


def da_tag(caminho):
    r = subprocess.run(['git', '-C', KIT, 'show', '%s:%s' % (TAG, caminho)], capture_output=True)
    if r.returncode:
        raise SystemExit('não achei %s na tag %s' % (caminho, TAG))
    return r.stdout


def main():
    shutil.rmtree(DESTINO, ignore_errors=True)
    os.makedirs(os.path.join(DESTINO, 'img'))
    imagens = subprocess.run(['git', '-C', KIT, 'ls-tree', '-r', '--name-only', TAG, 'img'],
                             capture_output=True, text=True).stdout.split()
    manifesto = {}
    for caminho in ARQUIVOS + imagens:
        dados = da_tag(caminho)
        with open(os.path.join(DESTINO, caminho), 'wb') as f:
            f.write(dados)
        manifesto[caminho] = hashlib.sha256(dados).hexdigest()
    with open(os.path.join(DESTINO, '__init__.py'), 'w', encoding='utf-8') as f:
        f.write('# cópia literal do front-end do Kit na tag %s — não editar (ver MANIFESTO.json)\n' % TAG)
    json.dump({'tag': TAG, 'arquivos': manifesto}, open(os.path.join(DESTINO, 'MANIFESTO.json'), 'w'),
              indent=1, sort_keys=True)
    print('%d arquivos copiados da tag %s para app/kit_congelado' % (len(manifesto), TAG))


if __name__ == '__main__':
    main()

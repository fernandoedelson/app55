# -*- coding: utf-8 -*-
"""
Gera app/importacao/dados/municipios_br.json: o ponto central (latitude, longitude) de cada município do Brasil,
para pôr no mapa a cidade de cada escritório de arquitetura. Só é preciso rodar de novo se o IBGE criar município.

    python ferramentas/gerar_municipios_br.py

Fontes (API pública do IBGE, sem chave):
  https://servicodados.ibge.gov.br/api/v1/localidades/municipios          nomes e UF de cada município
  https://servicodados.ibge.gov.br/api/v3/malhas/estados/<UF>?...         contornos (malha mínima) de cada município do estado

Os contornos baixados ficam em uma pasta temporária e são descartados: só o centro de cada município vai para o app.
Formato: {"SP": {"SAO PAULO": [-23.55, -46.63, "São Paulo"], ...}, ...}   (chave = nome sem acento, em maiúsculas)
"""
import gzip
import json
import os
import shutil
import tempfile
import unicodedata
import urllib.request

from shapely.geometry import shape

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'app', 'importacao', 'dados', 'municipios_br.json')
UF_COD = {'RO': 11, 'AC': 12, 'AM': 13, 'RR': 14, 'PA': 15, 'AP': 16, 'TO': 17, 'MA': 21, 'PI': 22, 'CE': 23, 'RN': 24, 'PB': 25,
          'PE': 26, 'AL': 27, 'SE': 28, 'BA': 29, 'MG': 31, 'ES': 32, 'RJ': 33, 'SP': 35, 'PR': 41, 'SC': 42, 'RS': 43, 'MS': 50,
          'MT': 51, 'GO': 52, 'DF': 53}


def chave(nome):
    s = unicodedata.normalize('NFD', str(nome)).encode('ascii', 'ignore').decode().upper()
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in s).split())


def baixar(url):
    req = urllib.request.Request(url, headers={'Accept-Encoding': 'gzip', 'User-Agent': '+55-design-app'})
    with urllib.request.urlopen(req, timeout=120) as r:
        dados = r.read()
        if r.headers.get('Content-Encoding') == 'gzip' or dados[:2] == bytes([0x1f, 0x8b]):
            dados = gzip.decompress(dados)
        return json.loads(dados.decode('utf-8'))


def main():
    tmp = tempfile.mkdtemp(prefix='ibge-mun-')
    try:
        nomes = {}
        for m in baixar('https://servicodados.ibge.gov.br/api/v1/localidades/municipios'):
            uf = m['microrregiao']['mesorregiao']['UF']['sigla'] if m.get('microrregiao') else m['regiao-imediata']['regiao-intermediaria']['UF']['sigla']
            nomes[str(m['id'])] = (uf, m['nome'])
        out, total = {}, 0
        for uf, cod in UF_COD.items():
            gj = baixar('https://servicodados.ibge.gov.br/api/v3/malhas/estados/%d?formato=application/vnd.geo%%2Bjson&qualidade=minima&intrarregiao=municipio' % cod)
            with open(os.path.join(tmp, uf + '.json'), 'w', encoding='utf-8') as f:
                json.dump(gj, f)
            for ft in gj['features']:
                cid = ft['properties']['codarea']
                if cid not in nomes:
                    continue
                c = shape(ft['geometry']).representative_point()
                out.setdefault(uf, {})[chave(nomes[cid][1])] = [round(c.y, 3), round(c.x, 3), nomes[cid][1]]
                total += 1
            print(uf, len(out.get(uf, {})), flush=True)
        os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
        with open(SAIDA, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        print('municipios_br.json: %d municípios, %d KB' % (total, os.path.getsize(SAIDA) // 1024))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()

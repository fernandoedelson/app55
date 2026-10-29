# -*- coding: utf-8 -*-
"""
Gera app/static/relatorio/mapa_br.js: o desenho do mapa do Brasil para o bloco "Mapa de vendas".

    python ferramentas/gerar_mapa_br.py

Entradas
  ferramentas/dados_geo/uf_br_ibge.json   divisas dos 27 estados, malha simplificada do IBGE
      (https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF)
  naturalearth_lowres (geopandas/pyogrio)  os países vizinhos, só como moldura

Saída: um .js estático com os caminhos SVG já projetados (viewBox 600 x 640) e o centro de cada UF onde a bolha é posta.
O mapa roda sem internet: nada é buscado no navegador.
"""
import json
import os

import geopandas as gpd

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(RAIZ, 'ferramentas', 'dados_geo', 'uf_br_ibge.json')
SAIDA = os.path.join(RAIZ, 'app', 'static', 'relatorio', 'mapa_br.js')
W, H = 600, 640
LON0, LON1, LAT0, LAT1 = -74.5, -33.5, -34.5, 5.8
COD = {'11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
       '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
       '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'}
# onde a bolha de cada UF é posta (centro aproximado do estado): latitude, longitude
CENTRO = {'AC': (-9.0, -70.8), 'AL': (-9.6, -36.8), 'AP': (1.4, -51.8), 'AM': (-3.9, -64.6), 'BA': (-12.5, -41.7), 'CE': (-5.2, -39.3),
          'DF': (-15.8, -47.9), 'ES': (-19.6, -40.5), 'GO': (-15.9, -49.8), 'MA': (-5.0, -45.3), 'MT': (-12.9, -55.9),
          'MS': (-20.5, -54.8), 'MG': (-18.5, -44.6), 'PA': (-3.8, -52.5), 'PB': (-7.1, -36.8), 'PR': (-24.6, -51.5),
          'PE': (-8.3, -37.9), 'PI': (-7.7, -42.7), 'RJ': (-22.3, -42.7), 'RN': (-5.8, -36.6), 'RS': (-29.6, -53.2),
          'RO': (-10.9, -62.8), 'RR': (2.1, -61.4), 'SC': (-27.3, -50.5), 'SP': (-22.2, -48.7), 'SE': (-10.6, -37.4),
          'TO': (-10.2, -48.3)}


def X(lon):
    return (lon - LON0) / (LON1 - LON0) * W


def Y(lat):
    return (LAT1 - lat) / (LAT1 - LAT0) * H


def caminho(geom):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    return ' '.join('M' + ' L'.join('%.1f,%.1f' % (X(x), Y(y)) for x, y in anel) + 'Z' for poly in polys for anel in poly)


def main():
    mundo = gpd.read_file(os.path.join(os.path.dirname(gpd.__file__), '..', 'pyogrio', 'tests', 'fixtures',
                                       'naturalearth_lowres', 'naturalearth_lowres.shp'))
    viz = ' '.join(caminho(json.loads(gpd.GeoSeries([r.geometry]).to_json())['features'][0]['geometry'])
                   for _, r in mundo[(mundo.continent == 'South America') & (mundo['name'] != 'Brazil')].iterrows())
    ufs = {COD[f['properties']['codarea']]: caminho(f['geometry']) for f in json.load(open(GEO, encoding='utf-8'))['features']}
    assert len(ufs) == 27, len(ufs)
    centros = {uf: [round(X(lo), 1), round(Y(la), 1)] for uf, (la, lo) in CENTRO.items()}
    obj = {'w': W, 'h': H, 'vizinhos': viz, 'ufs': ufs, 'centros': centros}
    with open(SAIDA, 'w', encoding='utf-8') as f:
        f.write('/* Gerado por ferramentas/gerar_mapa_br.py — divisas dos estados: IBGE (malha simplificada). Não editar à mão. */\n')
        f.write('window.MAPA_BR=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('mapa_br.js: %d UF, %d KB' % (len(ufs), os.path.getsize(SAIDA) // 1024))


if __name__ == '__main__':
    main()

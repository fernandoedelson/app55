# -*- coding: utf-8 -*-
"""
Checagem antes de subir uma versão. Roda a aplicação como ela vai rodar no Render (cookie seguro,
proxy, HTTPS obrigatório) e confere o que não pode estar errado.

    python ferramentas/pre_deploy.py

Regra da especificação: **só checagem de segurança barra o deploy**. O resto vira aviso — some
com o aviso quando der, mas ele não impede a subida.
"""
import os
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

FALHAS, AVISOS = [], []


def seguranca(nome, ok, detalhe=''):
    print('%-4s %s%s' % ('OK' if ok else 'PARA', nome, ('' if ok else ' — ' + detalhe)))
    if not ok:
        FALHAS.append(nome)


def aviso(nome, ok, detalhe=''):
    print('%-4s %s%s' % ('OK' if ok else 'aviso', nome, ('' if ok else ' — ' + detalhe)))
    if not ok:
        AVISOS.append(nome)


def main():
    os.environ['APP55_ADMIN_LOGIN'] = 'admin'
    os.environ['APP55_ADMIN_SENHA'] = 'PreDeploy2026ab'
    tmp = tempfile.mkdtemp(prefix='app55-predeploy-')
    from app import criar_app
    app = criar_app({'DATA_DIR': tmp, 'DB_PATH': os.path.join(tmp, 'p.db'), 'SECRET_KEY': 'x' * 40,
                     'SESSION_COOKIE_SECURE': True, 'SESSION_COOKIE_NAME': '__Host-app55',
                     'TRUST_PROXY': True, 'FORCE_HTTPS': True,
                     'COMPETENCIAS_DIR': os.path.join(RAIZ, 'data', 'competencias')})
    c = app.test_client()

    print('\n== segurança (barra o deploy) ==')
    seguranca('modo de depuração desligado', not app.debug and not app.testing)
    r = c.get('/entrar', base_url='https://exemplo')
    h = r.headers
    for cab in ('Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'):
        seguranca('cabeçalho %s' % cab, cab in h, 'resposta sem o cabeçalho')
    seguranca('HSTS em HTTPS', 'Strict-Transport-Security' in h, 'sem HSTS com FORCE_HTTPS ligado')
    cookie = r.headers.get('Set-Cookie', '')
    if cookie:
        seguranca('cookie Secure + HttpOnly + SameSite',
                  'Secure' in cookie and 'HttpOnly' in cookie and 'SameSite' in cookie, cookie[:120])
    seguranca('http vira https', c.get('/entrar', base_url='http://exemplo').status_code in (301, 302, 308))
    seguranca('POST sem CSRF é recusado',
              c.post('/entrar', data={'username': 'admin', 'password': 'PreDeploy2026ab'},
                     base_url='https://exemplo').status_code == 400)
    seguranca('página interna exige login', c.get('/', base_url='https://exemplo').status_code in (302, 401, 403))
    seguranca('a chave de sessão não está no git',
              b'.secret_key' not in subprocess.run(['git', 'ls-files'], cwd=RAIZ, capture_output=True).stdout)
    rastreados = subprocess.run(['git', 'ls-files', 'data'], cwd=RAIZ, capture_output=True).stdout
    seguranca('nenhum dado versionado', not rastreados.strip(), rastreados.decode('utf-8', 'replace')[:200])

    with app.app_context():
        from app import catalogo as C
        from app.db import get_db
        validas = C.todas_permissoes_validas()
        invalidas = [r['recurso'] for r in get_db().execute('SELECT DISTINCT recurso FROM perfil_permissoes')
                     if r['recurso'] not in validas]
        seguranca('nenhuma permissão fora do catálogo', not invalidas, ', '.join(invalidas[:5]))

    print('\n== conferências (não barram) ==')
    aviso('/saude responde', c.get('/saude', base_url='https://exemplo').get_json(silent=True) == {'ok': True})
    with app.app_context():
        from app import calculo
        from app import catalogo as C
        from app.calculo import competencia as comp_mod
        comps = comp_mod.disponiveis(app.config)
        aviso('há competência publicada', bool(comps), 'a Biblioteca não tem o que mostrar')
        faltam = [s['id'] for s in C.SECOES if s['id'] not in calculo.SECOES_PORTADAS]
        aviso('todas as seções portadas', not faltam, ', '.join(faltam))
    testes = subprocess.run([sys.executable, '-m', 'pytest', '-q'], cwd=RAIZ, capture_output=True)
    aviso('pytest', testes.returncode == 0, testes.stdout.decode('utf-8', 'replace').strip().splitlines()[-1:][0]
          if testes.stdout else 'sem saída')

    print('\n%s' % ('-' * 60))
    if FALHAS:
        print('NÃO SUBIR: %d checagem(ns) de segurança falharam — %s' % (len(FALHAS), ', '.join(FALHAS)))
    else:
        print('Segurança: tudo certo.%s' % ((' Avisos: ' + ', '.join(AVISOS)) if AVISOS else ''))
    sys.exit(1 if FALHAS else 0)


if __name__ == '__main__':
    main()

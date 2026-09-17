# Aplicação +55 Design

Relatório de Vendas, DRE e Custos da +55 com login, perfis e permissões por bloco.
Especificação: https://claude.ai/code/artifact/c8c0c6ac-211a-4534-8e0c-8c903369d77e

## Fases

| Fase | Situação |
| --- | --- |
| 0. Arrumar o Kit (datas, defeitos) | concluída — Kit na tag `gabarito-v1` |
| 1. Gabarito | concluída — `C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design\_referencia\gabarito\2026-07` |
| 2. Fundação (login, perfis, permissões, auditoria, ver como, catálogo) | concluída localmente |
| 3. Cálculo no servidor | próxima |

## Rodar localmente

    C:\Scripts\WPy64-31700\python\python.exe wsgi.py        # http://localhost:5055

No primeiro início é criado o usuário `admin` com senha provisória mostrada UMA vez no console
(ou a de `APP55_ADMIN_SENHA`). O banco fica em `data/app55.db` (fora do git).

## Testes

    C:\Scripts\WPy64-31700\python\python.exe -m pytest -q

Cobrem: cabeçalhos, CSRF, mensagem genérica de login, bloqueio após 5 falhas, limite por IP,
troca obrigatória no 1º acesso, troca de senha derrubando outros aparelhos, inatividade (60 min),
prazo absoluto (8 h), logout só por POST, redirecionamento aberto, "esqueci a senha" sem revelar
usuário nem mostrar link, token de uso único, perfil vendo só os blocos liberados, permissão
inventada descartada, cascata com confirmação, "ver como perfil" só leitura e auditado, proteção
do último administrador, desativação derrubando a sessão e o catálogo contra o gabarito.

Revisão visual sem digitar senha no navegador: `python ferramentas/telas_para_revisao.py` gera as
telas internas em `_revisao/` (servir com `python -m http.server 5056 --directory _revisao`).

## Estrutura

    app/catalogo/dados.py     seções e blocos — estrutura do relatório, só muda por commit
    app/catalogo/__init__.py  recursos, bases, validação de permissões, dependências
    app/seguranca/            senha, usuários e permissões, reset, e-mail, proteções por requisição
    app/rotas/                auth (entrar/sair/senhas), inicio, admin
    app/db.py                 SQLite WAL, schema, perfis iniciais, administrador inicial
    tests/                    pytest

Permissões são textos explícitos: `bloco:<id>`, `recurso:<id>`, `base:upload:<id>`, `admin`.
"Liberar a seção inteira" grava um `bloco:` por bloco existente — bloco criado depois nasce negado.

## Render (Starter)

`render.yaml` + `Dockerfile`: 1 worker, disco em `/app/data`, TLS no proxy (`APP55_TRUST_PROXY`,
`APP55_FORCE_HTTPS`, `APP55_COOKIE_SEGURO`), `APP55_SECRET_KEY` gerada pelo Render. Credenciais de
e-mail e do administrador inicial ficam fora do git (`sync: false`). Atualizações do site: manuais,
fora do expediente, nunca em dia de reunião.

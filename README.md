# Aplicação +55 Design

Relatório de Vendas, DRE e Custos da +55 com login, perfis e permissões por bloco.
Especificação: https://claude.ai/code/artifact/c8c0c6ac-211a-4534-8e0c-8c903369d77e

## Fases

| Fase | Situação |
| --- | --- |
| 0. Arrumar o Kit (datas, defeitos) | concluída — Kit na tag `gabarito-v1` |
| 1. Gabarito | concluída — `C:\Scripts\Kit_Relatorio_Vendas_DRE_55Design\_referencia\gabarito\2026-07` |
| 2. Fundação (login, perfis, permissões, auditoria, ver como, catálogo) | concluída localmente |
| 3. Cálculo no servidor (17 seções, 122 blocos) | concluída — igual ao gabarito bloco a bloco |
| 4. Destaques (50 regras, 114 destaques) | concluída — igual ao gabarito completo |
| 5. Fechamento e importação pela tela | concluída — a app reproduz as 14 bases da competência publicada |
| 6. Comentários das áreas | próxima |

## Rodar localmente

Clique duas vezes em **`+55 Design.bat`** (abre o navegador em http://localhost:5055 e deixa a
janela do servidor aberta), ou pela linha de comando:

    C:\Scripts\WPy64-31700\python\python.exe wsgi.py        # http://localhost:5055

No primeiro início é criado o usuário `admin` com senha provisória mostrada UMA vez no console
(ou a de `APP55_ADMIN_SENHA`). O banco fica em `data/app55.db` (fora do git).

Perdeu a senha provisória (ou a janela fechou)? Defina a sua, digitada no terminal:

    C:\Scripts\WPy64-31700\python\python.exe ferramentas\senha_admin.py

Ela derruba as sessões abertas do usuário e dispensa a troca obrigatória no acesso seguinte.

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

## Conferência contra o Kit congelado

O critério de pronto da fase 3 é a igualdade com o relatório aprovado, bloco a bloco:

    python ferramentas/conferir_secao.py dre custos ...    # tela inicial x gabarito
    python ferramentas/conferir_estado.py dre custos ...   # estados filtrados x Kit congelado

    python ferramentas/conferir_destaques.py               # slots do desenho x destaques x textos
    python ferramentas/conferir_importacao.py              # importar pela app x competência publicada

O primeiro compara com o retrato do gabarito (`--com-destaques` usa o retrato completo). O segundo roda um roteiro de cliques no
HTML congelado do Kit e pede ao app a mesma seção com os filtros na URL; os detalhamentos (itens de
um pedido, composição de um pacote, clientes de um segmento…) são buscados antes pelo cliente de
teste e servidos à página por um fetch substituto, porque a página é aberta como arquivo.

## Estrutura

    app/catalogo/dados.py     seções e blocos — estrutura do relatório, só muda por commit
    app/catalogo/__init__.py  recursos, bases, validação de permissões, dependências
    app/seguranca/            senha, usuários e permissões, reset, e-mail, proteções por requisição
    app/rotas/                auth (entrar/sair/senhas), inicio, admin, biblioteca
    app/calculo/              cálculo por seção (porte do app.js) — devolve números brutos por bloco
    app/destaques/            regras de 2º grau: o que merece régua no gráfico e linha no digest
    app/importacao/           kit_parser.py (leitura das planilhas), motor, comparar e serviço do ciclo
    app/static/relatorio/     kit.js (desenho extraído do Kit) e secoes/<id>.js (uma seção cada)
    app/db.py                 SQLite WAL, schema, perfis iniciais, administrador inicial
    tests/                    pytest

Permissões são textos explícitos: `bloco:<id>`, `recurso:<id>`, `base:upload:<id>`, `admin`.
"Liberar a seção inteira" grava um `bloco:` por bloco existente — bloco criado depois nasce negado.

## Render (Starter)

`render.yaml` + `Dockerfile`: 1 worker, disco em `/app/data`, TLS no proxy (`APP55_TRUST_PROXY`,
`APP55_FORCE_HTTPS`, `APP55_COOKIE_SEGURO`), `APP55_SECRET_KEY` gerada pelo Render. Credenciais de
e-mail e do administrador inicial ficam fora do git (`sync: false`). Atualizações do site: manuais,
fora do expediente, nunca em dia de reunião.

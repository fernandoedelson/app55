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
| 6. Comentários das áreas | concluída — escrever, consolidar, curar e publicar o texto |
| 7. Reunião e apresentação | concluída — atos, canal, comentários e encaminhamentos |
| 8. Entrada no ar | pronta do lado do código — falta criar o serviço no Render |

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
    python ferramentas/conferir_apresentacao.py            # a reunião em atos x gabarito, bloco a bloco

O primeiro compara com o retrato do gabarito (`--com-destaques` usa o retrato completo). O segundo roda um roteiro de cliques no
HTML congelado do Kit e pede ao app a mesma seção com os filtros na URL; os detalhamentos (itens de
um pedido, composição de um pacote, clientes de um segmento…) são buscados antes pelo cliente de
teste e servidos à página por um fetch substituto, porque a página é aberta como arquivo.

## Comentário da área

O comentário mora em cima do dado. Com o mês aberto às áreas (Fechamento → etapa 4, com prazo), cada
gráfico ou tabela que a área enxerga traz, ao lado do título, o botão **Comentar** — ou o estado do
comentário: Rascunho, Enviado, Devolvido, Aprovado. O clique abre um painel lateral com o gráfico ainda
à vista: a área escreve, o responsável envia, e a Controladoria cura no mesmo painel (aprovar, ajustar
avisando o autor, devolver, recusar com motivo, pedir comentário a outra área, marcar para a
apresentação). O comentário aprovado aparece logo abaixo do título do gráfico para todo mundo que
enxerga aquele bloco; na Reunião, só os marcados para a apresentação.

**Pendências** (menu do topo, com contador) é só a caixa de entrada: pedidos da Controladoria,
devolvidos, rascunhos e — para quem cura — o que falta curar. Cada item leva direto ao gráfico com o
painel aberto (`/biblioteca/<seção>?comentar=<bloco>`).

Permissões: `recurso:comentar` (a área é o perfil), `recurso:consolidar` (responsável que envia — um
perfil extra só com isso), `recurso:curar_comentarios` (Controladoria).

Revisão de telas sem digitar senha: `python ferramentas/servidor_revisao.py` (porta 5058, banco
temporário, usuários de teste por perfil, `/revisao/entrar/<login>`). O atalho de entrada existe só
nesse processo de revisão.

## A reunião

`/apresentacao/<competência>` entrega a **versão em Atos do Kit, idêntica byte a byte ao HTML
aprovado**: menu lateral que recolhe, fotos, capítulos, modo Apresentar, zoom com laser e tudo o mais.
Não há reconstrução: `app/apresentacao/kit_atos.py` serializa os dados da competência como o
`montar_html` do Kit e passa pelo `montar_doc` e pelo `gerar_html_atos.py` do próprio Kit, copiados
literalmente da tag `gabarito-v1` para `app/kit_congelado/` (`ferramentas/extrair_kit_atos.py`, com
MANIFESTO.json de hashes conferido antes de cada geração). O teste
`tests/test_apresentacao_kit.py` compara a resposta da rota com `relatorio_atos.html` do gabarito.

O documento do Kit carrega os dados do mês inteiros (o cálculo roda no navegador). Por isso só vai para
quem enxerga **todos** os blocos; perfil com acesso parcial recebe o roteiro filtrado
(`reuniao.html`, só com os blocos dele) e nunca o `window.DATA`. Baixar o HTML exige também
`recurso:exportar`. A apresentação gerada fica em `data/apresentacoes/` e é refeita quando a
competência muda.

Os encaminhamentos têm página própria (`/apresentacao/<competência>/encaminhamentos`): o responsável
marca feito, a Controladoria confirma, e o que não foi confirmado volta como retomada no mês seguinte.
Como o documento é o aprovado sem acréscimos, os comentários das áreas não aparecem dentro dele — ficam
no relatório, em cima de cada gráfico.

## Estrutura

    app/catalogo/dados.py     seções e blocos — estrutura do relatório, só muda por commit
    app/catalogo/__init__.py  recursos, bases, validação de permissões, dependências
    app/seguranca/            senha, usuários e permissões, reset, e-mail, proteções por requisição
    app/rotas/                auth (entrar/sair/senhas), inicio, admin, biblioteca
    app/calculo/              cálculo por seção (porte do app.js) — devolve números brutos por bloco
    app/destaques/            regras de 2º grau: o que merece régua no gráfico e linha no digest
    app/importacao/           kit_parser.py (leitura das planilhas), motor, comparar e serviço do ciclo
    app/apresentacao/         o roteiro em atos e os encaminhamentos da reunião
    app/comentarios.py        comentário da área: escrever, enviar, curar, histórico e painel
    app/static/relatorio/     kit.js (desenho extraído do Kit) e secoes/<id>.js (uma seção cada)
    app/db.py                 SQLite WAL, schema, perfis iniciais, administrador inicial
    tests/                    pytest

Permissões são textos explícitos: `bloco:<id>`, `recurso:<id>`, `base:upload:<id>`, `admin`.
"Liberar a seção inteira" grava um `bloco:` por bloco existente — bloco criado depois nasce negado.

## Entrada no ar (Render Starter)

`render.yaml` + `Dockerfile`: 1 worker com 4 threads, disco persistente em `/app/data` (banco,
competências e planilhas enviadas), TLS no proxy do Render (`APP55_TRUST_PROXY`, `APP55_FORCE_HTTPS`,
`APP55_COOKIE_SEGURO`), `APP55_SECRET_KEY` gerada pelo Render e estável entre deploys. Fuso de Brasília
na imagem. Checagem de saúde em `/saude`.

**Antes de cada subida**

    python ferramentas/pre_deploy.py

Roda a app como em produção e confere cabeçalhos, HSTS, cookie `__Host-` seguro, redirecionamento
para HTTPS, CSRF, login obrigatório, nada de dado ou chave no git e nenhuma permissão fora do
catálogo. **Só essas checagens barram o deploy**; pytest, `/saude` e seções portadas viram aviso.

**Primeira subida (feita por quem tem a conta do Render)**

1. New → Blueprint → repositório `fernandoedelson/app55` (o `render.yaml` cria serviço e disco).
2. Preencher no painel as variáveis marcadas `sync: false`: `APP55_ADMIN_LOGIN`, `APP55_ADMIN_SENHA`
   (troca obrigatória no 1º acesso), `SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` (Gmail da Controladoria,
   com senha de app) e `APP_BASE_URL` (o endereço `…onrender.com`).
3. Levar os dados: no primeiro acesso não há competência publicada. Suba as bases de 2026-07 pela
   tela de Fechamento (é o mesmo leitor do Kit — `conferir_importacao.py` prova 14/14 bases) ou
   copie `data/competencias/2026-07` para o disco pelo Shell do Render.
4. Alerta de queda: um monitor externo (UptimeRobot ou similar, gratuito) batendo em `/saude`
   a cada 5 min, avisando o e-mail da Controladoria.

**Rotina**

- Deploy manual, fora do expediente e nunca em dia de reunião (Manual Deploy no painel; o
  `autoDeploy` fica desligado).
- Backup: Administração → Backup. "Tudo" leva o banco (dump SQL) + competências + planilhas; por
  competência leva só aquele mês. A chave de sessão nunca entra no pacote. Guardar fora do git.
- Restaurar: `sqlite3 data/app55.db < app55.sql` e copiar `competencias/` e `fontes/` de volta.

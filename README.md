# Gestão de Uniformes

Aplicação administrativa para catálogo compartilhado, estoque independente por loja e solicitações de colaboradores. Next.js 15, React 19, TypeScript, Prisma 6 e PostgreSQL. Interface em português brasileiro, mantendo a identidade visual existente.

## Funcionamento atual

- **Master Admin:** visão inicial de todas as lojas, filtro por unidade, administração de lojas/usuários e manutenção do catálogo, fotos, setores e categorias.
- **Administrador de loja:** estoque e pedidos da própria unidade. As APIs derivam a loja da sessão, independentemente dos parâmetros do navegador.
- **Colaborador:** `/solicitar`, sem login, identifica-se por LDAP de oito dígitos e nome. Escolhe setor, uniforme, classificação e tamanho; peças do setor `Todos` são comuns. O catálogo público não transmite saldos internos ou reservas.
- **Painel:** indicadores do escopo completo, incluindo **No mínimo ou abaixo** (`saldo <= mínimo`), e até quatro pedidos pendentes recentes. O carregamento inicial não traz colaboradores nem o histórico completo.
- **Estoque:** todos os registros, inclusive zerados; busca e categoria locais, contagem exibida/total e seleção explícita de até 200 registros. Ao ultrapassar o limite combinando filtros, a seleção permanece intacta e a interface explica como continuar. CSV completo do escopo, independente dos filtros locais.
- **Solicitações:** consulta no servidor, páginas de 25 pedidos, total do escopo e total encontrado, filtros por situação, nome/LDAP e dia/período de Brasília. Sem data final, consulta o dia inicial. Exportar histórico completo ignora os filtros de pesquisa e a página, mantendo a loja autorizada.
- **Operações:** pedidos pendentes reservam peças; aprovação baixa estoque e grava movimento, recusa libera reserva. Edição de pendentes recalcula reservas. Movimentações, importações e lotes mantêm transações, versões e proteção contra saldo negativo ou inferior ao reservado.
- **Catálogo:** apenas Master Admin cria/edita metadados. Novos itens/lojas recebem saldo zero. Exclusão exige saldo zero em todas as lojas e arquiva o cadastro, preservando pedidos e movimentos.
- **Fotos:** JPG/PNG/WebP, até 2 MB e 16 megapixels, sem animação; aplicação individual ou aos SKUs de até 200 registros selecionados, em todas as lojas, inclusive futuras.

As janelas de cadastro, movimentação, estoque, catálogo, lote, imagem e edição de pedido usam diálogo nativo, com foco contido, Escape protegido quando há alterações e bloqueio ao salvar. Erros permanecem visíveis; falha de atualização não é apresentada como sincronização concluída. Importação mantém seu diálogo nativo e recuperação por recibo.

## Ambiente local

Requisitos: Node.js 24.x (ver `.nvmrc`), npm e PostgreSQL 14 ou superior.

1. `npm ci --include=dev`.
2. Crie um banco local separado e configure `.env` com base em `.env.example`: `DATABASE_URL`, `DIRECT_URL`, `ADMIN_SESSION_SECRET` (ao menos 32 bytes aleatórios) e, para provisionamento, `ADMIN_PASSWORD` (ao menos 12 caracteres, até 72 bytes).
3. Confira o destino e execute `npm run db:deploy` somente no banco pretendido. Instalações existentes exigem o procedimento de [produção](docs/PRODUCAO.md).
4. `npm run dev`. Painel em `/`, login em `/admin/login`, autoatendimento em `/solicitar`.

`POST /api/setup` provisiona exclusivamente banco vazio. Login usa hash bcrypt da conta, não uma senha compartilhada de ambiente. Senhas temporárias exigem troca antes de liberar painel/APIs; o Master inicial pode reutilizar a senha definitiva. Preserve o contrato de `POST /api/auth/login` e o sucesso `{"ok":true,"mustChangePassword":false}`, compatíveis com o filtro externo documentado.

Para diagnóstico/provisionamento excepcional existem `admin:inspect`, `admin:bootstrap-existing` e `admin:set-password`; consulte o [escopo](docs/ESCOPO.md) antes de usá-los. Nenhum faz parte do build. `db:seed` é destrutivo e só pode ser usado em banco local descartável com autorização explícita; não é um procedimento de recuperação de falha do painel.

## Entrada de estoque por Excel

Em **Estoque → Importar Excel**, escolha a loja quando estiver no consolidado. Use o [modelo](public/modelo-entrada-estoque.xlsx): uma aba, cabeçalhos na primeira linha, colunas SKU e Quantidade, até 200 linhas e 2 MB. SKUs devem ser texto; quantidades inteiras positivas, sem fórmulas. Colunas extras são ignoradas (até 32 colunas). Repetições de SKU são somadas na prévia; quantidade por SKU e saldo final limitados a 1.000.000.

Confira individualmente todos os registros. SKU desconhecido ou erro bloqueia o lote inteiro. A prévia vale por 15 minutos; mudança de estoque exige nova conferência. A confirmação é transacional e repetir o mesmo recibo não duplica entradas. Em falha de conexão, use **Verificar confirmação** na mesma janela. Abrir outra prévia representa outra entrada; confira os saldos antes de repetir uma operação incerta.

## Validação e publicação

```text
npm run verify
npm run test:smoke
npm run test:ui
npm run test:integration
```

`verify` gera/valida Prisma, executa lint, testes e build. Playwright requer Chromium (`npx playwright install chromium`) e build atualizado; executa desktop e celular com APIs simuladas e banco inacessível. Integração exige `ALLOW_LOCAL_INTEGRATION=1` e URLs coincidentes para um PostgreSQL local denominado `uniformes_refactor_test`; usa somente fixtures sintéticas próprias. Não aponte testes para dados reais.

Vercel usa `npm run vercel-build`, que também confere configuração. Não executa migrations, seed ou redefinições de senha. A revisão de 30–31/10/2026 não exige migration, dependência ou variável nova. Publicação segue [PRODUCAO.md](docs/PRODUCAO.md), inclusive a autorização permanente já registrada.

Documentação atual: [escopo](docs/ESCOPO.md), [arquitetura](docs/ARQUITETURA.md), [produção](docs/PRODUCAO.md) e [relatório de melhorias](docs/RELATORIO-MELHORIAS.md). As notas anteriores estão no [histórico do README](docs/HISTORICO-README-ATE-2026-10-28.md) e nos arquivos `docs/HISTORICO-*.md`.

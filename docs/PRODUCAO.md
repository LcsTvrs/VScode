# Operação e publicação em produção

Atualizado em 22/10/2026. Os bancos local e de produção estão com as cinco migrations aplicadas, incluindo imagens. O código de imagens ainda aguarda publicação. As seções de validações anteriores descrevem o estado na data de cada teste. Leia também [ESCOPO.md](./ESCOPO.md). Confirme o deployment ativo antes de executar qualquer procedimento.

## Estado conhecido

- O projeto `estoque_uniformes` está na equipe `oktus2` da Vercel; o ramo `main` do repositório [LcsTvrs/VScode](https://github.com/LcsTvrs/VScode) publica em https://estoqueuniformes.vercel.app.
- A revisão funcional `79fd6eb` ficou Ready em 18/10/2026. Alterações posteriores no Git precisam de nova confirmação do deployment ativo.
- O usuário informou que a base já possuía dados de negócio, uma loja de código `0012` e uma conta `MASTER_ADMIN`. Esse retrato pode mudar; consulte a aplicação e o banco.
- Login individual, troca obrigatória de senha temporária, isolamento de `STORE_ADMIN`, seletor de loja do `MASTER_ADMIN` e CRUD de usuários e lojas estão implementados. Há testes automatizados locais de regras e APIs com banco simulado; não há validação corporativa do LDAP.
- Em 21/10/2026, `20261018230000_add_user_name` foi registrada formalmente e `20261020000000_add_uniform_gender` foi aplicada em produção. As quatro migrations estão aplicadas, e a comparação Prisma não encontrou diferença entre banco e schema versionado.

## Imagens e seletor de lojas — preparação local de 21/10/2026

- Seletor corrigido para mostrar uma seta funcional e o nome inteiro. Master Admin pode atribuir fotos a uniformes existentes em **Estoque → Imagem** e, opcionalmente, substituir a foto do mesmo SKU nas demais lojas após conferir a lista. Estoque e catálogo público exibem as fotos; gestores de loja não podem alterá-las.
- Nova dependência direta `sharp` 0.35.5 para decodificar e compactar JPG/PNG/WebP. Upload de até 2 MB, 16 megapixels, sem animação; armazenamento WebP até 1000×1000 e 512 KiB. A foto fica no PostgreSQL e é compartilhada na replicação; não há novas variáveis ou serviço de armazenamento. Os backups passarão a incluir as imagens, aumentando conforme o acervo.
- **Aplicar `20261021000000_add_uniform_images` antes de publicar:** cria `UniformImage`, vínculo nullable `UniformVariant.imageId`, índices e limite de bytes por imagem. Itens existentes ficam sem foto. As consultas do código novo exigem essa coluna. O build não aplica migrations.
- Antes da produção, conferir banco/histórico, gerar backup restaurável atualizado e ensaiar a migração sobre uma cópia desse backup. Depois aplicar somente a migration no banco de destino, publicar o código e conferir upload, exibição pública e bloqueio para `STORE_ADMIN`. Não usar seed nem importar o banco local.
- Ensaio local já executado em uma base PostgreSQL 18 separada, com três lojas/itens sintéticos: migração preservou os dados legados e saldos; comparação Prisma sem diferenças. Upload, replicação compartilhada, limpeza de fotos sem uso, leitura pública e duas gravações simultâneas foram exercitados com as APIs reais; uma gravação venceu e a outra recebeu 409. Saldos e movimentos foram preservados.
- `npm run verify` aprovado: Prisma, lint, 50 testes e build. `npm run test:ui -- --max-failures=1`: 28 testes em desktop/celular aprovados, incluindo seletor com nome inteiro/seta clicável, upload com prévia, cancelamento sem gravação, confirmação de replicação, ausência da ação para gestor de loja, foto no catálogo e fallback em erro. Capturas inspecionadas. Testes de navegador usam APIs simuladas; o ensaio PostgreSQL descrito acima foi separado.
- A implementação acima foi validada sem acessar produção em 21/10/2026. A migração foi aplicada em 22/10/2026 conforme o registro abaixo; a funcionalidade ainda aguarda publicação do código.

## Migrações aplicadas — 22/10/2026

- Produção Neon: aplicada `20261021000000_add_uniform_images`. As quatro anteriores já estavam concluídas e com checksums conferidos. As cinco migrations agora constam aplicadas, sem pendências; schema Prisma sem diferenças. O uniforme existente foi preservado e permanece sem imagem.
- Banco local: aplicadas `20261018230000_add_user_name`, `20261020000000_add_uniform_gender` e `20261021000000_add_uniform_images`. As cinco migrations constam concluídas, sem pendências; schema Prisma sem diferenças.
- Backups completos novos dos dois bancos foram salvos em `.vercel/backups/`, ignorados pelo Git, com SHA-256 no registro operacional `.vercel/image-migration-release-state.json`. Cada backup foi restaurado em uma nova base local isolada; as migrations foram ensaiadas nessas cópias antes da aplicação nos destinos.
- Comparação de contagens e hashes das oito tabelas de negócio, desconsiderando somente as colunas novas, confirmou preservação dos dados antes/depois em ambos os ambientes. A tabela de imagens está vazia e a restrição de tamanho foi conferida. Nenhum seed, reset, `db:push` ou transferência de dados locais para produção foi executado.
- Particularidade local: o checksum registrado de `20261014185052_add_multi_store` difere do arquivo atual. Antes de prosseguir, o schema foi comparado ao modelo histórico do commit `246e98f`, sem diferenças. O registro antigo foi preservado; somente migrations aditivas pendentes foram executadas. Essa divergência continua sendo histórica e não deve motivar reset automático com `migrate dev`.
- Não houve push ou deploy nesta operação. O banco está preparado para publicar a funcionalidade de imagens; depois do deploy, conferir a interface e os acessos por perfil.

## Filtro de solicitações e visão geral — 21/10/2026

O histórico permite escolher o dia de criação no horário de Brasília, limpar a seleção e visualizar a contagem filtrada. A visão geral mostra até quatro solicitações pendentes, incluindo dias anteriores, sem aplicar esse filtro. Datas do histórico e do resumo usam o mesmo fuso, mesmo que o navegador esteja em outro horário. A exportação, identificada como “Exportar histórico completo”, continua incluindo todos os pedidos da loja.

Não exige migration, novas variáveis ou alteração dos dados existentes. A filtragem acontece no navegador; o dashboard continua carregando o histórico autorizado da loja. Publicação pelo ramo `main`, com confirmação do commit correspondente como Ready na Vercel e do domínio de produção após o push.

Validação: `npm run verify` aprovado (Prisma, lint, 41 testes e build). `npm run test:ui -- tests/browser/request-edit.spec.ts tests/browser/request-filters.spec.ts --max-failures=1`: 14 testes aprovados em desktop/celular, com APIs simuladas e banco real inacessível. Cobertura inclui virada de dia em Brasília mesmo com navegador em UTC, dia sem pedidos, limpeza, pendências antigas após pedidos já processados e independência entre filtro e visão geral; edição/aprovação e layout anterior continuam aprovados. Nenhum dado de produção foi acessado ou alterado.

## Migração de produção — 21/10/2026

- Código da funcionalidade preparado no commit `39add33`; a publicação em `main` deve ocorrer após esta migração.
- Backup completo em formato custom do PostgreSQL salvo localmente em `.vercel/backups/`, ignorado pelo Git. Restauração validada em uma base local isolada, sem sobrescrever o banco local de trabalho.
- As duas migrations pendentes foram ensaiadas nessa cópia. Leitura real com Prisma do catálogo e do histórico aprovada; alterações Masculino/Feminino verificadas em transação revertida na cópia.
- Migração aplicada depois em produção. Comparação das oito tabelas de negócio confirmou preservação dos dados; o uniforme existente permaneceu `NULL` (“Não informado”). A comparação de schema terminou com `No difference detected`.
- A conexão de produção está em `.env.production.local`, ignorado pelo Git. Backup e credenciais não são enviados ao GitHub. Nenhum seed, `db:push`, redefinição de senha ou importação do banco local para produção foi executado.

## Configuração de deploy versionada

Ajuste visual de 21/10/2026, posterior ao deploy `ebb9a58`: tamanho antes do nome no catálogo e nas solicitações; histórico com cada item em uma linha e quantidade somente à direita, sem total redundante no rodapé. Em telas estreitas, a descrição permite rolagem horizontal e mantém a quantidade visível. Não exige migration, novas variáveis ou alteração de dados. A publicação segue o fluxo de main para a Vercel, com conferência do deployment e do domínio público.

Validação desse ajuste: `npm run verify` aprovado (Prisma, lint, 40 testes e build) e 10 testes de solicitações no Chromium em desktop/celular aprovados com `npm run test:ui -- tests/browser/request-edit.spec.ts --max-failures=1`. Capturas do catálogo e histórico foram inspecionadas. Testes confirmam tamanho antes do nome, detalhes na mesma linha, quantidade dentro da tela à direita e ausência de “Total:” no rodapé. Conexões de banco fictícias e APIs simuladas; nenhum acesso ao banco de produção. O lint passa a ignorar `.vercel/`, que contém arquivos operacionais locais gerados.

O [vercel.json](../vercel.json) define os comandos do projeto. A versão principal do Node é fixada em `24.x` no `package.json`, conforme o [suporte da Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Os comandos seguem a [configuração oficial por arquivo](https://vercel.com/docs/project-configuration/vercel-json).

| Configuração | Valor |
| --- | --- |
| Root Directory | Raiz do repositório (`.`); conferir no painel da Vercel. |
| Framework | Next.js (`nextjs`). |
| Node.js | 24.x, também registrado em `.nvmrc` para desenvolvimento. |
| Install Command | `npm ci --include=dev`, usando o lockfile sem atualizar versões. |
| Build Command | `npm run vercel-build`. |
| Output Directory | `.next`. |

O build verifica configuração de ambiente, gera o Prisma Client, valida o schema, executa lint e testes e compila o Next.js. Qualquer falha interrompe o build. Não aplica migrations, não executa seed e não conecta ao banco para validar credenciais. `DATABASE_URL`, `DIRECT_URL` e `ADMIN_SESSION_SECRET` precisam estar presentes no ambiente de destino; `ADMIN_PASSWORD` só é necessária para provisionamento/recuperação e, se definida, precisa ter 12 a 128 caracteres. A chave de sessão exige pelo menos 32 bytes. URLs localhost são recusadas quando `VERCEL=1`.

Antes de publicar:

1. Execute `npm ci --include=dev` e `npm run vercel-build` com Node 24.x.
2. Inclua no commit os arquivos novos de `src/lib/`, `tests/`, `scripts/`, `.nvmrc` e `vercel.json`, além de todas as alterações relacionadas. Confira `git status` e `git diff --cached --check`. Nunca inclua arquivos `.env*` com valores reais.
3. Confira Root Directory, ramo `main` e variáveis do ambiente Production no painel. Se usar Preview, configure credenciais de staging nesse ambiente, separadas de produção.
4. Antes de publicar esta atualização, siga o procedimento de banco abaixo e aplique `20261020000000_add_uniform_gender` no destino. Verifique também as migrations anteriores pendentes.
5. Faça o commit/push quando pronto para publicar; a integração existente da `main` dispara produção. Após o status Ready, execute as verificações funcionais abaixo.

Esta revisão adiciona o enum `UniformGender` e a coluna opcional `UniformVariant.gender`. A migration `20261020000000_add_uniform_gender` deve ser aplicada **antes do deploy do código**, após backup, conferência de histórico e ensaio em staging. Sem a coluna, as consultas Prisma do novo código falham. O build e o runtime não aplicam essa alteração. A pendência histórica de `User.name` também exige conferência do estado real. As configurações remotas, WAF, backups e credenciais da Vercel não foram alterados por esta preparação local.

## Classificação dos uniformes e histórico — 20/10/2026

- Novo cadastro exige **Masculino** ou **Feminino** no formulário e na API. Uniformes já cadastrados permanecem como **Não informado** (`NULL`); podem ser classificados em **Estoque → Editar**, junto com saldo e mínimo.
- `POST /api/variants` exige `gender: "MASCULINO" | "FEMININO"`. `PATCH /api/inventory` aceita esses valores ou `null`; omitir o campo preserva a classificação. A edição de classificação e saldo usa a mesma transação e respeita a loja da sessão. Classificar sem mudar quantidade não gera movimento de estoque.
- A classificação aparece no estoque, catálogo público, solicitações, prévia de importação e nos dois CSVs. Excel continua recebendo somente SKU e quantidade. A edição atualiza a versão do saldo: prévias antigas de importação exigem nova conferência.
- O histórico destaca nome e LDAP, lista cada uniforme com classificação/tamanho/cor/SKU e quantidade, e mantém total, data, status e ações de pedidos pendentes. O código não é exibido no histórico, resumo recente ou janela de edição; permanece nas APIs, CSV e comprovante público.
- Nenhuma restrição de uniforme por perfil do colaborador foi criada. A classificação pertence ao uniforme, sem inferir dados do colaborador. Mudanças posteriores da classificação também aparecem ao consultar pedidos antigos; não há snapshot dos metadados do uniforme.
- Migração aditiva, sem preenchimento arbitrário de dados existentes. Não execute seed nem db:push. Após conferir `npx prisma migrate status`, ensaiar e fazer backup, execute `npm run db:deploy` no ambiente correto antes do deploy e confirme a coluna e os registros legados nulos. Uma reversão do código pode manter essa coluna opcional.

Em staging, cadastre os dois tipos, classifique um item legado sem alterar saldo, confirme o isolamento entre lojas, abra catálogo e histórico no celular e exporte os CSVs. Gere uma prévia Excel, altere a classificação do item em outra aba e confirme que a prévia antiga retorna conflito. Recarregue abas administrativas abertas antes do deploy, pois o cadastro novo passa a exigir `gender`.

## Importação de estoque por Excel

Nova funcionalidade local em **Estoque → Importar Excel**. Inclua no commit as rotas `src/app/api/inventory/import/`, os módulos `src/lib/inventory-import*`, o componente de conferência, o modelo `public/modelo-entrada-estoque.xlsx`, os testes e as dependências/lockfile atualizados. Usa `read-excel-file` para leitura e `fflate` para limitar/verificar o conteúdo ZIP. Não há nova variável de ambiente nem migration.

- Modelo: uma aba, colunas `SKU` e `Quantidade`, cabeçalhos na linha 1; `.xlsx` até 2 MB e 200 linhas de dados. Quantidades positivas inteiras, sem fórmulas, soma e saldo final por SKU até 1.000.000. SKU com zeros iniciais deve ser texto. Colunas extras são ignoradas, com limite de 32 colunas; arquivos com formatação em linhas excedentes devem ser simplificados.
- Prévia por loja com nome, tipo/categoria, tamanho/cor e saldo antes/quantidade da planilha/saldo após. Duplicatas são agrupadas e identificadas pelas linhas da planilha. Todos os itens exigem conferência; qualquer erro impede confirmar o lote.
- JWT de prévia válido por 15 minutos, vinculado à conta e à loja. A API confere novamente os saldos e suas versões. Conflito retorna 409, sem entrada parcial, e exige atualizar a prévia e conferir novamente.
- Entradas e movimentos são registrados na mesma transação `Serializable`, com timeout de 20 segundos. As duas rotas declaram `maxDuration = 30` para reservar tempo para autenticação e resposta na Vercel, conforme a [configuração de duração das funções](https://vercel.com/docs/functions/configuring-functions/duration). O UUID da prévia aparece nos IDs e observações de `StockMovement`. Preserve esses registros: são o recibo usado para impedir duplicação por reenvio da mesma confirmação.
- Em erro de conexão, repetir a confirmação na mesma janela recupera o resultado. Uma prévia expirada só pode recuperar um recibo já existente durante a sessão. Nova prévia, mesmo do mesmo arquivo, significa nova entrada; conferir saldos antes de reiniciar uma operação cujo resultado ficou incerto.
- Cancelar antes de confirmar não altera estoque. O upload não é armazenado em disco nem enviado a terceiros. Nenhum dado de produção foi usado nos testes locais.

Validação em staging: importe dois SKUs conhecidos e confira saldo/histórico; cancele uma prévia; teste SKU inexistente, quantidade inválida, duplicatas, tentativa de outra loja, reenvio da confirmação e alteração de saldo por outro operador entre prévia e confirmação. Teste também o lote máximo sob a latência real do PostgreSQL. Os testes automatizados usam Prisma simulado, portanto não comprovam concorrência real no banco.

## Atualização das solicitações — 20/10/2026

- Colaborador: até 3 unidades por variação/SKU em cada solicitação, conforme o saldo disponível. Formulário e API aplicam a mesma regra; duplicatas são somadas antes de conferir o limite. Não há cota acumulada por LDAP/período, nem conversão de pedidos existentes.
- Administrador: lápis em Solicitações permite trocar, adicionar, remover itens e alterar quantidades de pedidos pendentes. Conforme solicitado, o administrador pode ultrapassar 3; permanece o teto de 20 por item e 20 linhas. A edição mantém colaborador, código, observações e status.
- Salvar substitui os itens e recalcula a reserva em transação Serializable. Considera os outros pedidos pendentes, excluindo a reserva anterior do próprio pedido. Nenhuma saída é gerada até a aprovação.
- GET/PUT em `/api/requests/[id]` respeitam a loja da conta. PUT exige `items` e `updatedAt`. PATCH de aprovação/recusa passa a exigir `action` e `updatedAt`, também fornecido pelo dashboard. Recarregue abas administrativas antigas após o deploy. Pedido já processado ou versão desatualizada é recusado com 409; aprovação e edição não podem usar itens de versões diferentes.
- Não há nova variável, dependência ou migration. Testes locais usam Prisma simulado e URLs de banco fictícias somente no processo. Nenhum estoque real foi alterado.

Em staging, confira: colaborador selecionando 3 e tentando enviar 4 via POST; duplicatas cuja soma excede 3; administrador trocando item e informando 5; redução/remoção liberando a reserva; conflito com reservas de outro pedido; acesso por outra loja; duas edições simultâneas; edição concorrendo com aprovação. Confira se o histórico de saída reflete somente os itens finais aprovados.

Validação local desta atualização: `npm run verify` passou com geração/validação do Prisma, lint, 35 testes e build; `npm run test:smoke` passou com 14 verificações HTTP. No Chromium, passaram os 8 testes anteriores de importação e os 8 novos de solicitações em desktop/celular (estes reexecutados com `npm run test:ui -- tests/browser/request-edit.spec.ts` após corrigir os seletores dos testes). As capturas da edição foram inspecionadas. Os testes de navegador simulam APIs e os de servidor simulam Prisma; concorrência real no PostgreSQL continua sendo validação de staging. Não houve push ou deploy.

## Segredos e variáveis

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão de execução ao PostgreSQL, normalmente via pooler. |
| `DIRECT_URL` | Conexão direta para migrations. |
| `ADMIN_SESSION_SECRET` | Assinatura JWT, com pelo menos 32 bytes aleatórios. |
| `ADMIN_PASSWORD` | Provisionamento inicial e scripts pontuais de senha; não altera logins já criados por simples troca da variável. |

Configure os valores como segredos na Vercel. O projeto usa arquivos `.env`/ `.env.local` ignorados pelo Git apenas em desenvolvimento local. Não exponha valores, hashes, cookies ou URLs completas de banco em logs, documentação ou commits. No ambiente deste projeto, os segredos de produção não puderam ser exportados com `vercel env run -e production`; não presuma que comandos locais acessam o banco de produção.

O login verifica `User.passwordHash` com bcrypt. A sessão usa cookie HTTP-only, Secure em produção e SameSite=Strict; o servidor revalida o usuário e seu escopo. Alterar `ADMIN_PASSWORD` na Vercel, isoladamente, não redefine a senha de uma conta existente.

## Provisionamento e recuperação administrativa

**Banco totalmente vazio:** após conferir que não há usuários nem dados de negócio, `POST /api/setup` cria a loja inicial e a conta `admin` com papel `MASTER_ADMIN`, usando `ADMIN_PASSWORD` (12 a 128 caracteres). O endpoint é público, mas bloqueia novas execuções quando o banco já tem usuários ou dados de negócio. Não o use na base existente.

**Banco com dados e sem usuários:** `npm run admin:inspect` consulta o estado sem alterar o banco. Depois de confirmar a conexão, `npm run admin:bootstrap-existing` cria uma única conta master preservando os dados. Ele recusa a operação se já houver usuário ou se o banco estiver vazio.

**Conta `admin` master já existente:** `npm run admin:set-password` grava novo hash a partir de `ADMIN_PASSWORD` no ambiente e encerra a exigência de troca dessa conta. Verifique `DATABASE_URL` e o ambiente antes de usar. A senha não é exibida pelo script. Para contas comuns, o `MASTER_ADMIN` usa o reset em Administração → Usuários.

O `npm run db:seed` apaga tabelas de negócio e cria dados e acesso demonstrativos. Use somente em banco local descartável. A trava `ALLOW_DESTRUCTIVE_SEED` não o torna procedimento de produção.

## Migrações e dados existentes

1. Faça backup consistente do PostgreSQL e teste a restauração.
2. Confira o estado real do schema e o histórico com `prisma migrate status` usando a conexão direta correta. Bancos anteriores à migration inicial podem exigir baseline após conferência detalhada; não aplique `migrate resolve` por suposição.
3. Ensaie as migrations em staging com cópia representativa da base. A migration `20261014185052_add_multi_store` só faz backfill automático de legado com no máximo uma loja e aborta se houver ambiguidade.
4. Verifique a coluna `User.name` e a migration `20261018230000_add_user_name`. A rotina `ALTER TABLE IF NOT EXISTS` permite o uso atual, mas não marca a migration como aplicada no histórico do Prisma. Planeje `npm run db:deploy` após conferir o estado, sem repetir SQL manualmente.
5. Depois da migration, confira usuários, lojas, vínculos, variações, saldos, movimentos e solicitações. Prepare rollback da aplicação e restauração do banco para a janela de release.

Não use `db:push` nem `db:seed` em produção.

## Verificação de release

- Confirme que o deployment esperado está Ready e associado ao commit desejado, no domínio estável.
- Verifique login e logout, troca obrigatória após criação/reset de usuário e bloqueio de sessão antiga após edição ou desativação.
- Teste `STORE_ADMIN` em duas lojas, incluindo tentativa de passar `storeId` de outra loja nas APIs. Teste o `MASTER_ADMIN` escolhendo lojas distintas.
- Teste criação/edição/exclusão de lojas e usuários, reset de senha, estoque, solicitação pública, aprovação/recusa e CSV. A exclusão de loja com dados vinculados deve ser recusada.
- Confira `/solicitar?loja=CODIGO` para cada unidade. O LDAP/nome do autoatendimento são declarações do visitante, não identidade corporativa comprovada.
- Na identificação, confira LDAP de exatamente 8 dígitos, incluindo zeros iniciais, e nome com letras, acentos e espaços. O nome não tem limite de comprimento na validação da aplicação. Verifique a recusa de LDAP com letras/comprimento incorreto e nomes com números ou pontuação, tanto no formulário quanto por POST direto (400). Os registros anteriores não foram convertidos.
- Execute `npm run vercel-build` no código a publicar. Os testes usam banco simulado; faça testes funcionais em staging com PostgreSQL, incluindo operações simultâneas.
- Configure limites de tentativa/WAF para login e solicitação pública e monitore erros de autenticação e banco. Revise `npm audit` antes de atualizações de dependências.

## Correções locais de 19/10/2026

- `POST /api/inventory`: SAIDA subtrai o saldo e grava movimento negativo; ENTRADA soma e AJUSTE define o saldo final. Quantidade deve ser inteira entre 0 e 1.000.000. Saldo negativo é recusado com 409. A atualização compara o saldo lido e retorna 409 em conflito, sem gravar movimento na transação revertida.
- Os dois botões CSV enviam o `storeId` da loja exibida. A API mantém exportação global para MASTER_ADMIN sem filtro e força a loja da sessão para STORE_ADMIN.
- Cadastro e edição de lojas exigem cidade (2 a 100 caracteres) e UF brasileira válida. Lojas antigas com valores provisórios devem ser corrigidas pela interface; nenhum dado existente foi alterado automaticamente.
- Solicitações administrativas e públicas compartilham a verificação de saldo menos reservas PENDENTE, dentro de transação Serializable. Pedidos administrativos agregam linhas repetidas, limitam a 20 peças por variação e usam UUID no código. Indisponibilidade e conflitos de serialização retornam 409; o cliente deve atualizar os dados e tentar novamente.
- Testes automatizados cobrem sinais de movimentos, saldo insuficiente, conflito simulado de atualização, isolamento de loja, reservas, conflito de serialização simulado e localização. Não substituem testes de concorrência real no PostgreSQL nem validação visual dos formulários/CSV.
- Autoatendimento: formulário e API exigem LDAP numérico de 8 dígitos e nome apenas com letras, acentos e espaços, sem limite de comprimento. O LDAP continua sendo texto, preservando zeros iniciais. A integração com uma base de colaboradores e elegibilidade de uniformes está planejada no escopo, ainda não implementada.
- A suíte inclui testes de identificação, POST público com banco simulado e bloqueio de configuração de deploy inválida. Os resultados da preparação de release estão registrados abaixo.

## Pendências operacionais e de segurança

- Histórico das quatro migrations regularizado em produção em 21/10/2026. A rotina DDL legada de `User.name` ainda está presente; sua retirada pode ser planejada após conferir também os demais ambientes.
- Configurar rate limit distribuído/WAF, monitoramento e backup restaurável no provedor. Não foram configurados nesta alteração.
- LDAP continua autodeclarado; integração corporativa e MFA exigem definição do provedor e regras de acesso.
- Revisar dependências com `npm audit` antes de cada release. O resultado final desta revisão está na seção de validação abaixo; ainda há avisos na cadeia de lint.
- O seed demonstrativo ainda usa senha fixa e apaga dados. Restringir a banco local descartável.
- Validar em staging saída/ajuste simultâneos, pedidos públicos e administrativos concorrentes, aprovação, CSV por loja e cadastro/edição de localização antes de publicar.

Nenhum deploy, push, migration ou acesso ao banco de produção foi executado nesta revisão.

## Validação da preparação de release — 19/10/2026

- Instalação limpa pelo lockfile realizada. Versão local: Node 24.21.0; requisito versionado: 24.x.
- `npm run vercel-build` passou: verificação de ambiente local, geração/validação do Prisma, lint, 13 testes e build Next.js.
- `npm run test:smoke` passou com 8 verificações HTTP em servidor local de produção: solicitação, login, CSS, logo, redirecionamento de acesso protegido, API sem sessão e dois pedidos com identificação inválida. O script substitui conexões por endereços fictícios; nenhum banco real é consultado.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas. `npm audit` completo: 5 alertas altos relacionados à mesma cadeia `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- O resultado anterior de zero alertas na árvore completa não se confirmou na consulta direta ao registro. Após instalação limpa, foram encontrados 10 alertas; as correções abaixo reduziram o total para 5.
- Overrides restritos e registrados no lockfile: PostCSS 8.5.31 para Next.js e deepmerge-ts 8.0.0 para `@prisma/config`. O segundo altera o tratamento de Maps e referências circulares; o projeto usa configuração simples, e a suíte valida seu carregamento pelo Prisma, além de geração e validação do schema. Revisar os overrides ao atualizar Next.js/Prisma. [Aviso deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- O alerta restante de `braces` afeta padrões profundamente aninhados; não há versão corrigida publicada. Nesta árvore, ele é usado pelo lint durante desenvolvimento/build, com configuração do repositório, não pelas rotas da aplicação. Não é erro de compilação, mas permanece uma pendência de segurança das ferramentas; avaliar antes de executar builds de contribuições não confiáveis. Não foi aplicado o downgrade de `eslint-config-next` sugerido por `npm audit fix --force`. [Aviso braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Limites: não houve teste de concorrência com PostgreSQL real nem verificação de credenciais, histórico de migrations, WAF ou backups no projeto remoto. A integração Vercel foi localizada, mas não está instalada/conectada nesta sessão. A chave de sessão ausente no ambiente local foi gerada em `.env.local`, ignorado pelo Git; a chave de produção não foi alterada.

## Validação da importação Excel — 19/10/2026

- `npm run vercel-build`: Prisma, lint, 26 testes de regras/APIs/leitura de arquivos e build aprovados. Foi corrigida também a tipagem de duas substituições do Prisma no teste público já existente.
- Nesta validação, `DATABASE_URL` e `DIRECT_URL` estavam ausentes no ambiente local. O build foi executado com URLs fictícias definidas somente no processo; não valida as credenciais reais. Configure as conexões no ambiente de destino antes de usar a aplicação.
- `npm run test:smoke`: 11 verificações HTTP, incluindo bloqueio sem sessão nas duas novas rotas e download do modelo `.xlsx`.
- `npm run test:ui`: 8 testes no Chromium, em desktop e celular, com APIs simuladas. Conferência individual, cancelamento, bloqueio de SKU inválido, conflito de saldo e recuperação após erro de rede passaram. Nomes acessíveis dos botões do menu foram corrigidos para telas pequenas. Capturas locais foram inspecionadas.
- Para repetir os testes de navegador após o build: `npx playwright install chromium` (uma vez) e `npm run test:ui`. Browser e resultados são locais; o build da Vercel não instala nem executa navegador.
- Auditoria de produção após incluir as bibliotecas de Excel: zero vulnerabilidades reportadas. A instalação mantém os 5 alertas de desenvolvimento documentados acima.
- Nenhum estoque real, configuração remota, migration, push ou deploy foi executado. O ensaio com PostgreSQL em staging, incluindo lote máximo e concorrência real, continua pendente.

## Validação da classificação e histórico — concluída em 21/10/2026

- `npm run verify`: geração/validação do Prisma, lint, 40 testes de regras/APIs e build aprovados, usando conexões fictícias somente no processo.
- `npm run test:smoke`: 14 verificações HTTP aprovadas com banco real inacessível.
- `npm run test:ui -- --max-failures=1`: 18 testes aprovados em desktop/celular. Cadastro exige classificação; edição permite classificar legado sem alterar quantidade; catálogo exibe Masculino/Feminino; histórico mostra colaborador e itens/quantidades; edição e aprovação continuam funcionando. Capturas de cadastro e histórico foram inspecionadas.
- Testes de servidor usam Prisma simulado e os de navegador simulam APIs. A migration foi preparada e revisada, mas não executada em PostgreSQL. Validar em staging e aplicar no destino antes do deploy, conforme os passos acima.
- Nenhuma alteração no banco real, push, deploy ou alteração de credenciais foi realizada nesta atualização.

Veja o contexto e a ordem sugerida de trabalho em [ESCOPO.md](./ESCOPO.md).

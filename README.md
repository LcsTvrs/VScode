# Gestão de uniformes

Aplicação full stack para controlar o estoque de uniformes de múltiplas lojas, registrar movimentações e acompanhar solicitações de colaboradores.

## Requisitos

- Node.js 24.x e npm (a mesma versão principal configurada na Vercel; veja `.nvmrc`)
- PostgreSQL 14 ou superior

## Configuração local

1. Instale as dependências do lockfile com `npm ci --include=dev`.
2. Crie um banco PostgreSQL chamado `estoque_uniformes`.
3. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `DIRECT_URL`, `ADMIN_SESSION_SECRET` e `ADMIN_PASSWORD` (senha inicial do MASTER_ADMIN, com pelo menos 12 caracteres).
4. Use uma chave de sessão com no mínimo 32 bytes aleatórios. As credenciais são lidas da tabela `User`; cada usuário precisa ter senha bcrypt.
5. Aplique as migrations: `npm run db:deploy`. Para bancos criados antes da migration inicial, faça o baseline uma única vez com `npx prisma migrate resolve --applied 20261013000000_init` depois de confirmar que o schema já está sincronizado.
6. Em um banco de desenvolvimento descartável, sincronize o schema multi-loja e execute `npm run db:seed` para recriar os dados iniciais.
7. Inicie a aplicação: `npm run dev`. O painel fica em `http://localhost:3000` e a solicitação pública em `http://localhost:3000/solicitar`.

Num banco vazio, `POST /api/setup` cria o primeiro MASTER_ADMIN (`admin`) usando `ADMIN_PASSWORD`; a senha é armazenada como hash bcrypt e pode ser reutilizada nos logins sem rotação obrigatória. O seed cria uma conta demonstrativa, mas apaga todos os dados do banco; use-o apenas em ambiente local descartável.

Para aplicar ou sincronizar `ADMIN_PASSWORD` com uma conta `admin` MASTER_ADMIN já existente, execute `npm run admin:set-password` uma vez no ambiente apontado por `DATABASE_URL`. O comando atualiza o hash e desativa a troca obrigatória; não exibe nem armazena a senha em texto no banco.

Se um banco já contém dados, mas não possui nenhum utilizador, `npm run admin:inspect` confirma esse estado sem alterar o banco. Nesse caso, `npm run admin:bootstrap-existing` cria uma única conta `admin` MASTER_ADMIN com `ADMIN_PASSWORD` (12 a 128 caracteres) e preserva os dados existentes. O comando recusa a criação quando já existe qualquer utilizador ou quando o banco está vazio. Confirme que `DATABASE_URL` aponta para o banco pretendido antes de o executar.

A migration multi-loja só faz backfill automático de instalações legadas com no máximo uma loja e deve ser ensaiada em staging com backup restaurável antes de qualquer uso. Consulte [docs/PRODUCAO.md](docs/PRODUCAO.md) para o estado e os passos de release.

## Funcionalidades

Correções locais de 19/10/2026: saídas de estoque com baixa correta e proteção contra atualização concorrente, CSV da loja selecionada, cadastro/edição de cidade e UF e validação de reservas também nos pedidos administrativos. Testes locais: `npm test` (regras e APIs com banco simulado). Consulte os limites de validação e pendências de infraestrutura em [docs/PRODUCAO.md](docs/PRODUCAO.md).

- Painel por loja com total de peças, itens abaixo do mínimo e solicitações pendentes.
- Cadastro de uniformes por categoria, SKU, tamanho e cor, com saldo inicial e mínimo.
- Entradas e ajustes de estoque com registro de movimentação e proteção contra saldo negativo.
- Importação de estoque por Excel, com prévia e conferência individual obrigatória antes de somar os saldos.
- Solicitações para colaboradores com múltiplos itens e quantidades.
- Área pública de autoatendimento em `/solicitar`, sem login, que identifica a pessoa por LDAP e nome antes de exibir o catálogo disponível.
- No autoatendimento, LDAP deve conter exatamente 8 números (zeros iniciais são preservados); nome completo aceita apenas letras, acentos e espaços, sem limite de comprimento. A regra é validada no formulário e na API. Consulta automática do colaborador e uniformes por LDAP é uma evolução planejada em [docs/ESCOPO.md](docs/ESCOPO.md).
- O catálogo público desconta solicitações pendentes do saldo exibido e valida novamente a disponibilidade ao enviar o pedido.
- Login administrativo em `/admin/login`, com sessão JWT em cookie HTTP-only, `SameSite=Strict` e proteção do painel/API.
- Login individual via `POST /api/auth/login`, validado contra `User.passwordHash` com bcryptjs; o JWT em cookie HTTP-only inclui usuário, perfil, loja e estado da troca obrigatória de senha.
- Utilizadores criados com senha temporária ou que receberam reset precisam trocar a senha uma vez. O MASTER_ADMIN inicial pode usar `ADMIN_PASSWORD` em todos os logins sem rotação obrigatória.
- APIs de loja derivam o escopo `STORE_ADMIN` da sessão; o `MASTER_ADMIN` pode selecionar uma loja ou consultar exports globais.
- Edição administrativa por item de saldo disponível e estoque mínimo, com registro de movimentação para alterações de saldo.
- Exportação CSV autenticada do saldo atual e do histórico detalhado de solicitações.
- Aprovação ou recusa de solicitações; a aprovação baixa o saldo e registra a saída de forma transacional.
- Painel MASTER_ADMIN para consultar, criar, editar e excluir lojas e usuários, além de redefinir senhas; novos acessos recebem uma senha temporária e devem alterá-la no primeiro login.
- Cada utilizador tem login e nome de exibição. Contas criadas antes da inclusão do nome podem ser atualizadas em Administração → Usuários → Editar; até lá, o login aparece como identificação provisória.
- APIs administrativas protegidas e endpoints públicos de login/solicitação em `/api/auth/*` e `/api/requests/public`.

## Entrada de estoque por Excel

Na aba **Estoque**, escolha **Importar Excel**. Baixe o modelo na janela, substitua os exemplos pelos SKUs já cadastrados na loja e envie o arquivo `.xlsx` com as colunas `SKU` e `Quantidade`. O modelo também está em [public/modelo-entrada-estoque.xlsx](public/modelo-entrada-estoque.xlsx).

O arquivo deve ter uma única aba, cabeçalhos na primeira linha, até 200 linhas de dados e 2 MB. Quantidades devem ser inteiras positivas, sem fórmulas; mantenha os SKUs como texto para preservar zeros iniciais. Colunas adicionais são ignoradas (máximo de 32 colunas). SKUs repetidos são agrupados e suas quantidades somadas na prévia. A quantidade por SKU e o saldo final não podem ultrapassar 1.000.000.

A janela mostra SKU, linhas da planilha, nome, tipo/categoria, tamanho, cor, saldo atual, quantidade a adicionar e saldo após a soma. Marque cada item como conferido e clique em **Confirmar e somar ao estoque**. SKUs desconhecidos e dados inválidos bloqueiam o lote inteiro. A operação soma entradas aos itens existentes; não cadastra novos uniformes.

A prévia vale por 15 minutos. Se o estoque mudar, atualize a prévia e confira novamente. A confirmação grava todo o lote e suas movimentações em uma transação; repetir a mesma confirmação não duplica entradas. Se houver falha de conexão ao confirmar, use **Verificar confirmação** na mesma janela. Abrir outra prévia da mesma planilha representa uma nova entrada: após fechar uma confirmação incerta, confira os saldos antes de importar novamente.

Os testes de navegador da importação rodam após o build: instale o Chromium uma vez com `npx playwright install chromium` e execute `npm run test:ui`. Eles cobrem desktop e celular com respostas de API simuladas e banco real inacessível. Não fazem parte do build da Vercel.

## Vercel

- O [vercel.json](vercel.json) define Next.js, instalação com `npm ci --include=dev`, build com `npm run vercel-build` e saída `.next`. Use a raiz do repositório como Root Directory. O `package.json` fixa Node.js 24.x.
- Configure `DATABASE_URL` com a URL de runtime/pooler do PostgreSQL e `DIRECT_URL` com a URL direta para migrations.
- Configure `ADMIN_SESSION_SECRET` como variável sensível, com pelo menos 32 bytes aleatórios, e `ADMIN_PASSWORD` como senha inicial do primeiro MASTER_ADMIN. `ADMIN_PASSWORD` só é usada no provisionamento de banco vazio; logins normais validam o hash da tabela `User`.
- `npm run vercel-build` valida a presença/formato das variáveis e executa geração/validação do Prisma, lint, testes e build. `npm run verify` executa as verificações de código; `npm run check:deploy-env` confere apenas a configuração, sem conectar ao banco nem imprimir segredos. Localmente, o verificador lê arquivos `.env*` na precedência de produção do Next.js; na Vercel, usa apenas as variáveis da plataforma.
- Não há migration automática no build. Não execute `db:push` ou `db:seed` em produção; cumpra o checklist de [docs/PRODUCAO.md](docs/PRODUCAO.md) antes de liberar o deploy.
- A migração aditiva `20261018230000_add_user_name` inclui o nome de exibição do usuário. Quando os segredos do banco estão disponíveis apenas na Vercel, a aplicação adiciona essa coluna no primeiro acesso; execute `db:deploy` depois para registrar formalmente a migração.
- O código não depende de APIs exclusivas do Live Server. As rotas e o middleware são executados pelo Next.js na Vercel.
- Auditoria de 19/10/2026 após as correções transitivas: `npm audit --omit=dev` sem vulnerabilidades reportadas; auditoria completa com 5 alertas altos na cadeia de lint (`braces`, sem versão corrigida publicada). Veja a avaliação e as versões fixadas em [docs/PRODUCAO.md](docs/PRODUCAO.md).

Ver o documento [docs/ESCOPO.md](docs/ESCOPO.md) para arquitetura, regras de negócio, segurança e checklist operacional.

## Observações

O seed cria uma loja, usuário de demonstração e itens fictícios; não execute em produção. O LDAP e o nome do formulário público não são autenticados em diretório corporativo. A aplicação ainda não tem rate limit distribuído; configure firewall/rate limits antes de exposição ampla. Avalie atualizações de dependências sem aplicar `npm audit fix --force` sem revisão.

Validação antes do deploy: `npm run vercel-build`. Após o build, `npm run test:smoke` inicia um servidor em localhost para verificar páginas, CSS, proteção de acesso e rejeição de pedidos inválidos, com acesso ao banco real bloqueado por conexões fictícias. Comandos individuais: `npm test`, `npm run lint`, `npm run build` e `npx prisma validate`. `npm run db:deploy` aplica migrations e deve ser executado separadamente apenas no banco e na janela pretendidos.

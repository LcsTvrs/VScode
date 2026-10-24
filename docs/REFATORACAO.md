# Refatoração por funcionalidades

Branch: refatoracao/estrutura. Referência: 4722fed. Pasta: VScode-refatoracao. A main e os arquivos do diretório original permanecem preservados.

## Referência verificada

Node 24; npm ci a partir do lockfile; npm run verify aprovado com 72 testes, Prisma, lint e build. Suíte de navegador aprovada com 48 casos desktop/celular. Capturas originais em .local/baseline-browser, ignoradas pelo Git.

## Etapas

1. Isolar worktree, configuração e PostgreSQL local. Concluído.
2. Organizar módulos e documentar fronteiras entre cliente e servidor.
3. Separar usuários e padronizar leitura de respostas HTTP.
4. Centralizar autorização mantendo contratos e escopo de loja.
5. Dividir painel em composição, componentes e hooks.
6. Extrair operações transacionais sem dividir suas transações.
7. Organizar CSS mantendo ordem e aparência.
8. Validar contratos, navegador e PostgreSQL; preparar CI e revisão.

## Ambiente isolado

Usar npm run dev:refactor em 127.0.0.1:3108. Navegador automatizado usa 3137. Banco sintético em 127.0.0.1:55439, sem dados reais. .env.local e .local ficam ignorados; não copiar configurações de produção. Perfis de navegador separados evitam interferência de cookies com a aplicação original.

## Publicação

Nenhum push, merge, Preview ou deployment está autorizado nesta execução. Ao final, revisar a branch e confirmar a conexão isolada do Preview antes de publicar. A integração Neon de preview/validacao não deve ser presumida para esta nova branch. Nenhuma migration nova está prevista.

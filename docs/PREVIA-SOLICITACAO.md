# Prévia local da solicitação de uniformes

A página `/solicitar` recebeu nova apresentação para identificação, seleção de uniformes, resumo e confirmação. Os estilos novos estão limitados a `.public-request-shell`, preservando as telas administrativas.

## Experimentar

Inicie `npm run dev:refactor` e abra `http://127.0.0.1:3108/preview/solicitar?loja=DEMO`. Para experimentar a seleção de loja, abra `/preview/solicitar` sem o parâmetro.

Use um LDAP fictício com 8 números (por exemplo, `00123456`) e um nome. A rota de prévia funciona somente em desenvolvimento, usa dados sintéticos e simula a confirmação sem chamar a API de solicitações. As imagens do catálogo real continuam vinculadas ao cadastro; imagens ausentes usam o ícone de uniforme.

## Imagem de abertura

- Arquivo: [public/images/uniformes-equipe.webp](../public/images/uniformes-equipe.webp), 1200 × 800 px, aproximadamente 174 KB.
- Origem: ferramenta integrada `image_gen`, aplicada com a skill `imagegen`.
- Uso: composição ilustrativa, identificada na interface. Não representa uma fotografia de produto cadastrado.
- O logotipo é o SVG já existente no projeto. Referência visual da marca: [Leroy Merlin Brasil](https://www.leroymerlin.com.br/).

Prompt utilizado:

> Use case: product-mockup. Asset type: editorial photograph for a Leroy Merlin employee uniform request portal, decorative hero photo, not a catalog product representation. Create a premium realistic still-life photo, landscape 3:2. On a pale warm off-white limestone studio surface: a neatly folded fresh lime green cotton work polo shirt with collar visible, on top of a folded charcoal grey work garment, alongside a second folded dark forest green textile. Subtle woven cotton textures, warm natural side light, clean editorial composition, faint soft shadows. Garments occupy center right, generous breathing room. Palette recognizable fresh Leroy Merlin lime green #78be20, forest green and warm ivory. No logos, no typography, no people, no hangers, no extra accessories. Sophisticated authentic fabric photography, not plastic 3D rendering.

## Verificação

- TypeScript: `tsc --noEmit` passou.
- Dez testes de navegador existentes passaram em desktop e celular: catálogo por setor, peças compartilhadas, mudanças de seleção, preservação do pedido, indisponibilidade e fallback de fotos.
- Na validação de publicação, os 106 cenários de navegador foram cobertos: 104 passaram na execução completa, e os dois cenários afetados pela redação antiga passaram após atualizar sua expectativa e repeti-los.
- Fluxo demonstrativo validado em 1440, 390 e 320 px, incluindo limite de quantidade, retorno aos dados, confirmação, cópia do código e foco de teclado. Nenhuma chamada à API de solicitações durante a simulação.
- Prévia executada inicialmente com Node 22.23.4; validação de publicação executada com Node 24.22.2, incluindo lint, tipos, 104 testes e build de produção. O smoke HTTP passou em 23 verificações e confirma que a rota demonstrativa retorna 404 em produção.

A rota demonstrativa permanece exclusiva do desenvolvimento. A versão publicada do formulário é `/solicitar`; a publicação segue a integração da branch `main` com o projeto Vercel `estoque_uniformes`.

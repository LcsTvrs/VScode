import type { CatalogVariant } from "./components/uniform-selector";

// Synthetic data used exclusively by the development-only layout preview.
export const previewStores = [
  { code: "DEMO", name: "Loja de demonstração", city: "São Paulo", state: "SP" },
  { code: "DEMO2", name: "Segunda loja de demonstração", city: "São Paulo", state: "SP" },
];

export const previewVariants: CatalogVariant[] = [
  ...["P", "M", "G", "GG"].flatMap(size => [
    { id: `polo-m-${size}`, name: "Camisa polo", sector: "Vendas", category: "CAMISETA", color: "Verde", gender: "MASCULINO", size, imageId: null },
    { id: `polo-f-${size}`, name: "Camisa polo", sector: "Vendas", category: "CAMISETA", color: "Verde", gender: "FEMININO", size, imageId: null },
    { id: `colete-${size}`, name: "Colete de trabalho", sector: "Todos", category: "COLETE", color: "Verde", gender: "MASCULINO", size, imageId: null },
  ]),
  ...["38", "40", "42", "44"].map(size => ({ id: `calca-${size}`, name: "Calça de trabalho", sector: "Todos", category: "CALCA", color: "Cinza", gender: "MASCULINO", size, imageId: null })),
];

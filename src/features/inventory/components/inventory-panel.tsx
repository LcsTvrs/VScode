import type { Dashboard, Variant } from "@/features/dashboard/types";
import { ArrowDownUp, ChevronDown, Download, Pencil, Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { uniformGenderLabel } from "../gender";
import { categoryNames } from "../labels";
import { UniformPhoto } from "./uniform-photo";

type Props = { dashboard: Dashboard; filteredVariants: Variant[]; search: string; setSearch: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void; isMasterAdmin: boolean; onImport: () => void; onMovement: () => void; onNew: () => void; onEdit: (variant: Variant) => void; onImage: (variant: Variant) => void; onCatalogEdit: (variant: Variant) => void; onOptions: () => void };

export function InventoryPanel({ dashboard, filteredVariants, search, setSearch, categoryFilter, setCategoryFilter, isMasterAdmin, onImport, onMovement, onNew, onEdit, onImage, onCatalogEdit, onOptions }: Props) {
  return <section className="content-panel full-panel">
              <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{filteredVariants.length} ITENS</span><h2>Saldo por uniforme</h2></div><div className="table-actions"><a className="button button-secondary button-small" href={`/api/exports/inventory?storeId=${encodeURIComponent(dashboard.store.id)}`}><Download size={15} /> Exportar CSV</a><button className="button button-secondary button-small" onClick={onImport}><Upload size={15} /> Importar Excel</button><button className="button button-secondary button-small" onClick={onMovement}><ArrowDownUp size={15} /> Movimentar estoque</button>{isMasterAdmin ? <><button className="button button-secondary button-small" onClick={onOptions}>Setores e categorias</button><button className="button button-primary button-small" onClick={onNew}><Plus size={16} /> Novo item</button></> : null}</div></div>
              <div className="filter-bar"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por setor, nome, SKU, tamanho…" /></label><label className="select-filter"><SlidersHorizontal size={15} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="TODAS">Todas as categorias</option>{[...new Set(dashboard.variants.map(v => v.category))].sort().map(category => <option key={category} value={category}>{categoryNames[category] ?? category}</option>)}</select><ChevronDown size={14} /></label></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>UNIFORME</th><th>SETOR</th><th>SKU</th><th>CATEGORIA</th><th>CLASSIFICAÇÃO</th><th>TAMANHO</th><th>DISPONÍVEL</th><th>ESTOQUE MÍNIMO</th><th>STATUS</th><th>AÇÃO</th></tr></thead>
                  <tbody>{filteredVariants.map((variant) => <tr key={variant.id}>
                    <td><div className="table-product"><UniformPhoto imageId={variant.imageId} name={variant.name} /><div><strong>{variant.name}</strong>{variant.color ? <span>{variant.color}</span> : null}</div></div></td>
                    <td>{variant.sector ?? "Geral"}</td>
                    <td><span className="sku-label">{variant.sku}</span></td>
                    <td>{categoryNames[variant.category] ?? variant.category}</td>
                    <td>{uniformGenderLabel(variant.gender)}</td>
                    <td><span className="size-chip">{variant.size}</span></td>
                    <td><strong className={variant.quantity <= variant.minimum ? "quantity-low" : "quantity-good"}>{variant.quantity}</strong> <span className="unit-label">peças</span></td>
                    <td>{variant.minimum} peças</td>
                    <td><span className={variant.quantity <= variant.minimum ? "status-pill status-warn" : "status-pill status-ok"}><i />{variant.quantity <= variant.minimum ? "Repor" : "Adequado"}</span></td>
                    <td><div className="stock-row-actions"><button className="edit-row-button" onClick={() => onEdit(variant)}><Pencil size={14} /> Editar</button>{isMasterAdmin ? <button className="edit-row-button" aria-label={`Imagem de ${variant.name} SKU ${variant.sku}`} onClick={() => onImage(variant)}><Upload size={14} /> Imagem</button> : null}{isMasterAdmin ? <button className="edit-row-button" onClick={() => onCatalogEdit(variant)}>Cadastro global</button> : null}</div></td>
                  </tr>)}</tbody>
                </table>
                {!filteredVariants.length ? <div className="table-empty">Nenhum uniforme encontrado para esse filtro.</div> : null}
              </div>
              <div className="table-note"><span><i className="legend-dot" /> Saldo igual ou abaixo do mínimo</span><span>Atualizado agora</span></div>
            </section>;
}

"use client";

import { readApiResponse } from "@/lib/api-response";

import { uniformGenderLabel } from "@/features/inventory/gender";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, type ImportPreview } from "@/features/inventory/import-types";
import { CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const categories: Record<string, string> = { CAMISETA: "Camiseta", CALCA: "Calça", JAQUETA: "Jaqueta", COLETE: "Colete", OUTRO: "Outro" };
const number = new Intl.NumberFormat("pt-BR");

export function InventoryImportDialog({ store, onClose, onSuccess }: {
  store: { id: string; name: string; code: string };
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "preview" | "confirm">("idle");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState("");
  const hasErrors = preview?.rows.some((row) => row.error);
  const allReviewed = !!preview?.token && reviewed.size === preview.rows.length && !stale;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function close() { if (!busy.current) onClose(); }

  async function generatePreview() {
    if (!file || busy.current || uncertain) return;
    busy.current = true;
    setPhase("preview");
    setError("");
    setPreview(null);
    setReviewed(new Set());
    setStale(false);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("storeId", store.id);
      const response = await fetch("/api/inventory/import/preview", { method: "POST", body: form });
      const data = await readApiResponse<ImportPreview>(response, "Não foi possível ler a planilha.");
      setPreview(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar a planilha.");
    } finally { busy.current = false; setPhase("idle"); }
  }

  async function confirm() {
    if (!allReviewed || !preview?.token || busy.current) return;
    busy.current = true;
    setPhase("confirm");
    setError("");
    // Keep the same preview after an ambiguous network/server error. Retrying it
    // retrieves the durable receipt instead of applying the addition again.
    setUncertain(true);
    try {
      const response = await fetch("/api/inventory/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: preview.token, reviewedVariantIds: [...reviewed] }),
      });
      if (!response.ok) {
        if (response.status < 500) setUncertain(false);
        if (response.status === 409) { setStale(true); setReviewed(new Set()); }

      }
      const data = await readApiResponse<{ alreadyApplied?: boolean; totalQuantity: number; itemCount: number }>(response, "Não foi possível confirmar a importação.");
      setUncertain(false);
      setCompleted(`${data.alreadyApplied ? "Importação já registrada" : "Importação concluída"}: ${number.format(data.totalQuantity)} peças adicionadas em ${data.itemCount} itens.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível receber a confirmação. Tente confirmar novamente com esta mesma prévia.");
    } finally { busy.current = false; setPhase("idle"); }
  }

  return <dialog ref={dialog} className="inventory-import-dialog" aria-labelledby="inventory-import-title" aria-describedby="inventory-import-description" onCancel={(event) => { event.preventDefault(); if (completed) onSuccess(completed); else close(); }}>
    <div className="modal-heading">
      <div><span className="section-kicker">ENTRADA DE ESTOQUE · {store.code}</span><h2 id="inventory-import-title">Importar planilha Excel</h2><p id="inventory-import-description">{store.name} · Confira cada item antes de adicionar as peças ao estoque.</p></div>
      <button className="icon-button modal-close" disabled={phase !== "idle"} onClick={() => completed ? onSuccess(completed) : close()} aria-label="Fechar importação"><X size={20} /></button>
    </div>
    <div className="inventory-import-body" aria-busy={phase !== "idle"}>
      {completed ? <div className="import-success" role="status"><CheckCircle2 size={38} /><h3>{completed}</h3><p>As entradas foram registradas no histórico de movimentações da loja.</p><button className="button button-primary" onClick={() => onSuccess(completed)}>Voltar ao estoque</button></div> : <>
        <div className="import-instructions"><FileSpreadsheet size={26} /><div><strong>Prepare as colunas SKU e Quantidade</strong><p>Uma única aba, cabeçalhos na primeira linha e até {IMPORT_MAX_ROWS} linhas de dados. Use quantidades inteiras positivas e valores sem fórmulas. Formate o SKU como texto para preservar zeros à esquerda.</p><a href="/modelo-entrada-estoque.xlsx" download>Baixar modelo Excel</a></div></div>
        <div className="import-upload">
          <label className="form-field"><span>Planilha .xlsx (até 2 MB)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={phase !== "idle" || uncertain} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(null); setPreview(null); setReviewed(new Set()); setStale(false); setError("");
            if (selected && (!/\.xlsx$/i.test(selected.name) || selected.size > IMPORT_MAX_BYTES)) { setError("Selecione um arquivo .xlsx de até 2 MB."); return; }
            setFile(selected);
          }} /></label>
          <button className="button button-secondary" disabled={!file || phase !== "idle" || uncertain} onClick={() => void generatePreview()}><Upload size={16} />{phase === "preview" ? "Lendo planilha…" : preview ? "Atualizar prévia" : "Gerar prévia"}</button>
        </div>
        {error ? <p className="import-error" role="alert">{error}</p> : null}
        {uncertain && phase === "idle" ? <p className="import-error" role="alert">A confirmação pode ter sido processada. Clique novamente em confirmar para consultar o resultado sem duplicar a entrada. Se fechar esta janela, verifique o saldo antes de iniciar outra importação.</p> : null}
        {preview ? <>
          <div className="import-summary" aria-live="polite"><strong>{preview.rows.length} itens · +{number.format(preview.totalQuantity)} peças</strong><span>{reviewed.size} de {preview.rows.length} itens conferidos</span></div>
          {hasErrors ? <p className="import-error" role="alert">Corrija todos os itens indicados na planilha ou cadastre os SKUs nesta loja e gere uma nova prévia. Nenhuma entrada foi realizada.</p> : <p className="import-help">Marque cada item após conferir nome, tipo e quantidades. SKUs repetidos estão agrupados; as linhas de origem aparecem abaixo do SKU. A prévia vale por 15 minutos.</p>}
          <p className="import-scroll-hint">Deslize a tabela para os lados para conferir todas as quantidades.</p>
          <div className="table-wrap import-table-wrap" tabIndex={0} role="region" aria-label="Itens da planilha para conferência">
            <table className="import-table"><thead><tr><th scope="col">CONFERIDO</th><th scope="col">SKU / LINHAS</th><th scope="col">ITEM / NOME</th><th scope="col">TIPO</th><th scope="col">ESTOQUE ATUAL</th><th scope="col">NA PLANILHA</th><th scope="col">APÓS A SOMA</th></tr></thead>
              <tbody>{preview.rows.map((row) => <tr key={row.sku} className={row.error ? "import-row-error" : reviewed.has(row.variantId!) ? "import-row-reviewed" : ""}>
                <td><input type="checkbox" aria-label={`Conferir ${row.sku} — ${row.name}`} checked={!!row.variantId && reviewed.has(row.variantId)} disabled={!!row.error || hasErrors || stale || phase !== "idle" || uncertain} onChange={(event) => {
                  const checked = event.target.checked;
                  setReviewed((current) => { const next = new Set(current); if (checked) next.add(row.variantId!); else next.delete(row.variantId!); return next; });
                }} /></td>
                <td><strong>{row.sku}</strong><small>Linhas {row.sourceRows.join(", ")}</small></td>
                <td><strong>{row.name}</strong><small>{row.variantId ? [`Tam. ${row.size}`, row.color].filter(Boolean).join(" · ") : "—"}</small>{row.error ? <small className="import-item-error">{row.error}</small> : null}</td>
                <td>{categories[row.category] ?? "—"}<small>{uniformGenderLabel(row.gender)}</small></td>
                <td>{row.currentQuantity === null ? "—" : number.format(row.currentQuantity)}</td>
                <td className="quantity-good">+{number.format(row.quantity)}</td>
                <td><strong>{row.finalQuantity === null ? "—" : number.format(row.finalQuantity)}</strong></td>
              </tr>)}</tbody>
            </table>
          </div>
        </> : null}
        <div className="modal-actions import-actions"><button className="button button-quiet" disabled={phase !== "idle"} onClick={close}>Cancelar</button><button className="button button-primary" disabled={!allReviewed || phase !== "idle"} onClick={() => void confirm()}>{phase === "confirm" ? "Registrando entradas…" : uncertain ? "Verificar confirmação" : "Confirmar e somar ao estoque"}<CheckCircle2 size={16} /></button></div>
      </>}
    </div>
  </dialog>;
}

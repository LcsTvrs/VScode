"use client";

import { readApiResponse } from "@/lib/api-response";

import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Details = { imageId: string | null; version: string; matches: { id: string; imageId: string | null; store: { name: string; code: string } }[] };

export function UniformImageDialog({ variant, variants, onClose, onSaved }: {
  variant: { id: string; name: string; sku: string; size: string };
  variants?: { id: string; name: string; sku: string; size: string }[];
  onClose: () => void; onSaved: (count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const replicate = true;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const bulk = !!variants;
  const idsQuery = variants?.map(item => `id=${encodeURIComponent(item.id)}`).join("&");
  const endpoint = bulk ? "/api/variants/images" : `/api/variants/${encodeURIComponent(variant.id)}/image`;

  useEffect(() => {
    const element = dialog.current;
    const controller = new AbortController();
    element?.showModal();
    void (async () => {
      try {
        const response = await fetch(idsQuery ? `${endpoint}?${idsQuery}` : endpoint, { cache: "no-store", signal: controller.signal });
        const data = await readApiResponse<Details>(response, "Não foi possível carregar as lojas.");
        setDetails(data);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha ao carregar as lojas."); }
    })();
    return () => { controller.abort(); element?.close(); };
  }, [endpoint, idsQuery]);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(candidate: File | undefined) {
    setError(""); setFile(null);
    if (!candidate) return;
    if (!candidate.size || candidate.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(candidate.type)) {
      setError("Escolha uma imagem JPG, PNG ou WebP de até 2 MB."); return;
    }
    setFile(candidate);
  }

  function close() { if (!busy.current) onClose(); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details || stale || busy.current || (!file && (bulk || !details.imageId))) return;
    busy.current = true; setSaving(true); setError("");
    const form = new FormData();
    form.set("version", details.version);
    form.set("replicate", String(replicate));
    variants?.forEach(item => form.append("id", item.id));
    if (file) form.set("image", file);
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      if (!response.ok && (response.status === 409 || response.status >= 500)) setStale(true);
      const data = await readApiResponse<{ updatedCount: number }>(response, "Não foi possível salvar a imagem.");
      onSaved(data.updatedCount);
    } catch (cause) {
      if (cause instanceof TypeError) setStale(true);
      setError(cause instanceof Error ? cause.message : "Falha ao salvar. Reabra a janela para conferir.");
    } finally { busy.current = false; setSaving(false); }
  }

  const source = preview || (details?.imageId ? `/api/uniform-images/${encodeURIComponent(details.imageId)}` : "");
  return <dialog ref={dialog} className="modal image-dialog" aria-labelledby="uniform-image-title" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="modal-heading"><div><span className="section-kicker">IMAGEM DO UNIFORME</span><h2 id="uniform-image-title">Atribuir imagem</h2></div><button className="icon-button" aria-label="Fechar imagem" disabled={saving} onClick={close}><X size={18} /></button></div>
    {variants ? <div className="image-destinations"><p><strong>{variants.length} registros selecionados · {new Set(variants.map(item => item.sku)).size} SKUs</strong></p><ul>{[...new Map(variants.map(item => [item.sku, item])).values()].map(item => <li key={item.sku}>{item.name} · Tam. {item.size} · SKU {item.sku}</li>)}</ul></div> : <p className="image-identity"><strong>Tam. {variant.size} · {variant.name}</strong><span>SKU {variant.sku}</span></p>}
    {!details && !error ? <p role="status">Carregando lojas…</p> : null}
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={!details || saving || stale}>
        <legend className="sr-only">Foto e lojas de destino</legend>
        {source ? <Image className="image-preview" src={source} alt={`Prévia da imagem de ${variant.name}`} width={320} height={240} unoptimized /> : <div className="image-preview image-empty">Nenhuma imagem atribuída</div>}
        <label className="form-field"><span>Escolher imagem</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files?.[0])} /><small>JPG, PNG ou WebP · Até 2 MB e 16 megapixels · Sem animação</small></label>
        {details ? <div className="image-destinations"><p>{bulk ? `A mesma foto substituirá as imagens dos SKUs selecionados em todas as lojas (${details.matches.length} registros), incluindo lojas cadastradas futuramente.` : "A imagem deste SKU será atualizada em todas as lojas, incluindo lojas cadastradas futuramente:"}</p>{!bulk ? <ul>{details.matches.map(match => <li key={match.id}>{match.store.name} · {match.store.code}</li>)}</ul> : null}</div> : null}
      </fieldset>
      {error ? <p className="form-error" role="alert">{error}{stale ? " Feche e reabra esta janela antes de continuar." : ""}</p> : null}
      <div className="modal-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={close}>Cancelar</button><button type="submit" className="button button-primary" disabled={!details || saving || stale || (!file && (bulk || !details.imageId))}>{saving ? "Salvando…" : bulk ? "Aplicar foto aos selecionados" : "Salvar imagem"}</button></div>
    </form>
  </dialog>;
}

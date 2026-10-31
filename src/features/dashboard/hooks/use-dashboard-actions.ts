"use client";

import { ApiResponseError, readApiResponse } from "@/lib/api-response";
import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { Dashboard, Modal, RequestLine, RequestRow, Variant } from "../types";

type Options = { dashboard: Dashboard | null; selectedStoreId: string; modal: Modal; editingVariant: Variant | null; requestLines: RequestLine[]; setModal: Dispatch<SetStateAction<Modal>>; setRequestLines: Dispatch<SetStateAction<RequestLine[]>>; showNotice: (message: string, error?: boolean) => void; loadDashboard: (storeId: string) => Promise<void> };

export function useDashboardActions({ dashboard, selectedStoreId, modal, editingVariant, requestLines, setModal, setRequestLines, showNotice, loadDashboard }: Options) {
  const currentStoreId = useRef(selectedStoreId);
  currentStoreId.current = selectedStoreId;
  const reload = () => loadDashboard(currentStoreId.current);
  const busy = useRef(false);
  const processing = useRef(false);
  const [actionError, setActionError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dashboard || busy.current || uncertain) return;
    busy.current = true;
    setSaving(true); setActionError("");
    const form = new FormData(event.currentTarget);
    let endpoint = "";
    let payload: Record<string, unknown> = {};
    let successMessage = "";

    if (modal === "novo-item" || modal === "editar-item") {
      endpoint = "/api/variants";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? form.get("storeId") || dashboard.store.id : undefined,
        sku: form.get("sku"),
        name: form.get("name"),
        sector: form.get("sector"),
        category: form.get("category"),
        gender: form.get("gender"),
        size: form.get("size"),
        ...(modal === "editar-item" ? { updatedAt: editingVariant?.catalogUpdatedAt } : {}),
      };
      successMessage = "Catálogo atualizado em todas as lojas. Estoques preservados.";
    } else if (modal === "movimentacao") {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? form.get("storeId") || dashboard.store.id : undefined,
        variantId: form.get("variantId"),
        type: form.get("type"),
        quantity: Number(form.get("quantity")),
        note: form.get("note"),
      };
      successMessage = "Movimentação registrada.";
    } else if (modal === "editar-estoque" && editingVariant) {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? editingVariant.storeId ?? dashboard.store.id : undefined,
        variantId: editingVariant.id,
        updatedAt: editingVariant.updatedAt,
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Estoque atualizado nesta loja.";
    } else if (modal === "solicitacao") {
      endpoint = "/api/requests";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? form.get("storeId") || dashboard.store.id : undefined,
        employeeId: form.get("employeeId"),
        notes: form.get("notes"),
        items: requestLines.filter((line) => line.variantId && line.quantity > 0),
      };
      successMessage = "Solicitação enviada para aprovação.";
    }

    try {
      const response = await fetch(endpoint, {
        method: modal === "editar-estoque" ? "PATCH" : modal === "editar-item" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApiResponse(response, "Não foi possível concluir esta ação.");
      setModal(null);
      setRequestLines([{ variantId: "", quantity: 1 }]);
      showNotice(successMessage);
      await reload();
    } catch (error) {
      const ambiguous = (modal === "movimentacao" || modal === "solicitacao") && (!(error instanceof ApiResponseError) || error.status >= 500 || error.status < 400);
      setUncertain(ambiguous);
      setActionError(ambiguous ? "Não foi possível confirmar o resultado. Feche esta janela e confira o estoque ou o histórico antes de iniciar outra operação, para evitar duplicação." : error instanceof Error ? error.message : "Não foi possível concluir esta ação.");
    } finally {
      busy.current = false; setSaving(false);
    }
  }

  async function processRequest(request: RequestRow, action: "APROVAR" | "RECUSAR") {
    if (processing.current) return;
    processing.current = true;
    setProcessingRequestId(request.id);
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, updatedAt: request.updatedAt }),
      });
      if (response.status === 409) await reload();
      await readApiResponse(response, "Não foi possível processar o pedido.");
      showNotice(action === "APROVAR" ? "Solicitação aprovada e estoque atualizado." : "Solicitação recusada.");
      await reload();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível processar o pedido.", true);
    } finally { processing.current = false; setProcessingRequestId(null); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/admin/login");
  }

  return { actionError, uncertain, clearActionError: () => { setActionError(""); setUncertain(false); }, saving, processingRequestId, handleSubmit, processRequest, logout };
}

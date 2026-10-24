"use client";

import { readApiResponse } from "@/lib/api-response";
import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { Dashboard, Modal, RequestLine, RequestRow, Variant } from "../types";

type Options = { dashboard: Dashboard | null; selectedStoreId: string; modal: Modal; editingVariant: Variant | null; requestLines: RequestLine[]; setModal: Dispatch<SetStateAction<Modal>>; setRequestLines: Dispatch<SetStateAction<RequestLine[]>>; showNotice: (message: string) => void; loadDashboard: (storeId: string) => Promise<void> };

export function useDashboardActions({ dashboard, selectedStoreId, modal, editingVariant, requestLines, setModal, setRequestLines, showNotice, loadDashboard }: Options) {
  const [saving, setSaving] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dashboard) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    let endpoint = "";
    let payload: Record<string, unknown> = {};
    let successMessage = "";

    if (modal === "novo-item") {
      endpoint = "/api/variants";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        sku: form.get("sku"),
        name: form.get("name"),
        sector: form.get("sector"),
        category: form.get("category"),
        gender: form.get("gender"),
        size: form.get("size"),
        color: form.get("color"),
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Uniforme cadastrado no estoque.";
    } else if (modal === "movimentacao") {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        variantId: form.get("variantId"),
        type: form.get("type"),
        quantity: Number(form.get("quantity")),
        note: form.get("note"),
      };
      successMessage = "Movimentação registrada.";
    } else if (modal === "editar-estoque" && editingVariant) {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        variantId: editingVariant.id,
        updatedAt: editingVariant.updatedAt,
        gender: form.get("gender") || null,
        sector: form.get("sector"),
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Estoque e classificação atualizados.";
    } else if (modal === "solicitacao") {
      endpoint = "/api/requests";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        employeeId: form.get("employeeId"),
        notes: form.get("notes"),
        items: requestLines.filter((line) => line.variantId && line.quantity > 0),
      };
      successMessage = "Solicitação enviada para aprovação.";
    }

    try {
      const response = await fetch(endpoint, {
        method: modal === "editar-estoque" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApiResponse(response, "Não foi possível concluir esta ação.");
      setModal(null);
      setRequestLines([{ variantId: "", quantity: 1 }]);
      showNotice(successMessage);
      await loadDashboard(selectedStoreId);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível concluir esta ação.");
    } finally {
      setSaving(false);
    }
  }

  async function processRequest(request: RequestRow, action: "APROVAR" | "RECUSAR") {
    if (processingRequestId) return;
    setProcessingRequestId(request.id);
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, updatedAt: request.updatedAt }),
      });
      if (response.status === 409) await loadDashboard(selectedStoreId);
      await readApiResponse(response, "Não foi possível processar o pedido.");
      showNotice(action === "APROVAR" ? "Solicitação aprovada e estoque atualizado." : "Solicitação recusada.");
      await loadDashboard(selectedStoreId);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível processar o pedido.");
    } finally { setProcessingRequestId(null); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/admin/login");
  }

  return { saving, processingRequestId, handleSubmit, processRequest, logout };
}

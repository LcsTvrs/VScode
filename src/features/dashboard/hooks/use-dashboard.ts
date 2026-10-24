"use client";

import { ApiResponseError, readApiResponse } from "@/lib/api-response";
import { useCallback, useEffect, useState } from "react";
import type { Account, Dashboard } from "../types";

export function useDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [availableStores, setAvailableStores] = useState<Dashboard["availableStores"]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showStoreOverview, setShowStoreOverview] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadDashboard = useCallback(async (storeId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ""}`, { cache: "no-store" });
      const data = await readApiResponse<Dashboard & { code?: string }>(response, "Não foi possível carregar o painel.");
      if (data.account) setAccount(data.account as Account);
      if (Array.isArray(data.availableStores)) setAvailableStores(data.availableStores);
      if (response.ok && data.code === "STORE_SELECTION_REQUIRED") {
        setDashboard(null);
        setSelectedStoreId("");
        setShowStoreOverview(true);
        setNeedsSetup(false);
        setLoadError("");
        return;
      }
      setDashboard(data as Dashboard);
      setSelectedStoreId(data.store.id);
      setShowStoreOverview(false);
      setNeedsSetup(false);
      setLoadError("");
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED") {
        window.location.assign("/admin/trocar-senha");
        return;
      }
      if (error instanceof ApiResponseError && error.status === 404 && error.code === "STORE_NOT_CONFIGURED") {
        setDashboard(null); setNeedsSetup(true); setShowStoreOverview(false); setLoadError("");
        return;
      }
      setDashboard(null);
      setNeedsSetup(false);
      setLoadError(error instanceof Error ? error.message : "Falha de conexão com o banco de dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(new URLSearchParams(window.location.search).get("storeId") ?? "");
  }, [loadDashboard]);

  return { dashboard, account, availableStores, selectedStoreId, setSelectedStoreId, loading, needsSetup, showStoreOverview, loadError, loadDashboard };
}

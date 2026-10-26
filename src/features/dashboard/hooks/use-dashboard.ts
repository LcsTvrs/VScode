"use client";

import { ApiResponseError, readApiResponse } from "@/lib/api-response";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Account, Dashboard } from "../types";

export function useDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [availableStores, setAvailableStores] = useState<Dashboard["availableStores"]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const sequence = useRef(0);
  const [loadError, setLoadError] = useState("");
  const loadDashboard = useCallback(async (storeId: string) => {
    const invocation = ++sequence.current;
    setLoading(true);
    setDashboard(null);
    try {
      const response = await fetch(`/api/dashboard${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ""}`, { cache: "no-store" });
      const data = await readApiResponse<Dashboard & { code?: string }>(response, "Não foi possível carregar o painel.");
      if (invocation !== sequence.current) return;
      if (data.account) setAccount(data.account as Account);
      if (Array.isArray(data.availableStores)) setAvailableStores(data.availableStores);
      setDashboard(data as Dashboard);
      setSelectedStoreId(data.store.id);
      setNeedsSetup(false);
      setLoadError("");
    } catch (error) {
      if (invocation !== sequence.current) return;
      if (error instanceof ApiResponseError && error.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED") {
        window.location.assign("/admin/trocar-senha");
        return;
      }
      if (error instanceof ApiResponseError && error.status === 404 && error.code === "STORE_NOT_CONFIGURED") {
        setDashboard(null); setNeedsSetup(true); setLoadError("");
        return;
      }
      setDashboard(null);
      setNeedsSetup(false);
      setLoadError(error instanceof Error ? error.message : "Falha de conexão com o banco de dados.");
    } finally {
      if (invocation === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(new URLSearchParams(window.location.search).get("storeId") ?? "");
  }, [loadDashboard]);

  return { dashboard, account, availableStores, selectedStoreId, setSelectedStoreId, loading, needsSetup, loadError, loadDashboard };
}

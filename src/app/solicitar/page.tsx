"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, LogIn, Minus, Plus, Shirt } from "lucide-react";
import { FULL_NAME_PATTERN, LDAP_PATTERN, validateRequestIdentity } from "@/lib/request-identity";

type AvailableVariant = {
  id: string;
  name: string;
  category: string;
  size: string;
  color: string;
  available: number;
};

type Catalog = {
  storeName?: string;
  variants?: AvailableVariant[];
  requiresStoreSelection?: boolean;
  stores?: { code: string; name: string; city: string; state: string }[];
};
type RequestResult = { code: string };

const categoryLabels: Record<string, string> = {
  CAMISETA: "Camiseta",
  CALCA: "Calça",
  JAQUETA: "Jaqueta",
  COLETE: "Colete",
  OUTRO: "Outro",
};

export default function RequestUniformPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [storeCode, setStoreCode] = useState("");
  const [ldap, setLdap] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"identity" | "catalog" | "complete">("identity");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const selectedStoreCode = new URLSearchParams(window.location.search).get("loja")?.trim().toUpperCase() ?? "";
    setStoreCode(selectedStoreCode);
    setLoading(true);
    const catalogUrl = selectedStoreCode ? `/api/requests/public?storeCode=${encodeURIComponent(selectedStoreCode)}` : "/api/requests/public";
    fetch(catalogUrl, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Não foi possível carregar os uniformes.");
        if (!cancelled) setCatalog(data as Catalog);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Falha de conexão.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function continueToCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const identity = validateRequestIdentity(ldap, name);
    if (!identity.ok) { setError(identity.message); return; }
    setLdap(identity.ldap);
    setName(identity.name);
    setStep("catalog");
  }

  async function selectStore(code: string) {
    setStoreCode(code);
    setError("");
    window.history.replaceState(null, "", `/solicitar?loja=${encodeURIComponent(code)}`);
    setLoading(true);
    try {
      const response = await fetch(`/api/requests/public?storeCode=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível carregar a loja.");
      setCatalog(data as Catalog);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a loja.");
    } finally {
      setLoading(false);
    }
  }

  function updateQuantity(variant: AvailableVariant, next: number) {
    setQuantities((current) => {
      const updated = { ...current };
      if (next <= 0) delete updated[variant.id];
      else updated[variant.id] = Math.min(next, variant.available);
      return updated;
    });
  }

  async function submitRequest() {
    const identity = validateRequestIdentity(ldap, name);
    if (!identity.ok) { setError(identity.message); setStep("identity"); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ldap: identity.ldap,
          name: identity.name,
          storeCode,
          items: Object.entries(quantities).map(([variantId, quantity]) => ({ variantId, quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível enviar o pedido.");
      setCode((data as RequestResult).code);
      setStep("complete");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o pedido.");
      if (reason instanceof Error && reason.message.includes("Atualize a lista")) {
        const catalogUrl = storeCode ? `/api/requests/public?storeCode=${encodeURIComponent(storeCode)}` : "/api/requests/public";
        const response = await fetch(catalogUrl, { cache: "no-store" });
        if (response.ok) setCatalog(await response.json() as Catalog);
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = Object.values(quantities).reduce((total, quantity) => total + quantity, 0);

  return (
    <main className="public-request-shell">
      <header className="public-request-header">
        <Link href="/" className="request-brand" aria-label="Voltar ao painel">
          <Image className="brand-logo" src="/leroy-merlin.svg" alt="Leroy Merlin" width={56} height={34} />
          <span><strong>Gestão Uniformes</strong><small>{catalog?.storeName ?? "Leroy Merlin"}</small></span>
        </Link>
        <Link href="/admin/login" className="public-admin-login"><LogIn size={15} /> Login administrador</Link>
      </header>

      <section className="public-request-content">
        <div className="request-intro">
          <p className="eyebrow">UNIFORMES DA LOJA</p>
          <h1>{step === "complete" ? "Pedido enviado." : "Vista o seu próximo turno."}</h1>
          <p>{step === "identity" ? "Informe seus dados para consultar as peças disponíveis para você." : step === "catalog" ? "Escolha os itens e as quantidades para enviar sua solicitação." : "Sua solicitação já está com a equipe responsável pela loja."}</p>
        </div>

        <div className="request-progress" aria-label={`Etapa ${step === "identity" ? "1 de 2" : step === "catalog" ? "2 de 2" : "concluída"}`}>
          <span className={step === "identity" ? "progress-step current" : "progress-step complete"}><i>{step === "identity" ? "01" : <CheckCircle2 size={15} />}</i><b>Identificação</b></span>
          <span className="progress-track" />
          <span className={step === "catalog" ? "progress-step current" : step === "complete" ? "progress-step complete" : "progress-step"}><i>{step === "complete" ? <CheckCircle2 size={15} /> : "02"}</i><b>Uniformes</b></span>
        </div>

        <section className="public-request-panel">
          {step === "identity" && catalog?.requiresStoreSelection ? <div className="identity-form">
            <div className="public-panel-heading"><span className="public-step-icon"><ClipboardCheck size={19} /></span><div><h2>Selecione sua loja</h2><p>O catálogo e a solicitação serão encaminhados para esta unidade.</p></div></div>
            <label className="public-field"><span>Loja</span><select value={storeCode} onChange={(event) => { if (event.target.value) void selectStore(event.target.value); }}><option value="">Selecione uma unidade</option>{catalog.stores?.map((store) => <option value={store.code} key={store.code}>{store.name} · {store.city}/{store.state}</option>)}</select></label>
            {error ? <p className="public-error" role="alert">{error}</p> : null}
          </div> : null}

          {step === "identity" && !catalog?.requiresStoreSelection ? <form className="identity-form" onSubmit={continueToCatalog}>
            <div className="public-panel-heading"><span className="public-step-icon"><ClipboardCheck size={19} /></span><div><h2>Identifique-se</h2><p>Não é necessário entrar com senha.</p></div></div>
            <label className="public-field"><span>LDAP</span><input type="text" inputMode="numeric" autoComplete="username" value={ldap} onChange={(event) => { if (/^[0-9]{0,8}$/.test(event.target.value)) setLdap(event.target.value); }} placeholder="Ex.: 00123456" pattern={LDAP_PATTERN} minLength={8} maxLength={8} title="Digite exatamente 8 números." aria-describedby="ldap-help" required /><small id="ldap-help">Exatamente 8 números, incluindo os zeros iniciais.</small></label>
            <label className="public-field"><span>Nome completo</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome completo" pattern={FULL_NAME_PATTERN} title="Use apenas letras, acentos e espaços." aria-describedby="name-help" required /><small id="name-help">Apenas letras, acentos e espaços.</small></label>
            {error ? <p className="public-error" role="alert">{error}</p> : null}
            <button type="submit" className="public-primary-button" disabled={loading}>{loading ? "Carregando uniformes…" : "Continuar"}<ArrowRight size={17} /></button>
            <p className="privacy-note">Seus dados serão usados somente para identificar esta solicitação.</p>
          </form> : null}

          {step === "catalog" ? <div className="catalog-step">
            <div className="public-panel-heading catalog-heading"><span className="public-step-icon"><Shirt size={19} /></span><div><h2>Escolha seus uniformes</h2><p>Solicitação para <strong>{name}</strong> · LDAP {ldap}</p></div></div>
            {loading ? <div className="catalog-message">Carregando disponibilidade…</div> : null}
            {!loading && catalog?.variants?.length ? <div className="public-variant-list">{catalog.variants.map((variant) => <article className="public-variant" key={variant.id}>
              <span className="public-shirt-icon"><Shirt size={19} /></span>
              <div className="public-variant-details"><span>{categoryLabels[variant.category] ?? variant.category} · {variant.color}</span><strong>{variant.name}</strong><small>Tamanho {variant.size} · {variant.available} {variant.available === 1 ? "disponível" : "disponíveis"}</small></div>
              <div className="quantity-control"><button type="button" onClick={() => updateQuantity(variant, (quantities[variant.id] ?? 0) - 1)} aria-label={`Remover uma unidade de ${variant.name} tamanho ${variant.size}`} disabled={!quantities[variant.id]}><Minus size={15} /></button><span>{quantities[variant.id] ?? 0}</span><button type="button" onClick={() => updateQuantity(variant, (quantities[variant.id] ?? 0) + 1)} aria-label={`Adicionar uma unidade de ${variant.name} tamanho ${variant.size}`} disabled={(quantities[variant.id] ?? 0) >= variant.available}><Plus size={15} /></button></div>
            </article>)}</div> : !loading ? <div className="catalog-message">Nenhum uniforme está disponível para solicitação no momento.</div> : null}
            {error ? <p className="public-error" role="alert">{error}</p> : null}
            <div className="catalog-actions"><button type="button" className="public-back-button" onClick={() => { setError(""); setStep("identity"); }}><ArrowLeft size={16} /> Voltar</button><button type="button" className="public-primary-button" onClick={() => void submitRequest()} disabled={saving || selectedCount === 0 || !catalog?.variants?.length}>{saving ? "Enviando…" : `Enviar solicitação${selectedCount ? ` · ${selectedCount} ${selectedCount === 1 ? "peça" : "peças"}` : ""}`}<ArrowRight size={17} /></button></div>
          </div> : null}

          {step === "complete" ? <div className="request-complete"><span className="complete-mark"><CheckCircle2 size={29} /></span><h2>Solicitação registrada</h2><p>O pedido <strong>{code}</strong> foi enviado para aprovação da loja. Guarde o código para consultar com a equipe.</p><div className="request-receipt"><span>COLABORADOR</span><strong>{name}</strong><small>LDAP {ldap}</small><span>STATUS</span><strong className="receipt-status">Aguardando aprovação</strong></div><Link href="/" className="public-back-button"><ArrowLeft size={16} /> Voltar ao início</Link></div> : null}
        </section>
        <footer className="public-request-footer"><span>Uniformes · {catalog?.storeName ?? "Leroy Merlin"}</span><Link href="/">Painel da loja <ArrowRight size={13} /></Link></footer>
      </section>
    </main>
  );
}

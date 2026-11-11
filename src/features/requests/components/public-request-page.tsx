"use client";

import { UniformPhoto } from "@/features/inventory/components/uniform-photo";
import { uniformGenderLabel } from "@/features/inventory/gender";
import { FULL_NAME_PATTERN, LDAP_PATTERN, validateRequestIdentity } from "@/features/requests/identity";
import { PUBLIC_ITEM_LIMIT } from "@/features/requests/items";
import { readApiResponse } from "@/lib/api-response";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Copy, HelpCircle, LockKeyhole, LogIn, MapPin, Minus, Plus, ShieldCheck, Shirt, ShoppingBag, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { UniformSelector, type CatalogVariant } from "./uniform-selector";
import { previewStores, previewVariants } from "../preview-catalog";

type Catalog = {
  storeName?: string;
  variants?: CatalogVariant[];
  sectors?: string[];
  requiresStoreSelection?: boolean;
  stores?: { code: string; name: string; city: string; state: string }[];
};

function demoCatalog(code: string): Catalog {
  return { storeName: previewStores.find(store => store.code === code)?.name ?? previewStores[0].name, sectors: ["Vendas", "Logística", "Caixas"], variants: previewVariants };
}

export default function RequestUniformPage({ preview = false }: { preview?: boolean }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [storeCode, setStoreCode] = useState("");
  const [ldap, setLdap] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"identity" | "catalog" | "complete">("identity");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [chosenVariants, setChosenVariants] = useState<Record<string, CatalogVariant>>({});
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const submitting = useRef(false);

  useEffect(() => {
    if (previousStep.current !== step) {
      stageHeading.current?.focus();
      previousStep.current = step;
    }
  }, [step]);

  useEffect(() => {
    const controller = new AbortController();
    const selectedStoreCode = new URLSearchParams(window.location.search).get("loja")?.trim().toUpperCase() ?? "";
    setStoreCode(selectedStoreCode);
    if (preview) {
      setCatalog(selectedStoreCode ? demoCatalog(selectedStoreCode) : { requiresStoreSelection: true, stores: previewStores });
      setLoading(false);
      return;
    }
    const url = selectedStoreCode ? "/api/requests/public?storeCode=" + encodeURIComponent(selectedStoreCode) : "/api/requests/public";
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await readApiResponse<Catalog>(response, "Não foi possível carregar os uniformes. Atualize a página para tentar novamente.");
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha de conexão.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview]);

  function continueToCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (loading || !catalog?.variants || catalog.requiresStoreSelection) return;
    const identity = validateRequestIdentity(ldap, name);
    if (!identity.ok) { setError(identity.message); return; }
    setLdap(identity.ldap);
    setName(identity.name);
    setStep("catalog");
  }

  async function selectStore(value: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const data = preview ? demoCatalog(value) : await readApiResponse<Catalog>(
        await fetch("/api/requests/public?storeCode=" + encodeURIComponent(value), { cache: "no-store" }),
        "Não foi possível carregar a loja. Tente novamente."
      );
      setStoreCode(value);
      setCatalog(data);
      setQuantities({});
      setChosenVariants({});
      window.history.replaceState(null, "", window.location.pathname + "?loja=" + encodeURIComponent(value));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a loja. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function updateQuantity(variant: CatalogVariant, next: number) {
    setChosenVariants(current => ({ ...current, [variant.id]: variant }));
    setQuantities(current => {
      const updated = { ...current };
      if (next <= 0) delete updated[variant.id];
      else updated[variant.id] = Math.min(next, PUBLIC_ITEM_LIMIT);
      return updated;
    });
  }

  async function submitRequest() {
    if (submitting.current || loading || !Object.keys(quantities).length) return;
    const identity = validateRequestIdentity(ldap, name);
    if (!identity.ok) { setError(identity.message); setStep("identity"); return; }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      if (preview) {
        setCode("PRÉVIA-001");
        setStep("complete");
        return;
      }
      const response = await fetch("/api/requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ldap: identity.ldap, name: identity.name, storeCode,
          items: Object.entries(quantities).map(([variantId, quantity]) => ({ variantId, quantity })),
        }),
      });
      const data = await readApiResponse<{ code: string }>(response, "Não foi possível confirmar o envio. Consulte a equipe da loja antes de repetir o pedido.");
      if (typeof data.code !== "string" || !data.code) throw new Error("Não foi possível confirmar o envio. Consulte a equipe da loja antes de repetir o pedido.");
      setCode(data.code);
      setStep("complete");
    } catch (reason) {
      setError(reason instanceof TypeError ? "Falha de conexão. Consulte a equipe da loja antes de repetir o pedido." : reason instanceof Error ? reason.message : "Não foi possível confirmar o envio. Consulte a equipe da loja antes de repetir o pedido.");
      if (reason instanceof Error && reason.message.includes("Atualize a lista")) {
        try {
          const url = storeCode ? "/api/requests/public?storeCode=" + encodeURIComponent(storeCode) : "/api/requests/public";
          setCatalog(await readApiResponse<Catalog>(await fetch(url, { cache: "no-store" }), "Não foi possível atualizar os uniformes."));
        } catch {
          setError("Não foi possível atualizar os uniformes. Atualize a página antes de tentar novamente.");
        }
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage("Código copiado.");
    } catch {
      setCopyMessage("Selecione o código acima e copie para guardar.");
    }
  }

  const selectedCount = Object.values(quantities).reduce((total, quantity) => total + quantity, 0);
  const hasUnavailable = Object.keys(quantities).some(id => !catalog?.variants?.some(variant => variant.id === id));
  const activeStep = step === "identity" ? 0 : step === "catalog" ? 1 : 2;
  const requestUrl = preview ? "/preview/solicitar" : "/solicitar";

  return (
    <div className="public-request-shell">
      <a href="#request-main" className="request-skip-link">Pular para a solicitação</a>
      {preview ? <div className="request-preview-notice"><strong>Prévia de layout</strong><span>Dados demonstrativos. Nenhum pedido será enviado.</span></div> : null}
      <header className="public-request-header">
        <div className="request-header-inner">
          <Link href={requestUrl} className="request-brand" aria-label="Leroy Merlin — início da solicitação">
            <Image src="/leroy-merlin.svg" alt="Leroy Merlin" width={88} height={53} priority />
            <span className="request-brand-divider" />
            <span><small>PORTAL DO COLABORADOR</small><strong>Uniformes</strong></span>
          </Link>
          <div className="request-header-actions">
            {catalog?.storeName ? <span className="request-store"><MapPin size={16} aria-hidden="true" /><span>{catalog.storeName}</span></span> : null}
            <Link href="/admin/login" className="public-admin-login"><LogIn size={16} aria-hidden="true" /><span>Área administrativa</span></Link>
          </div>
        </div>
      </header>

      <main id="request-main" className="public-request-content">
        <div className="request-context"><span>Portal do colaborador</span><span aria-hidden="true">/</span><strong>Solicitação de uniformes</strong></div>
        <ol className="request-progress" aria-label="Etapas da solicitação">
          {["Seus dados", "Seus uniformes", "Confirmação"].map((label, index) => (
            <li key={label} className={index === activeStep ? "current" : index < activeStep ? "complete" : ""} aria-current={index === activeStep ? "step" : undefined}>
              <span className="request-progress-number">{index < activeStep || step === "complete" ? <Check size={17} aria-hidden="true" /> : "0" + (index + 1)}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        {step === "identity" ? <div className="request-identity-layout">
          <section className="request-welcome" aria-labelledby="request-welcome-title">
            <div className="request-welcome-copy">
              <span className="request-eyebrow"><span /> FEITO PARA QUEM FAZ ACONTECER</span>
              <h1 id="request-welcome-title">Seu uniforme.<br /><span>Nosso time.</span></h1>
              <p>Você faz parte de cada conquista.<br />Peça seus uniformes e prepare-se para o dia a dia na loja.</p>
              <span className="request-welcome-tag"><Shirt size={16} aria-hidden="true" /> Um jeito simples de cuidar da sua rotina.</span>
            </div>
            <div className="request-hero-photo">
              <Image src="/images/uniformes-equipe.webp" alt="Composição ilustrativa com uniformes dobrados em tons de verde e cinza" width={960} height={640} priority sizes="(max-width: 760px) 100vw, 560px" />
              <span>Imagem ilustrativa</span>
            </div>
          </section>

          <section className="request-form-panel" aria-labelledby="identity-title">
            <div className="request-panel-kicker"><span>01 / SEUS DADOS</span><span><LockKeyhole size={13} aria-hidden="true" /> Sem senha</span></div>
            <h2 id="identity-title" ref={stageHeading} tabIndex={-1}>Vamos começar?</h2>
            <p className="request-panel-description">Informe sua loja e seus dados para encontrar os uniformes disponíveis.</p>

            {catalog?.requiresStoreSelection ? <div className="request-store-selection">
              <label className="public-field"><span>Sua loja</span><select value={storeCode} disabled={loading} onChange={event => { if (event.target.value) void selectStore(event.target.value); }}>
                <option value="">Selecione a unidade onde você trabalha</option>
                {catalog.stores?.map(store => <option value={store.code} key={store.code}>{store.name} · {store.city}/{store.state}</option>)}
              </select></label>
              <p className="request-field-help">{loading ? "Carregando os uniformes da loja…" : "Sua solicitação será encaminhada para esta unidade."}</p>
            </div> : catalog?.storeName ? <div className="request-selected-store"><MapPin size={20} aria-hidden="true" /><div><small>SUA LOJA</small><strong>{catalog.storeName}</strong></div><CheckCircle2 size={18} aria-label="Loja selecionada" /></div> : null}

            <form className="identity-form" onSubmit={continueToCatalog} aria-busy={loading}>
              <fieldset disabled={loading || !!catalog?.requiresStoreSelection}>
                <legend className="request-sr-only">Identificação do colaborador</legend>
                <label className="public-field"><span>LDAP <span className="request-label-hint">Identificação do colaborador</span></span>
                  <input type="text" inputMode="numeric" autoComplete="username" value={ldap} onChange={event => { if (/^[0-9]{0,8}$/.test(event.target.value)) setLdap(event.target.value); }} placeholder="Ex.: 00123456" pattern={LDAP_PATTERN} minLength={8} maxLength={8} title="Digite exatamente 8 números." aria-describedby="ldap-help" required />
                  <small id="ldap-help">Digite os 8 números, incluindo os zeros iniciais.</small>
                </label>
                <label className="public-field"><span>Nome completo</span>
                  <input autoComplete="name" autoCapitalize="words" value={name} onChange={event => setName(event.target.value)} placeholder="Como você se chama?" pattern={FULL_NAME_PATTERN} title="Use apenas letras, acentos e espaços." required />
                </label>
              </fieldset>
              {error ? <p className="public-error" role="alert">{error}</p> : null}
              <button type="submit" className="public-primary-button" disabled={loading || !catalog?.variants || !!catalog?.requiresStoreSelection}>{loading ? "Carregando uniformes…" : "Continuar"}<ArrowRight size={18} aria-hidden="true" /></button>
              <p className="privacy-note"><ShieldCheck size={16} aria-hidden="true" /> Seus dados identificam você nesta solicitação.</p>
            </form>
            <details className="request-help"><summary><HelpCircle size={17} aria-hidden="true" /> Precisa de ajuda com seu LDAP?<ChevronDown size={16} aria-hidden="true" /></summary><p>Use sua identificação de colaborador com 8 números. Se não souber seu LDAP, consulte a equipe responsável da sua loja antes de continuar.</p></details>
          </section>
        </div> : null}

        {step === "catalog" ? <>
          <div className="request-stage-title">
            <div><span className="request-eyebrow">02 / SEUS UNIFORMES</span><h1 ref={stageHeading} tabIndex={-1}>Escolha o que vai com você.</h1><p>Selecione a peça, confira o tamanho e adicione ao seu pedido.</p></div>
            <button type="button" className="public-back-button" disabled={saving} onClick={() => { setError(""); setStep("identity"); }}><ArrowLeft size={16} aria-hidden="true" /> Editar meus dados</button>
          </div>
          <div className="request-catalog-layout">
            <section className="request-catalog-panel" aria-label="Catálogo de uniformes">
              <div className="request-section-heading"><span className="request-section-icon"><Shirt size={21} aria-hidden="true" /></span><div><h2>Encontre seu uniforme</h2><p>As opções são exibidas conforme a disponibilidade da loja.</p></div></div>
              {loading ? <div className="catalog-message">Carregando disponibilidade…</div> : catalog?.variants?.length ? <UniformSelector sectors={catalog.sectors} variants={catalog.variants} quantities={quantities} limit={PUBLIC_ITEM_LIMIT} disabled={saving} onAdd={variant => updateQuantity(variant, (quantities[variant.id] ?? 0) + 1)} /> : <div className="request-empty-catalog"><Shirt size={40} aria-hidden="true" /><h3>Nenhuma peça disponível por enquanto</h3><p>Consulte a equipe da loja sobre a reposição dos uniformes.</p></div>}
              <div className="request-info-note"><ClipboardCheck size={19} aria-hidden="true" /><p>Até <strong>{PUBLIC_ITEM_LIMIT} unidades por item</strong>. Antes de enviar, confira os tamanhos e as quantidades no resumo.</p></div>
            </section>
            <aside className="request-order-summary" aria-label="Resumo da solicitação">
              <div className="request-summary-heading"><h2>Seu pedido</h2><span aria-label={selectedCount + " peças selecionadas"}>{String(selectedCount).padStart(2, "0")}</span></div>
              <div className="request-person"><UserRound size={19} aria-hidden="true" /><div><strong>{name}</strong><small>LDAP {ldap}</small></div></div>
              {selectedCount > 0 ? <section className="request-basket" aria-label="Itens do seu pedido">
                <div className="public-variant-list">{Object.entries(quantities).map(([id, quantity]) => {
                  const variant = chosenVariants[id];
                  const available = catalog?.variants?.some(item => item.id === id);
                  return <article className="public-variant" key={id}>
                    <UniformPhoto imageId={variant.imageId} name={variant.name} large />
                    <div className="public-variant-details"><strong>Tam. {variant.size} · {variant.name}</strong><span>{[uniformGenderLabel(variant.gender), variant.color].filter(Boolean).join(" · ")}</span>
                      {!available ? <small role="status">Indisponível. Remova este item para continuar.</small> : null}
                      <div className="quantity-control"><button type="button" onClick={() => updateQuantity(variant, quantity - 1)} aria-label={"Remover uma unidade de " + variant.name + " tamanho " + variant.size} disabled={saving}><Minus size={15} /></button><span>{quantity}</span><button type="button" onClick={() => updateQuantity(variant, quantity + 1)} aria-label={"Adicionar uma unidade de " + variant.name + " tamanho " + variant.size} disabled={saving || !available || quantity >= PUBLIC_ITEM_LIMIT}><Plus size={15} /></button></div>
                    </div>
                  </article>;
                })}</div>
                <div className="request-total"><span>Total de peças</span><strong>{selectedCount}</strong></div>
              </section> : <div className="request-empty-basket"><ShoppingBag size={32} strokeWidth={1.3} aria-hidden="true" /><strong>Seu pedido começa aqui</strong><p>Adicione os uniformes ao lado.<br />Eles aparecerão neste resumo.</p></div>}
              {error ? <p className="public-error" role="alert">{error}</p> : null}
              <button type="button" className="public-primary-button" onClick={() => void submitRequest()} disabled={saving || loading || selectedCount === 0 || hasUnavailable}>{saving ? "Enviando…" : "Enviar solicitação" + (selectedCount ? " · " + selectedCount + (selectedCount === 1 ? " peça" : " peças") : "")}<ArrowRight size={17} aria-hidden="true" /></button>
              <p className="request-approval-note"><Clock3 size={14} aria-hidden="true" /> O pedido será enviado para aprovação da loja.</p>
            </aside>
          </div>
        </> : null}

        {step === "complete" ? <section className="request-complete" aria-labelledby="complete-title">
          <span className="complete-mark"><Check size={34} aria-hidden="true" /></span>
          <span className="request-eyebrow">TUDO CERTO POR AQUI</span>
          <h1 id="complete-title" ref={stageHeading} tabIndex={-1}>{preview ? "Assim ficará a confirmação." : "Solicitação enviada!"}</h1>
          <p>{preview ? "Esta é uma simulação. Nenhum pedido foi registrado." : "Seu pedido foi encaminhado para a equipe da loja. Guarde o código abaixo para consultar sua solicitação."}</p>
          <div className="request-code"><small>CÓDIGO DA SOLICITAÇÃO</small><strong>{code}</strong><button type="button" onClick={() => void copyCode()}><Copy size={16} aria-hidden="true" /> Copiar código</button><span aria-live="polite">{copyMessage}</span></div>
          <dl className="request-receipt"><div><dt>Colaborador</dt><dd>{name}<small>LDAP {ldap}</small></dd></div><div><dt>Loja</dt><dd>{catalog?.storeName ?? "Sua loja"}</dd></div><div><dt>Total solicitado</dt><dd>{selectedCount} {selectedCount === 1 ? "peça" : "peças"}</dd></div><div><dt>Status</dt><dd className="receipt-status"><Clock3 size={14} aria-hidden="true" /> {preview ? "Aprovação (simulação)" : "Aguardando aprovação"}</dd></div></dl>
          <div className="request-next-steps"><ClipboardCheck size={21} aria-hidden="true" /><div><strong>E agora?</strong><p>A equipe da loja analisará seu pedido. Consulte os responsáveis sobre a aprovação e a retirada das peças.</p></div></div>
          <a href={requestUrl + (storeCode ? "?loja=" + encodeURIComponent(storeCode) : "")} className="public-back-button"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao início</a>
        </section> : null}

        {step === "identity" ? <section className="request-how-it-works" aria-label="Como funciona"><div><UserRound size={20} aria-hidden="true" /><span><strong>Identifique-se</strong><small>Seu LDAP e nome, sem senha.</small></span></div><div><Shirt size={20} aria-hidden="true" /><span><strong>Escolha suas peças</strong><small>Modelos e tamanhos para sua rotina.</small></span></div><div><ClipboardCheck size={20} aria-hidden="true" /><span><strong>Envie para aprovação</strong><small>A equipe da loja cuida do próximo passo.</small></span></div></section> : null}
        <footer className="public-request-footer"><span><strong>LEROY MERLIN</strong><span>Portal de uniformes · Uso interno</span></span><span>Dúvidas? Fale com a equipe da sua loja.</span></footer>
      </main>
    </div>
  );
}

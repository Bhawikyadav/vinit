"use client";

import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { controlBase } from "@/components/ui/controls";
import FitToWidth from "@/components/FitToWidth";
import InvoicePreview from "@/components/InvoicePreview";
import QuotePreview from "@/components/QuotePreview";
import { DEFAULT_PROFILE, VM_PROFILE } from "@/lib/company";
import { computeBill } from "@/lib/gst";
import { computeQuote } from "@/lib/quote";
import { STATES, stateName } from "@/lib/states";
import { getProfile, saveProfile, isCloud } from "@/lib/storage";
import { TEMPLATE_LIST } from "@/lib/templates";
import { NAME_SIZES, NAME_WEIGHTS } from "@/lib/nameStyle";
import {
  emptyParty,
  type Bill,
  type CompanyProfile,
  type InvoiceDisplay,
  type NameStyle,
  type Quote,
  type QuoteDisplay,
  type TemplateId,
} from "@/lib/types";

const ACCENT_PRESETS = ["#c0392b", "#1d4ed8", "#047857", "#7c3aed", "#ea580c", "#0f766e", "#b45309", "#111827"];

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={controlBase} />
    </label>
  );
}

// A labelled show/hide checkbox used for the per-document template toggles.
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-hair p-2 transition-colors hover:bg-surface-2 sm:gap-2.5 sm:p-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-accent" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink sm:text-sm">{label}</span>
        {hint ? <span className="hidden text-xs text-muted sm:block">{hint}</span> : null}
      </span>
    </label>
  );
}

// Downscale an uploaded image to keep storage small; PNG preserves transparency.
function resizeImage(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function sampleBill(profile: CompanyProfile): Bill {
  return {
    id: "sample",
    invoiceNo: `${profile.invoicePrefix}/2026-27/001`,
    invoiceDate: "2026-10-24",
    deliveryNote: "",
    placeOfSupplyCode: profile.stateCode,
    paymentTerms: "15 Days",
    dueDate: "",
    billTo: { name: "Acme Traders", address: "12 MG Road, Jaipur", gstin: "08AACCA1234A1Z5", stateCode: profile.stateCode },
    shipTo: emptyParty(),
    shipSameAsBill: true,
    items: [
      { id: "1", description: "Sample product", hsnSac: "0000", qty: 2, unit: "Nos", rate: 1800, discount: 0, gstRate: 18 },
      { id: "2", description: "Annual Maintenance (AMC)", hsnSac: "9987", qty: 1, unit: "Service", rate: 1200, discount: 200, gstRate: 18 },
    ],
    manualRoundOff: false,
    roundOff: 0,
    createdAt: "",
    updatedAt: "",
  };
}

function sampleQuote(profile: CompanyProfile): Quote {
  return {
    id: "sample",
    quoteNo: `${profile.invoicePrefix}/Q/2026-27/001`,
    quoteDate: "2026-10-24",
    validUntil: "",
    subject: "Quotation cum Proposal",
    heading: "Financial Costing for the below items:",
    buyerName: "Acme Traders",
    buyerAddress: "12 MG Road, Jaipur",
    items: [
      { id: "1", productName: "Sample item A", qty: "10", unit: "Nos", rate: "750", amount: 7500 },
      { id: "2", productName: "Sample item B", qty: "5", unit: "Nos", rate: "1200", amount: 6000 },
    ],
    freight: 0,
    gstPercent: 18,
    terms: "GST @ 18% extra on the above amount.\nBill on actual basis on the above rates.",
    createdAt: "",
    updatedAt: "",
  };
}

type DocTab = "invoice" | "quote";

// Company-name typography controls for one document (invoice or quotation).
// Size and weight default to the chosen template's own styling; italic is off.
function NameStyleControls({
  value,
  sampleName,
  onChange,
}: {
  value: NameStyle;
  sampleName: string;
  onChange: (p: Partial<NameStyle>) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-ink">Company name</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Font size</span>
          <select className={controlBase} value={value.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })}>
            <option value={0}>Template default</option>
            {NAME_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Weight</span>
          <select className={controlBase} value={value.fontWeight} onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}>
            {NAME_WEIGHTS.map(([w, l]) => (
              <option key={w} value={w}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Style</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-hair bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-2">
            <input type="checkbox" checked={value.italic} onChange={(e) => onChange({ italic: e.target.checked })} className="accent-accent" />
            <span className="italic">Italic</span>
          </label>
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-muted">
        Preview:{" "}
        <span className="text-ink" style={{ fontWeight: value.fontWeight || 700, fontStyle: value.italic ? "italic" : "normal" }}>
          {sampleName || "Your company name"}
        </span>
      </p>
    </div>
  );
}

// Section card — the one container style every settings block shares.
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
      <h2 className="font-semibold text-ink">{title}</h2>
      {hint ? <p className="mb-3 mt-1 text-xs text-muted">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [docTab, setDocTab] = useState<DocTab>("invoice");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getProfile().then((p) => active && setProfile(p));
    return () => {
      active = false;
    };
  }, []);

  if (!profile) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const patch = (p: Partial<CompanyProfile>) => setProfile({ ...profile, ...p });
  const patchBank = (p: Partial<CompanyProfile["bank"]>) =>
    setProfile({ ...profile, bank: { ...profile.bank, ...p } });
  const patchInvoice = (p: Partial<InvoiceDisplay>) =>
    setProfile({ ...profile, invoice: { ...profile.invoice, ...p } });
  const patchQuote = (p: Partial<QuoteDisplay>) =>
    setProfile({ ...profile, quote: { ...profile.quote, ...p } });
  const patchInvoiceName = (p: Partial<NameStyle>) =>
    setProfile({ ...profile, invoice: { ...profile.invoice, name: { ...profile.invoice.name, ...p } } });
  const patchQuoteName = (p: Partial<NameStyle>) =>
    setProfile({ ...profile, quote: { ...profile.quote, name: { ...profile.quote.name, ...p } } });

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      patch({ logo: dataUrl });
      setStatus("Logo loaded — remember to Save.");
    } catch (err) {
      setStatus("✕ " + (err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSignature(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 500);
      patch({ signature: dataUrl });
      setStatus("Signature loaded — remember to Save.");
    } catch (err) {
      setStatus("✕ " + (err as Error).message);
    }
    if (sigRef.current) sigRef.current.value = "";
  }

  function addUnit() {
    const u = newUnit.trim();
    if (!u) return;
    if (!profile!.units.some((x) => x.toLowerCase() === u.toLowerCase())) {
      patch({ units: [...profile!.units, u] });
    }
    setNewUnit("");
  }

  function removeUnit(u: string) {
    patch({ units: profile!.units.filter((x) => x !== u) });
  }

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      await saveProfile({ ...profile!, stateName: stateName(profile!.stateCode) || profile!.stateName });
      setStatus("✓ Saved" + (isCloud() ? " to cloud" : " on this device"));
    } catch (e) {
      setStatus("✕ " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function resetDefaults() {
    if (confirm("Reset all company details, logo and templates to blank? This clears your company profile.")) {
      setProfile({ ...DEFAULT_PROFILE });
      setStatus("Reset to blank — remember to Save.");
    }
  }

  // One-click restore of VM Enterprises' real details, for the original owner
  // only (NEXT_PUBLIC_VM_OWNER=1). Hidden for every other company so VM's
  // details never leak into another tenant's Settings.
  function loadVmPreset() {
    if (
      confirm(
        "Load VM Enterprises' saved details into this company profile? This replaces the form — remember to Save.",
      )
    ) {
      setProfile({
        ...VM_PROFILE,
        bank: { ...VM_PROFILE.bank },
        units: [...VM_PROFILE.units],
        invoice: { ...VM_PROFILE.invoice },
        quote: { ...VM_PROFILE.quote },
      });
      setStatus("Loaded VM Enterprises details — remember to Save.");
    }
  }

  const sampleB = sampleBill(profile);
  const sampleQ = sampleQuote(profile);
  const statusTone = status.startsWith("✕") ? "text-neg" : status.startsWith("✓") ? "text-pos" : "text-muted";
  const presetCard = (active: boolean) =>
    `rounded-xl border p-3 text-left transition-colors ${
      active ? "border-accent bg-accent-weak ring-1 ring-accent" : "border-hair hover:bg-surface-2"
    }`;

  return (
    <>
      <PageHeader
        title="Company profile"
        subtitle="Templates & defaults"
        actions={
          <>
            {process.env.NEXT_PUBLIC_VM_OWNER === "1" && (
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={loadVmPreset}>
                Load VM details
              </Button>
            )}
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={resetDefaults}>
              Reset
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {status && <p className={`-mt-1 mb-4 text-sm ${statusTone}`}>{status}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- FORM ---------- */}
        <div className="min-w-0 space-y-5">
          {/* =========================================================
               PER-DOCUMENT TEMPLATES — tabs for Invoice vs Quotation
             ========================================================= */}
          <section className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
            <h2 className="mb-1 font-semibold text-ink">Templates</h2>
            <p className="mb-3 text-xs text-muted">
              Pick what each document shows. Company details, bank details, logo, stamp and brand colour are common
              and set once below.
            </p>

            {/* Tabs */}
            <div className="mb-4 inline-flex rounded-xl border border-hair bg-surface-2 p-1">
              {(
                [
                  ["invoice", "Invoice / Bill"],
                  ["quote", "Quotation"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setDocTab(id)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                    docTab === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {docTab === "invoice" ? (
              <div className="space-y-4">
                {/* Invoice template presets */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Invoice layout</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {TEMPLATE_LIST.map((t) => (
                      <button key={t.id} onClick={() => patch({ template: t.id as TemplateId })} className={presetCard(profile.template === t.id)}>
                        <div className="text-sm font-semibold text-ink">{t.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Invoice company-name styling */}
                <NameStyleControls value={profile.invoice.name} sampleName={profile.name} onChange={patchInvoiceName} />

                {/* Invoice show / hide */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Show on the invoice</h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                    <Toggle label="Unit column" checked={profile.invoice.showUnit} onChange={(v) => patchInvoice({ showUnit: v })} />
                    <Toggle label="Discount column" checked={profile.invoice.showDiscount} onChange={(v) => patchInvoice({ showDiscount: v })} />
                    <Toggle
                      label="Signature / Stamp"
                      hint="The uploaded image above “Authorised Signatory”"
                      checked={profile.invoice.showSignature}
                      onChange={(v) => patchInvoice({ showSignature: v })}
                    />
                    <Toggle label="Bank details" checked={profile.invoice.showBankDetails} onChange={(v) => patchInvoice({ showBankDetails: v })} />
                    <Toggle label="Declaration" checked={profile.invoice.showDeclaration} onChange={(v) => patchInvoice({ showDeclaration: v })} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quotation template presets — chosen independently of the invoice */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Quotation layout</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {TEMPLATE_LIST.map((t) => (
                      <button key={t.id} onClick={() => patch({ quoteTemplate: t.id as TemplateId })} className={presetCard(profile.quoteTemplate === t.id)}>
                        <div className="text-sm font-semibold text-ink">{t.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">{t.description}</div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    A quotation isn’t a GST tax invoice, so it has no discount or tax column. Brand colour, logo and company
                    details are shared with the invoice.
                  </p>
                </div>

                {/* Quotation company-name styling */}
                <NameStyleControls value={profile.quote.name} sampleName={profile.name} onChange={patchQuoteName} />

                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Show on the quotation</h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                    <Toggle label="Unit column" checked={profile.quote.showUnit} onChange={(v) => patchQuote({ showUnit: v })} />
                    <Toggle
                      label="Total amount"
                      hint="The grand total row at the foot of the table"
                      checked={profile.quote.showTotal}
                      onChange={(v) => patchQuote({ showTotal: v })}
                    />
                    <Toggle
                      label="Signature / Stamp"
                      hint="The uploaded image above “Authorised Signatory”"
                      checked={profile.quote.showSignature}
                      onChange={(v) => patchQuote({ showSignature: v })}
                    />
                    <Toggle
                      label="Bank details"
                      hint="Off by default — turn on to print your bank info on quotes"
                      checked={profile.quote.showBankDetails}
                      onChange={(v) => patchQuote({ showBankDetails: v })}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* =========================================================
               COMMON DETAILS — shared by the invoice and the quotation
             ========================================================= */}
          <div className="flex items-center gap-3 pt-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-faint">Common details · shown on both</h2>
            <div className="h-px flex-1 bg-hair" />
          </div>

          {/* Logo */}
          <Section title="Logo">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-hair bg-surface-2">
                {profile.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-faint">No logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Upload logo</Button>
                  {profile.logo && (
                    <Button variant="danger" size="sm" onClick={() => patch({ logo: "" })}>Remove</Button>
                  )}
                </div>
                <p className="text-xs text-muted">PNG with transparent background works best. Auto-resized to keep files small.</p>
              </div>
            </div>
          </Section>

          {/* Signature / Stamp */}
          <Section title="Signature / Stamp" hint="Uploaded once here. Use the tabs above to show or hide it on the invoice and the quotation.">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-hair bg-surface-2">
                {profile.signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.signature} alt="Signature" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-faint">No signature</span>
                )}
              </div>
              <div className="space-y-2">
                <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={onSignature} />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => sigRef.current?.click()}>Upload signature / stamp</Button>
                  {profile.signature && (
                    <Button variant="danger" size="sm" onClick={() => patch({ signature: "" })}>Remove</Button>
                  )}
                </div>
                <p className="text-xs text-muted">
                  A photo of your signature or rubber stamp — shows above “Authorised Signatory”. Transparent PNG looks cleanest.
                </p>
              </div>
            </div>
          </Section>

          {/* Brand colour */}
          <Section title="Brand colour" hint="Accent used on both the invoice and the quotation.">
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => patch({ accentColor: c })}
                  title={c}
                  className={`h-7 w-7 rounded-full border-2 shadow-sm ${profile.accentColor.toLowerCase() === c ? "border-ink" : "border-surface"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={profile.accentColor}
                onChange={(e) => patch({ accentColor: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded-lg border border-hair"
                title="Custom colour"
              />
            </div>
          </Section>

          {/* Company details */}
          <Section title="Company details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Text label="Company Name" value={profile.name} onChange={(v) => patch({ name: v })} />
              <Text label="Tagline" value={profile.tagline} onChange={(v) => patch({ tagline: v })} />
              <Text label="Proprietor" value={profile.proprietor} onChange={(v) => patch({ proprietor: v })} />
              <Text label="GSTIN" value={profile.gstin} onChange={(v) => patch({ gstin: v.toUpperCase() })} />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">State (supplier)</span>
                <select value={profile.stateCode} onChange={(e) => patch({ stateCode: e.target.value, stateName: stateName(e.target.value) })} className={controlBase}>
                  {STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </label>
              <Text label="Invoice No. Prefix" value={profile.invoicePrefix} onChange={(v) => patch({ invoicePrefix: v })} />
              <div className="sm:col-span-2">
                <Text label="Registered Office" value={profile.regOffice} onChange={(v) => patch({ regOffice: v })} />
              </div>
              <div className="sm:col-span-2">
                <Text label="Branch Office (optional)" value={profile.branchOffice} onChange={(v) => patch({ branchOffice: v })} />
              </div>
              <Text label="Phone" value={profile.phone} onChange={(v) => patch({ phone: v })} />
              <Text label="Email" value={profile.email} onChange={(v) => patch({ email: v })} />
            </div>
          </Section>

          {/* Bank details */}
          <Section title="Bank details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Text label="Bank Name" value={profile.bank.name} onChange={(v) => patchBank({ name: v })} />
              <Text label="Branch" value={profile.bank.branch} onChange={(v) => patchBank({ branch: v })} />
              <Text label="Account No." value={profile.bank.accountNo} onChange={(v) => patchBank({ accountNo: v })} />
              <Text label="IFSC" value={profile.bank.ifsc} onChange={(v) => patchBank({ ifsc: v.toUpperCase() })} />
            </div>
            <div className="mt-3">
              <Text label="Declaration" value={profile.declaration} onChange={(v) => patch({ declaration: v })} />
            </div>
          </Section>

          {/* Item units */}
          <Section title="Item units" hint="Options in the Unit dropdown when adding items (Nos, Mtr, Pcs, Ltr, Kg…).">
            <div className="mb-2 flex flex-wrap gap-2">
              {profile.units.length === 0 && <span className="text-xs text-faint">No units yet</span>}
              {profile.units.map((u) => (
                <span key={u} className="inline-flex items-center gap-1 rounded-full border border-hair bg-surface-2 px-2 py-0.5 text-xs text-ink">
                  {u}
                  <button onClick={() => removeUnit(u)} className="text-faint hover:text-neg" title={`Remove ${u}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUnit();
                  }
                }}
                placeholder="Add a unit, e.g. Meter"
                className={`${controlBase} max-w-[200px]`}
              />
              <Button variant="secondary" size="sm" onClick={addUnit}>Add</Button>
            </div>
          </Section>
        </div>

        {/* ---------- LIVE PREVIEW ---------- */}
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs text-muted">
            Live preview — {docTab === "invoice" ? "Invoice" : "Quotation"} (sample data), scaled to fit
          </p>
          <FitToWidth>
            {docTab === "invoice" ? (
              <InvoicePreview bill={sampleB} totals={computeBill(sampleB, profile.stateCode)} profile={profile} />
            ) : (
              <QuotePreview quote={sampleQ} totals={computeQuote(sampleQ)} profile={profile} />
            )}
          </FitToWidth>
        </div>
      </div>
    </>
  );
}

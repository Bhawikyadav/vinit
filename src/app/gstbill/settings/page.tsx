"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppBar from "@/components/AppBar";
import FitToWidth from "@/components/FitToWidth";
import InvoicePreview from "@/components/InvoicePreview";
import { DEFAULT_PROFILE } from "@/lib/company";
import { computeBill } from "@/lib/gst";
import { STATES, stateName } from "@/lib/states";
import { getProfile, saveProfile, isCloud } from "@/lib/storage";
import { TEMPLATE_LIST } from "@/lib/templates";
import { emptyParty, type Bill, type CompanyProfile, type TemplateId } from "@/lib/types";

const ACCENT_PRESETS = ["#c0392b", "#1d4ed8", "#047857", "#7c3aed", "#ea580c", "#0f766e", "#b45309", "#111827"];

const inputCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500";

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
      <span className="mb-0.5 block text-xs font-medium text-gray-600">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
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
      { id: "1", description: "Fire Extinguisher ABC 6kg", hsnSac: "8424", qty: 2, unit: "Nos", rate: 1800, discount: 0, gstRate: 18 },
      { id: "2", description: "Annual Maintenance (AMC)", hsnSac: "9987", qty: 1, unit: "Service", rate: 1200, discount: 200, gstRate: 18 },
    ],
    manualRoundOff: false,
    roundOff: 0,
    createdAt: "",
    updatedAt: "",
  };
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
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

  if (!profile) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  const patch = (p: Partial<CompanyProfile>) => setProfile({ ...profile, ...p });
  const patchBank = (p: Partial<CompanyProfile["bank"]>) =>
    setProfile({ ...profile, bank: { ...profile.bank, ...p } });

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
    if (confirm("Reset all company details, logo and template to the original defaults?")) {
      setProfile({ ...DEFAULT_PROFILE });
      setStatus("Reset to defaults — remember to Save.");
    }
  }

  const btn =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 transition-colors";
  const sample = sampleBill(profile);

  return (
    <div className="min-h-screen">
      <AppBar
        title="Company Profile"
        subtitle={isCloud() ? "Template & defaults · ☁ Cloud sync on" : "Template & defaults · saved on this device"}
        status={status || undefined}
        actions={
          <>
            <button className={`${btn} bg-gray-100 text-gray-600 hover:bg-gray-200`} onClick={resetDefaults}>
              Reset
            </button>
            <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} onClick={save} disabled={busy}>
              Save
            </button>
            <Link href="/gstbill" className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
              New Bill
            </Link>
            <Link href="/gstbill/history" className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
              All Bills
            </Link>
          </>
        }
      />

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        {/* ---------- FORM ---------- */}
        <div className="min-w-0 space-y-5">
          {/* Logo */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Logo</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                {profile.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                <button className={`${btn} bg-gray-800 text-white hover:bg-black`} onClick={() => fileRef.current?.click()}>
                  Upload Logo
                </button>
                {profile.logo && (
                  <button className={`${btn} ml-2 bg-gray-100 text-red-600 hover:bg-gray-200`} onClick={() => patch({ logo: "" })}>
                    Remove
                  </button>
                )}
                <p className="text-xs text-gray-500">PNG with transparent background works best. Auto-resized to keep files small.</p>
              </div>
            </div>
          </section>

          {/* Signature / Stamp */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Signature / Stamp</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded border border-dashed border-gray-300 bg-gray-50">
                {profile.signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.signature} alt="Signature" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400">No signature</span>
                )}
              </div>
              <div className="space-y-2">
                <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={onSignature} />
                <button className={`${btn} bg-gray-800 text-white hover:bg-black`} onClick={() => sigRef.current?.click()}>
                  Upload Signature / Stamp
                </button>
                {profile.signature && (
                  <button className={`${btn} ml-2 bg-gray-100 text-red-600 hover:bg-gray-200`} onClick={() => patch({ signature: "" })}>
                    Remove
                  </button>
                )}
                <p className="text-xs text-gray-500">
                  A photo of your signature or rubber stamp — shows above “Authorised Signatory”. Transparent PNG looks cleanest.
                </p>
              </div>
            </div>
          </section>

          {/* Template */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Default Template</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATE_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => patch({ template: t.id as TemplateId })}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    profile.template === t.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold text-gray-800">{t.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{t.description}</div>
                </button>
              ))}
            </div>

            <h3 className="mb-2 mt-4 text-sm font-medium text-gray-700">Accent Colour</h3>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => patch({ accentColor: c })}
                  title={c}
                  className={`h-7 w-7 rounded-full border-2 ${profile.accentColor.toLowerCase() === c ? "border-gray-800" : "border-white"} shadow`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={profile.accentColor}
                onChange={(e) => patch({ accentColor: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-gray-300"
                title="Custom colour"
              />
            </div>
          </section>

          {/* Invoice options */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Invoice Options</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={profile.showUnit} onChange={(e) => patch({ showUnit: e.target.checked })} />
                Show the <span className="font-medium">Unit</span> column
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={profile.showDiscount} onChange={(e) => patch({ showDiscount: e.target.checked })} />
                Show the <span className="font-medium">Discount</span> column
              </label>
            </div>

            <h3 className="mb-1 mt-4 text-sm font-medium text-gray-700">Units</h3>
            <p className="mb-2 text-xs text-gray-500">
              Options in the Unit dropdown when adding items (Nos, Mtr, Pcs, Ltr, Kg…).
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {profile.units.length === 0 && <span className="text-xs text-gray-400">No units yet</span>}
              {profile.units.map((u) => (
                <span key={u} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs">
                  {u}
                  <button onClick={() => removeUnit(u)} className="text-gray-400 hover:text-red-600" title={`Remove ${u}`}>
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
                className={`${inputCls} max-w-[200px]`}
              />
              <button className={`${btn} bg-gray-800 text-white hover:bg-black`} onClick={addUnit}>
                Add
              </button>
            </div>
          </section>

          {/* Company details */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Company Details</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Text label="Company Name" value={profile.name} onChange={(v) => patch({ name: v })} />
              <Text label="Tagline" value={profile.tagline} onChange={(v) => patch({ tagline: v })} />
              <Text label="Proprietor" value={profile.proprietor} onChange={(v) => patch({ proprietor: v })} />
              <Text label="GSTIN" value={profile.gstin} onChange={(v) => patch({ gstin: v.toUpperCase() })} />
              <label className="block">
                <span className="mb-0.5 block text-xs font-medium text-gray-600">State (supplier)</span>
                <select value={profile.stateCode} onChange={(e) => patch({ stateCode: e.target.value, stateName: stateName(e.target.value) })} className={inputCls}>
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
          </section>

          {/* Bank details */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Bank Details</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Text label="Bank Name" value={profile.bank.name} onChange={(v) => patchBank({ name: v })} />
              <Text label="Branch" value={profile.bank.branch} onChange={(v) => patchBank({ branch: v })} />
              <Text label="Account No." value={profile.bank.accountNo} onChange={(v) => patchBank({ accountNo: v })} />
              <Text label="IFSC" value={profile.bank.ifsc} onChange={(v) => patchBank({ ifsc: v.toUpperCase() })} />
            </div>
            <div className="mt-3">
              <Text label="Declaration" value={profile.declaration} onChange={(v) => patch({ declaration: v })} />
            </div>
          </section>
        </div>

        {/* ---------- LIVE PREVIEW ---------- */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs text-gray-500">Live preview (sample data) — scaled to fit</p>
          <FitToWidth>
            <InvoicePreview bill={sample} totals={computeBill(sample)} profile={profile} />
          </FitToWidth>
        </div>
      </div>
    </div>
  );
}

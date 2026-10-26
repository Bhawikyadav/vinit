import Link from "next/link";
import { COMPANY } from "@/lib/company";
import UserBar from "@/components/UserBar";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-5 sm:gap-8 sm:p-6">
      <UserBar />
      <div>
        <h1 className="text-2xl font-bold text-red-700 sm:text-3xl">{COMPANY.name}</h1>
        <p className="text-sm text-gray-600 sm:text-base">{COMPANY.tagline} · Billing &amp; Quotations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/gstbill"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md active:bg-gray-50 sm:p-6"
        >
          <div className="text-lg font-semibold text-gray-800">+ New Bill</div>
          <p className="mt-1 text-sm text-gray-500">
            Create a GST tax invoice, preview it, and save as PDF.
          </p>
        </Link>
        <Link
          href="/gstbill/history"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md active:bg-gray-50 sm:p-6"
        >
          <div className="text-lg font-semibold text-gray-800">All Bills</div>
          <p className="mt-1 text-sm text-gray-500">
            View, search, re-download, and back up every bill you&apos;ve cut.
          </p>
        </Link>
        <Link
          href="/quotation"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md active:bg-gray-50 sm:p-6"
        >
          <div className="text-lg font-semibold text-gray-800">+ New Quotation</div>
          <p className="mt-1 text-sm text-gray-500">
            Quote prices without GST — GST is noted as extra. Convert to an invoice in one click.
          </p>
        </Link>
        <Link
          href="/quotation/history"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md active:bg-gray-50 sm:p-6"
        >
          <div className="text-lg font-semibold text-gray-800">All Quotations</div>
          <p className="mt-1 text-sm text-gray-500">
            View, search, re-download, and reuse every quotation you&apos;ve sent.
          </p>
        </Link>
        <Link
          href="/gstbill/settings"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md active:bg-gray-50 sm:p-6"
        >
          <div className="text-lg font-semibold text-gray-800">Company Profile</div>
          <p className="mt-1 text-sm text-gray-500">
            Edit company details, upload a logo, and choose your invoice template.
          </p>
        </Link>
      </div>

      <p className="text-xs text-gray-400">
        GSTIN {COMPANY.gstin} · {COMPANY.stateName}
      </p>
    </main>
  );
}

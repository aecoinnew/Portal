"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Save, X } from "lucide-react";
import { ActiveBadge, ProductTypeTag } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PendingApprovalBanner } from "@/components/ui/pending-approval-banner";
import { apiRequest } from "@/lib/api/client";
import type { ProductResponse, ProductsResponse, SettingsResponse } from "@/lib/types/api";
import type { PricingMode, Product, ProductType, SupportedCurrency } from "@/lib/types/domain";
import { formatDate, titleCase } from "@/lib/utils/format";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<ProductType>("fund");
  const [pricingMode, setPricingMode] = useState<PricingMode>("manual");
  const [currency, setCurrency] = useState<SupportedCurrency>("AED");
  const [isActive, setIsActive] = useState(true);
  const [allowUsd, setAllowUsd] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  async function load() {
    const [productsData, settingsData] = await Promise.all([
      apiRequest<ProductsResponse>("/products?includeInactive=true"),
      apiRequest<SettingsResponse>("/settings")
    ]);
    setProducts(productsData.products);
    setAllowUsd(settingsData.settings.allowUsd);
    setCurrency((current) => (current === "USD" && !settingsData.settings.allowUsd ? "AED" : current));
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load products"))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setName("");
    setSymbol("");
    setType("fund");
    setPricingMode("manual");
    setCurrency("AED");
    setIsActive(true);
    setEditingId(null);
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setSymbol(product.symbol ?? "");
    setType(product.type);
    setPricingMode(product.pricingMode);
    setCurrency(product.currency);
    setIsActive(product.isActive);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiRequest<ProductResponse & { pending?: boolean; approvalId?: string }>(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          symbol: symbol || null,
          type,
          pricingMode,
          currency,
          isActive
        })
      });
      if (data.pending && data.approvalId) {
        setPendingApprovalId(data.approvalId);
      } else {
        setPendingApprovalId(null);
        if (data.product) {
          setProducts((current) => {
            const next = editingId ? current.map((item) => (item.id === editingId ? data.product : item)) : [...current, data.product];
            return next.sort((a, b) => a.name.localeCompare(b.name));
          });
        }
      }
      resetForm();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to save product");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleProduct(product: Product) {
    try {
      const data = await apiRequest<ProductResponse & { pending?: boolean; approvalId?: string }>(`/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !product.isActive })
      });
      if (data.pending && data.approvalId) {
        setPendingApprovalId(data.approvalId);
      } else {
        setPendingApprovalId(null);
        if (data.product) {
          setProducts((current) => current.map((item) => (item.id === product.id ? data.product : item)));
        }
      }
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update product");
    }
  }

  if (loading) return <LoadingState label="Loading products" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Products</h1>
        <p className="mt-1 text-[13px] text-slate-500">Investment product catalog and pricing modes.</p>
      </div>

      {pendingApprovalId ? <PendingApprovalBanner approvalId={pendingApprovalId} /> : null}
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="card h-fit" onSubmit={saveProduct}>
          <div className="card-header">
            <div className="card-title">{editingId ? "Edit product" : "New product"}</div>
            {editingId ? (
              <button className="btn btn-secondary h-8 px-2" type="button" onClick={resetForm} title="Cancel edit">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="product-name">
                Name
              </label>
              <input id="product-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="product-symbol">
                Symbol
              </label>
              <input id="product-symbol" className="input" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="product-type">
                  Type
                </label>
                <select id="product-type" className="select" value={type} onChange={(event) => setType(event.target.value as ProductType)}>
                  <option value="stock">Stock</option>
                  <option value="crypto">Crypto</option>
                  <option value="fund">Fund</option>
                  <option value="sukuk">Sukuk</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="product-pricing">
                  Pricing
                </label>
                <select id="product-pricing" className="select" value={pricingMode} onChange={(event) => setPricingMode(event.target.value as PricingMode)}>
                  <option value="manual">Manual</option>
                  <option value="api">API</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="product-currency">
                Currency
              </label>
              <select id="product-currency" className="select" value={currency} onChange={(event) => setCurrency(event.target.value as SupportedCurrency)}>
                <option value="AED">AED</option>
                {allowUsd || currency === "USD" ? <option value="USD">USD</option> : null}
              </select>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3">
              <span className="text-[13px] font-medium text-slate-900">Active product</span>
              <input className="h-4 w-4 accent-navy-700" type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            </label>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {submitting ? "Saving" : editingId ? "Save product" : "Create product"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Product list</div>
          </div>
          {products.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Pricing</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{product.symbol ?? "-"}</div>
                      </td>
                      <td>
                        <ProductTypeTag type={product.type} />
                      </td>
                      <td>
                        <span className="tag bg-slate-100 text-slate-700">{titleCase(product.pricingMode)}</span>
                      </td>
                      <td>{product.currency}</td>
                      <td>
                        <ActiveBadge active={product.isActive} />
                      </td>
                      <td>{formatDate(product.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button className="text-[11px] font-medium text-navy-700 hover:underline" onClick={() => editProduct(product)}>
                            Edit
                          </button>
                          <button className="text-[11px] font-medium text-navy-700 hover:underline" onClick={() => void toggleProduct(product)}>
                            {product.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No products found" />
          )}
        </div>
      </section>
    </div>
  );
}

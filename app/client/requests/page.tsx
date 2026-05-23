"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle, Info, Send, XCircle } from "lucide-react";
import { ProductTypeTag, RequestStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { ProductsResponse, RequestResponse, RequestsResponse, SettingsResponse } from "@/lib/types/api";
import type { InvestmentRequest, Product, RequestType, SupportedCurrency } from "@/lib/types/domain";
import { formatDate, formatMoney, titleCase } from "@/lib/utils/format";

const TYPE_HINTS: Record<RequestType, string> = {
  buy: "Buy a specific instrument. Select the product and the AED/USD amount you want to invest.",
  sell: "Sell from an existing position. Select the product and the AED/USD amount you want to liquidate.",
  subscribe: "Subscribe to a fund or product offering. Select the product and the subscription amount.",
  withdraw: "Cash withdrawal from your account. No product needed; just specify the amount."
};

const PRODUCT_REQUIRED_TYPES: RequestType[] = ["buy", "sell", "subscribe"];

export default function ClientRequestsPage() {
  const [requests, setRequests] = useState<InvestmentRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [type, setType] = useState<RequestType>("buy");
  const [productId, setProductId] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("AED");
  const [allowUsd, setAllowUsd] = useState(true);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    const [requestData, productData, settingsData] = await Promise.all([
      apiRequest<RequestsResponse>("/requests"),
      apiRequest<ProductsResponse>("/products"),
      apiRequest<SettingsResponse>("/settings")
    ]);
    setRequests(requestData.requests);
    setProducts(productData.products);
    setAllowUsd(settingsData.settings.allowUsd);
    setCurrency(settingsData.settings.baseCurrency === "USD" && !settingsData.settings.allowUsd ? "AED" : settingsData.settings.baseCurrency);
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load requests"))
      .finally(() => setLoading(false));
  }, []);

  const productRequired = PRODUCT_REQUIRED_TYPES.includes(type);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validation
    if (productRequired && !productId) {
      setError(`A product must be selected for "${titleCase(type)}" requests.`);
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<RequestResponse>("/requests", {
        method: "POST",
        body: JSON.stringify({
          type,
          productId: productId || null,
          amount: amount ? Number(amount) : null,
          currency,
          message
        })
      });
      setRequests((current) => [data.request, ...current]);
      setProductId("");
      setAmount("");
      setMessage("");
      setSuccess(`Request submitted (ref ${data.request.id}). Our team will review it shortly.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading requests" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Requests</h1>
        <p className="mt-1 text-[13px] text-slate-500">Investment instructions and servicing requests.</p>
      </div>

      {/* Workflow context */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
        <div>
          <div className="font-medium text-slate-900">How requests work</div>
          <div className="mt-1 text-slate-600">
            Submitted requests enter our review workflow. They progress through{" "}
            <span className="font-medium">pending</span> &rarr;{" "}
            <span className="font-medium">approved</span> &rarr;{" "}
            <span className="font-medium">executed</span>, or may be{" "}
            <span className="font-medium">rejected</span> with a reason. You will see status changes here as they happen.
          </div>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{success}</div>
          <button className="ml-auto text-emerald-700 hover:underline" onClick={() => setSuccess(null)}>Dismiss</button>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form className="card h-fit" onSubmit={handleSubmit}>
          <div className="card-header">
            <div className="card-title">Submit request</div>
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="request-type">Type</label>
              <select id="request-type" className="select" value={type} onChange={(event) => setType(event.target.value as RequestType)}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="subscribe">Subscribe</option>
                <option value="withdraw">Withdraw cash</option>
              </select>
              <div className="mt-1 text-[11px] text-slate-500">{TYPE_HINTS[type]}</div>
            </div>
            <div>
              <label className="label" htmlFor="request-product">
                Product {productRequired ? <span className="text-rose-600">*</span> : <span className="text-slate-400">(optional)</span>}
              </label>
              <select
                id="request-product"
                className="select"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required={productRequired}
                disabled={type === "withdraw"}
              >
                <option value="">{type === "withdraw" ? "Not applicable" : "Select a product"}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="request-amount">Amount <span className="text-rose-600">*</span></label>
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <input
                  id="request-amount"
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
                <select className="select" value={currency} onChange={(event) => setCurrency(event.target.value as SupportedCurrency)} aria-label="Request currency">
                  <option value="AED">AED</option>
                  {allowUsd ? <option value="USD">USD</option> : null}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="request-message">Message <span className="text-slate-400">(optional)</span></label>
              <textarea
                id="request-message"
                className="textarea"
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Any context for the reviewing team..."
                maxLength={2000}
              />
              <div className="mt-1 text-[11px] text-slate-400">{message.length}/2000</div>
            </div>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              <Send className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Request history ({requests.length})</div>
          </div>
          {requests.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Product</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const product = products.find((item) => item.id === request.productId);
                    return (
                      <tr key={request.id}>
                        <td>
                          <span className="tag bg-navy-50 text-navy-700">{titleCase(request.type)}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span>{request.productName ?? "Cash"}</span>
                            {product ? <ProductTypeTag type={product.type} /> : null}
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{request.amount ? formatMoney(request.amount, request.currency) : "-"}</td>
                        <td><RequestStatusBadge status={request.status} /></td>
                        <td className="text-[11px] text-slate-500">{formatDate(request.createdAt)}</td>
                        <td className="max-w-[260px]">
                          {request.message ? (
                            <div className="text-[12px] text-slate-700">{request.message}</div>
                          ) : null}
                          {request.status === "rejected" && request.rejectionReason ? (
                            <div className="mt-1 flex items-start gap-1 text-[11px] text-rose-700">
                              <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span><span className="font-medium">Reason:</span> {request.rejectionReason}</span>
                            </div>
                          ) : null}
                          {!request.message && !(request.status === "rejected" && request.rejectionReason) ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No requests submitted yet" />
          )}
        </div>
      </section>
    </div>
  );
}

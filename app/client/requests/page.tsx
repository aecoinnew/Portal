"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { ProductTypeTag, RequestStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { ProductsResponse, RequestResponse, RequestsResponse, SettingsResponse } from "@/lib/types/api";
import type { InvestmentRequest, Product, RequestType, SupportedCurrency } from "@/lib/types/domain";
import { formatDate, formatMoney, titleCase } from "@/lib/utils/format";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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

      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="card h-fit" onSubmit={handleSubmit}>
          <div className="card-header">
            <div className="card-title">Submit request</div>
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="request-type">
                Type
              </label>
              <select id="request-type" className="select" value={type} onChange={(event) => setType(event.target.value as RequestType)}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="subscribe">Subscribe</option>
                <option value="withdraw">Withdraw</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="request-product">
                Product
              </label>
              <select id="request-product" className="select" value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">No product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="request-amount">
                Amount
              </label>
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <input
                  id="request-amount"
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount"
                />
                <select className="select" value={currency} onChange={(event) => setCurrency(event.target.value as SupportedCurrency)} aria-label="Request currency">
                  <option value="AED">AED</option>
                  {allowUsd ? <option value="USD">USD</option> : null}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="request-message">
                Message
              </label>
              <textarea id="request-message" className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              <Send className="h-4 w-4" />
              {submitting ? "Submitting" : "Submit request"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Request history</div>
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
                    <th>Message</th>
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
                        <td className="text-right">{request.amount ? formatMoney(request.amount, request.currency) : "-"}</td>
                        <td>
                          <RequestStatusBadge status={request.status} />
                        </td>
                        <td>{formatDate(request.createdAt)}</td>
                        <td className="max-w-[260px] truncate">{request.message || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No requests submitted" />
          )}
        </div>
      </section>
    </div>
  );
}

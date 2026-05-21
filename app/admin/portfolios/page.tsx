"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save, Trash2, X } from "lucide-react";
import { ProductTypeTag } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { AdminPosition, ClientsResponse, PositionsResponse, ProductsResponse } from "@/lib/types/api";
import type { ClientUser, Product } from "@/lib/types/domain";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils/format";

export default function AdminPortfoliosPage() {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [userId, setUserId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [clientsData, productsData, positionsData] = await Promise.all([
      apiRequest<ClientsResponse>("/clients"),
      apiRequest<ProductsResponse>("/products?includeInactive=true"),
      apiRequest<PositionsResponse>("/portfolio/positions")
    ]);
    setClients(clientsData.clients);
    setProducts(productsData.products);
    setPositions(positionsData.positions);
    setUserId((current) => current || clientsData.clients[0]?.id || "");
    setProductId((current) => current || productsData.products[0]?.id || "");
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load portfolios"))
      .finally(() => setLoading(false));
  }, []);

  async function savePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest(editingPositionId ? `/portfolio/positions/${editingPositionId}` : "/portfolio/positions", {
        method: editingPositionId ? "PATCH" : "POST",
        body: JSON.stringify({
          userId,
          productId,
          quantity: Number(quantity),
          avgPrice: Number(avgPrice)
        })
      });
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save position");
    } finally {
      setSubmitting(false);
    }
  }

  async function removePosition(position: AdminPosition) {
    await apiRequest(`/portfolio/positions/${position.id}`, { method: "DELETE" });
    setPositions((current) => current.filter((item) => item.id !== position.id));
  }

  function editPosition(position: AdminPosition) {
    setEditingPositionId(position.id);
    setUserId(position.userId);
    setProductId(position.productId);
    setQuantity(String(position.quantity));
    setAvgPrice(String(position.avgPrice));
  }

  function resetForm() {
    setEditingPositionId(null);
    setQuantity("");
    setAvgPrice("");
  }

  if (loading) return <LoadingState label="Loading portfolios" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Portfolios</h1>
        <p className="mt-1 text-[13px] text-slate-500">Client product positions and cost basis.</p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="card h-fit" onSubmit={savePosition}>
          <div className="card-header">
            <div className="card-title">{editingPositionId ? "Edit position" : "Position"}</div>
            {editingPositionId ? (
              <button className="btn btn-secondary h-8 px-2" type="button" onClick={resetForm} title="Cancel edit">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="position-client">
                Client
              </label>
              <select id="position-client" className="select" value={userId} onChange={(event) => setUserId(event.target.value)} required>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="position-product">
                Product
              </label>
              <select id="position-product" className="select" value={productId} onChange={(event) => setProductId(event.target.value)} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="position-quantity">
                  Quantity
                </label>
                <input id="position-quantity" className="input" type="number" min="0" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="position-avg">
                  Average price
                </label>
                <input id="position-avg" className="input" type="number" min="0" step="0.01" value={avgPrice} onChange={(event) => setAvgPrice(event.target.value)} required />
              </div>
            </div>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              <Save className="h-4 w-4" />
              {submitting ? "Saving" : "Save position"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">All positions</div>
          </div>
          {positions.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Average</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">P/L</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.id}>
                      <td className="font-medium text-slate-900">{position.clientName}</td>
                      <td>{position.productName}</td>
                      <td>
                        <ProductTypeTag type={position.type} />
                      </td>
                      <td className="text-right">{formatNumber(position.quantity, 4)}</td>
                      <td className="text-right">{formatMoney(position.avgPrice, position.currency)}</td>
                      <td className="text-right">{formatMoney(position.currentPrice ?? 0, position.currency)}</td>
                      <td className="text-right font-medium text-slate-900">{formatMoney(position.marketValue, position.currency)}</td>
                      <td className={position.unrealizedPnL >= 0 ? "gain text-right font-medium" : "loss text-right font-medium"}>
                        {formatMoney(position.unrealizedPnL, position.currency)}
                      </td>
                      <td>{formatDate(position.updatedAt)}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button className="text-[11px] font-medium text-navy-700 hover:underline" onClick={() => editPosition(position)}>
                            Edit
                          </button>
                          <button className="text-slate-500 hover:text-slate-800" onClick={() => void removePosition(position)} title="Remove position">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No positions found" />
          )}
        </div>
      </section>
    </div>
  );
}

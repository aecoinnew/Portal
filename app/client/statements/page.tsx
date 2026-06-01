"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { apiRequest, downloadFromApi } from "@/lib/api/client";
import type { StatementsResponse } from "@/lib/types/api";
import type { Statement } from "@/lib/types/domain";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { useI18n } from "@/contexts/i18n-context";

export default function ClientStatementsPage() {
  const { t } = useI18n();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<StatementsResponse>("/statements")
      .then((data) => setStatements(data.statements))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load statements"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading statements" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("stmt.title")}</h1>
        <p className="mt-1 text-[13px] text-slate-500">{t("stmt.subtitle")}</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{t("stmt.available")}</div>
        </div>
        {statements.length ? (
          <div className="divide-y divide-slate-100">
            {statements.map((statement) => (
              <div key={statement.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-900">{statement.period} {t("dash.statementSuffix")}</div>
                  <div className="text-[11px] text-slate-500">
                    {t("dash.issued")} {formatDate(statement.createdAt)} - {formatNumber(statement.fileSize / 1024, 1)} KB
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={() => downloadFromApi(`/statements/${statement.id}/download`, statement.fileName)}>
                  <Download className="h-4 w-4" />
                  {t("common.download")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t("stmt.none")} />
        )}
      </div>
    </div>
  );
}

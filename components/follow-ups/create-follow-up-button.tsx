"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DoctorProductRowDto, ProductCatalogDto, ProductSlotDto } from "@/lib/report/types";

type EditableProductRow = {
  id: string;
  title: string;
  slot: ProductSlotDto | null;
  productCatalogId: string | null;
  brand: string;
  company: string;
  productName: string;
};

const slotOptions: Array<{ value: ProductSlotDto | "custom"; label: string }> = [
  { value: "cleanser", label: "Cleanser / Facewash" },
  { value: "sunscreen", label: "Sunscreen" },
  { value: "moisturizer", label: "Moisturizer" },
  { value: "repair_serum", label: "Repair / Serum" },
  { value: "custom", label: "Custom heading" }
];

function createRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `follow-up-product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRows(rows: DoctorProductRowDto[]): EditableProductRow[] {
  return rows.map((row) => ({
    id: row.id || createRowId(),
    title: row.title || "",
    slot: row.slot,
    productCatalogId: row.productCatalogId,
    brand: row.brand ?? "",
    company: row.company ?? row.brand ?? "",
    productName: row.productName ?? ""
  }));
}

function rowLabel(row: Pick<EditableProductRow, "brand" | "productName">) {
  return [row.brand, row.productName].filter(Boolean).join(" - ");
}

function catalogText(product: ProductCatalogDto) {
  return [
    product.sourceRowNumber ? String(product.sourceRowNumber) : "",
    product.brandName,
    product.productName,
    product.productType,
    product.category,
    product.claimedSkinTypes.join(", "),
    product.claimedSkinConcerns.join(", "),
    product.heroIngredients.join(", "),
    product.otherKeyIngredients.join(", "),
    product.qty ?? ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function productScore(product: ProductCatalogDto, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = catalogText(product);
  let score = product.overallSuitabilityScore ?? 0;

  if (!normalizedQuery) {
    return score;
  }

  if (product.productName.toLowerCase().startsWith(normalizedQuery)) {
    score += 45;
  }

  if (product.brandName.toLowerCase().startsWith(normalizedQuery)) {
    score += 30;
  }

  if (haystack.includes(normalizedQuery)) {
    score += 28;
  }

  score += normalizedQuery.split(/\s+/g).filter((token) => haystack.includes(token)).length * 10;

  return score;
}

function ProductSearch({
  row,
  catalog,
  onSelect
}: {
  row: EditableProductRow;
  catalog: ProductCatalogDto[];
  onSelect: (product: ProductCatalogDto) => void;
}) {
  const [query, setQuery] = useState(rowLabel(row));
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const tokens = normalizedQuery.split(/\s+/g).filter(Boolean);

    return catalog
      .map((product) => ({
        product,
        score: productScore(product, query)
      }))
      .filter(({ product }) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = catalogText(product);
        return (
          product.brandName.toLowerCase().includes(normalizedQuery) ||
          product.productName.toLowerCase().includes(normalizedQuery) ||
          tokens.every((token) => haystack.includes(token))
        );
      })
      .sort((left, right) => right.score - left.score)
      .map(({ product }) => product);
  }, [catalog, query]);

  function selectProduct(product: ProductCatalogDto) {
    setQuery(`${product.brandName} - ${product.productName}`);
    setIsOpen(false);
    onSelect(product);
  }

  return (
    <div className="relative space-y-2">
      <Input
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            selectProduct(results[0]);
          }
        }}
        placeholder="Type product, brand, concern, ingredient, or serial no."
      />
      {isOpen ? (
        <div className="absolute z-20 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-3 pb-2 text-xs font-medium text-slate-500">
            {results.length} products found. Keep typing to filter.
          </p>
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => selectProduct(product)}
            >
              <span className="block text-sm font-semibold text-slate-900">
                {product.brandName} - {product.productName}
              </span>
              <span className="block text-xs text-slate-500">
                {[product.sourceRowNumber ? `#${product.sourceRowNumber}` : "", product.productType, product.qty, product.claimedSkinConcerns.join(", ")]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CreateFollowUpButton({
  syncedProfileId,
  disabled,
  initialProductRows,
  productCatalog
}: {
  syncedProfileId: string;
  disabled?: boolean;
  initialProductRows: DoctorProductRowDto[];
  productCatalog: ProductCatalogDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<EditableProductRow[]>(() => normalizeRows(initialProductRows));
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, nextRow: Partial<EditableProductRow>) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...nextRow } : row)));
  }

  function createFollowUp() {
    setError(null);

    const productRows = rows
      .map((row) => ({
        id: row.id,
        title: row.title.trim(),
        slot: row.slot,
        productCatalogId: row.productCatalogId,
        brand: row.brand.trim() || null,
        company: row.company.trim() || row.brand.trim() || null,
        productName: row.productName.trim() || null
      }))
      .filter((row) => row.title || row.brand || row.productName || row.productCatalogId);

    startTransition(async () => {
      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ syncedProfileId, productRows })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Could not create follow-up report");
        return;
      }

      router.push(`/reports/${payload.data.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.length > 0 ? (
          rows.map((row, index) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[0.8fr_1fr_1.6fr_auto]">
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={row.slot ?? "custom"}
                  onChange={(event) => {
                    const value = event.target.value as ProductSlotDto | "custom";
                    const slot = value === "custom" ? null : value;
                    const defaultTitle = slotOptions.find((option) => option.value === value)?.label ?? "";
                    updateRow(index, {
                      slot,
                      title: row.title || (value === "custom" ? "" : defaultTitle)
                    });
                  }}
                >
                  {slotOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={row.title}
                  onChange={(event) => updateRow(index, { title: event.target.value })}
                  placeholder="Report heading"
                />
                <ProductSearch
                  row={row}
                  catalog={productCatalog}
                  onSelect={(product) =>
                    updateRow(index, {
                      productCatalogId: product.id,
                      brand: product.brandName,
                      company: product.brandName,
                      productName: product.productName
                    })
                  }
                />
                <Button type="button" variant="ghost" onClick={() => setRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index))}>
                  Remove
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Selected: {rowLabel(row) || "No product selected yet"}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            No product rows selected. Add at least one product before generating the follow-up.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setRows((currentRows) => [
              ...currentRows,
              {
                id: createRowId(),
                title: "",
                slot: null,
                productCatalogId: null,
                brand: "",
                company: "",
                productName: ""
              }
            ])
          }
        >
          Add product
        </Button>
        <Button onClick={createFollowUp} disabled={disabled || isPending || rows.length === 0}>
          {isPending ? "Generating report..." : "Generate follow-up report"}
        </Button>
      </div>
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

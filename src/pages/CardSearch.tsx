import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAddCard, useCardSearch } from "../api/hooks";
import { useToast } from "../components/Toast";
import { ErrorBox, PageTitle } from "../components/ui";

export default function CardSearch() {
  const [name, setName] = useState("");
  const [set, setSet] = useState("");
  const [submitted, setSubmitted] = useState<{ name: string; set: string } | null>(null);
  const search = useCardSearch(submitted?.name ?? "", submitted?.set ?? "", submitted !== null);
  const addCard = useAddCard();
  const toast = useToast();
  const navigate = useNavigate();

  const onAdd = (cardId: string, label: string) =>
    addCard.mutate(cardId, {
      onSuccess: () => {
        toast(`Added ${label} to your catalog.`, "success");
        navigate(`/cards/${encodeURIComponent(cardId)}`);
      },
      onError: (e) => toast(e instanceof Error ? e.message : "Failed", "error"),
    });

  return (
    <div>
      <PageTitle>Look up a Card</PageTitle>
      <p className="mb-3 text-sm text-muted">
        Search by card name, set, or both. Your name stays filled so you can add a set after.
      </p>
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({ name, set });
        }}
      >
        <div>
          <label className="label">Card name</label>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dragapult ex" autoFocus />
        </div>
        <div>
          <label className="label">Set (optional)</label>
          <input className="input w-32" value={set} onChange={(e) => setSet(e.target.value)} placeholder="TWM" />
        </div>
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {search.isError && <ErrorBox error={search.error} />}
      {search.data?.error && <div className="card border-danger/40 p-3 text-danger">{search.data.error}</div>}

      {submitted && !search.isLoading && search.data && !search.data.error && (
        search.data.results.length === 0 ? (
          <p className="text-muted">No results.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {search.data.results.map((r) => (
              <div key={r.card_id} className="card flex gap-3 p-3">
                {r.image_url && <img src={r.image_url} alt="" className="h-24 rounded" loading="lazy" />}
                <div className="flex min-w-0 flex-col">
                  <div className="font-semibold">{r.card_name}</div>
                  <div className="text-sm text-muted">{r.card_set} · {r.set_number}</div>
                  <div className="truncate text-xs text-muted">{r.card_id}</div>
                  <button
                    className="btn-secondary btn-sm mt-auto w-fit"
                    onClick={() => onAdd(r.card_id, r.card_name)}
                    disabled={addCard.isPending}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";

import { useCreateDeck, useDecks } from "../api/hooks";
import { useToast } from "../components/Toast";
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from "../components/ui";

export default function Decks() {
  const { data, isLoading, error } = useDecks();
  const create = useCreateDeck();
  const toast = useToast();
  const [name, setName] = useState("");
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <PageTitle>Decks</PageTitle>
      <form
        className="mb-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate(name, {
            onSuccess: () => { toast(`Deck '${name}' created.`, "success"); setName(""); },
            onError: (err) => toast(err instanceof Error ? err.message : "Failed", "error"),
          });
        }}
      >
        <input className="input max-w-xs" placeholder="New deck name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" type="submit">Create deck</button>
      </form>

      {data!.length === 0 ? (
        <Empty>No decks yet. Create one above, then paste a deck list to fill it in.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((d) => (
            <Link key={d.deck_id} to={`/decks/${d.deck_id}`} className="card flex items-center justify-between p-4 transition hover:border-brand/50">
              <div>
                <div className="font-bold">{d.deck_name}</div>
                <div className="text-sm text-muted">{d.creation_date}</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-extrabold tabular-nums ${d.total > 60 ? "text-danger" : ""}`}>{d.total}/60</div>
                {d.is_complete ? <Badge tone="in">legal</Badge> : d.is_legal ? <Badge tone="out">{60 - d.total} to go</Badge> : <Badge tone="bad">illegal</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

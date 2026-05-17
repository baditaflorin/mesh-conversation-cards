import { useEffect, useMemo, useState } from "react";
import {
  MeshNameInput,
  createClockSync,
  useEventLog,
  useFairRng,
  useMeshSlot,
  useNamedPeer,
  usePhase,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Card = { id: string; peerId: string; text: string; ts: number };

const DEFAULT_POOL = [
  "What's a small lie you tell yourself?",
  "What's your earliest memory?",
  "If you had a free week, what would you do?",
  "Most embarrassing nickname?",
  "What did you almost choose as a career?",
  "A piece of advice you wish you'd ignored?",
  "First thing you'd buy with $10k?",
  "What recharges you?",
  "Funniest thing your phone autocorrected?",
  "What's your hottest take?",
  "Best meal you've had in 2026?",
  "If you wrote a book today, the title would be…",
];

export function Feature({ room, config }: Props) {
  if (!room)
    return (
      <div className="cc-screen">
        <h1>conversation cards</h1>
        <p className="cc-status">Connecting…</p>
      </div>
    );
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, names, nameOf } = useNamedPeer(config, room);
  const cards = useEventLog<Card>(room, "cards");
  const fairRng = useFairRng(room, "cc-salts");
  const phase = usePhase<"setup" | "playing">(room, "phase", "setup");
  const clock = useMemo(() => (room ? createClockSync(room.provider) : null), [room]);
  useEffect(() => () => clock?.destroy(), [clock]);
  const slot = useMeshSlot(clock, 60_000);

  const [draft, setDraft] = useState("");
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<number>("state");
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  const state = room.doc.getMap<number>("state");
  const roundN = state.get("round") ?? 0;
  const shuffled = fairRng.shuffle(cards.events);
  const currentCard = shuffled.length === 0 ? null : (shuffled[roundN % shuffled.length] ?? null);
  const present = Object.entries(names).sort(([a], [b]) => (a < b ? -1 : 1));
  const order = fairRng.shuffle(present);
  const currentResponderId = order.length ? (order[slot.slotId % order.length]?.[0] ?? null) : null;
  const responderName = currentResponderId ? (nameOf(currentResponderId) ?? "…") : "…";

  const addCard = () => {
    const t = draft.trim();
    if (!t) return;
    cards.push({
      id: Math.random().toString(36).slice(2, 10),
      peerId: room.peerId,
      text: t,
      ts: Date.now(),
    });
    setDraft("");
  };
  const loadDefaults = () => {
    room.doc.transact(() => {
      for (const text of DEFAULT_POOL)
        cards.push({
          id: Math.random().toString(36).slice(2, 10),
          peerId: room.peerId,
          text,
          ts: Date.now(),
        });
    });
  };
  const start = () => {
    if (cards.size < 1) return;
    state.set("round", 0);
    phase.transition("playing", { from: "setup" });
  };
  const next = () => state.set("round", (state.get("round") ?? 0) + 1);
  const backToSetup = () => phase.transition("setup");

  const history = shuffled
    .slice(0, Math.max(0, roundN + 1))
    .map((_, i) => shuffled[(roundN - i + shuffled.length) % shuffled.length])
    .slice(0, 5);

  return (
    <div className="cc-screen">
      <header className="cc-header">
        <h1>conversation cards</h1>
        <MeshNameInput
          className="cc-name"
          value={name}
          onChange={setName}
          placeholder="your name"
          maxLength={32}
        />
        <p className="cc-status">
          {Object.keys(names).length} named · {cards.size} cards · round {roundN + 1}
        </p>
      </header>

      {phase.isPhase("setup") && (
        <div className="cc-setup">
          <textarea
            className="cc-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="write a prompt card…"
            rows={2}
          />
          <div className="cc-row">
            <button type="button" className="cc-add" onClick={addCard} aria-label="add card">
              add card
            </button>
            {cards.size === 0 && (
              <button
                type="button"
                className="cc-load-defaults"
                onClick={loadDefaults}
                aria-label="load default pool"
              >
                load default pool
              </button>
            )}
            <button
              type="button"
              className="cc-start"
              onClick={start}
              disabled={cards.size < 1}
              aria-label="start"
            >
              start
            </button>
          </div>
          {cards.size === 0 && <p className="cc-hint">add some cards or use the default pool</p>}
        </div>
      )}

      {phase.isPhase("playing") && currentCard && (
        <div className="cc-play">
          <div className="cc-card">
            <p className="cc-card-text">{currentCard.text}</p>
            <p className="cc-card-author">— {nameOf(currentCard.peerId) ?? "peer"}</p>
          </div>
          <p className="cc-responder">{responderName}'s turn — pass when ready</p>
          <div className="cc-row">
            <button type="button" className="cc-next" onClick={next} aria-label="next card">
              next card
            </button>
            <button type="button" className="cc-setup-back" onClick={backToSetup}>
              back to setup
            </button>
          </div>
          <ul className="cc-history">
            {history.map((c, i) => c && <li key={`${c.id}-${i}`}>{c.text}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

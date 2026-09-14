import React, { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

// This is your actual Firebase project config (safe to keep public - client-side
// Firebase config is not a secret; access is controlled by your Database Rules).
const firebaseConfig = {
  apiKey: "AIzaSyCk-57siz7xv7eawGfw7s2U-3oyfjukI7I",
  authDomain: "household-inventory-6f8b5.firebaseapp.com",
  databaseURL: "https://household-inventory-6f8b5-default-rtdb.firebaseio.com",
  projectId: "household-inventory-6f8b5",
  storageBucket: "household-inventory-6f8b5.firebasestorage.app",
  messagingSenderId: "637447758819",
  appId: "1:637447758819:web:d0f3a58a727d3f444076d6",
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(firebaseApp);
const DATA_PATH = "household-inventory";

function toArray(x, fallback) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") return Object.values(x);
  return fallback;
}

const INK = "#2B2B24";
const PAGE_BG = "#F6F2E7";
const CARD_BG = "#FFFDF8";
const DIVIDER = "#E4DCC8";
const MUTED = "#8C8874";
const OK_BG = "#E1E7D6";
const OK_FG = "#3D4B30";
const ALERT_BG = "#F2DBD1";
const ALERT_FG = "#9C3C24";
const WARN_BG = "#F3E6BE";
const WARN_FG = "#8C6D1F";
const EXP_2W_BG = "#F6D6CB";
const EXP_2W_FG = "#A6472B";
const EXP_WEEK_BG = "#F2B8B0";
const EXP_WEEK_FG = "#7A1F14";

const DEFAULT_ZONES = [
  { key: "fridge", label: "Fridge" },
  { key: "freezer", label: "Freezer" },
  { key: "pantry", label: "Pantry" },
  { key: "spices", label: "Spices & condiments" },
  { key: "household", label: "Cleaning & household" },
];

const DEFAULT_ITEMS = [
  { id: "i1", name: "Milk", zone: "fridge", qty: 2, threshold: 1, expiryDates: [] },
  { id: "i2", name: "Eggs", zone: "fridge", qty: 6, threshold: 3, expiryDates: [] },
  { id: "i3", name: "Butter", zone: "fridge", qty: 1, threshold: 1, expiryDates: [] },
  { id: "i4", name: "Chicken breast", zone: "freezer", qty: 2, threshold: 1, expiryDates: [] },
  { id: "i5", name: "Frozen peas", zone: "freezer", qty: 1, threshold: 1, expiryDates: [] },
  { id: "i6", name: "Rice", zone: "pantry", qty: 1, threshold: 1, expiryDates: [] },
  { id: "i7", name: "Pasta", zone: "pantry", qty: 2, threshold: 1, expiryDates: [] },
  { id: "i8", name: "Canned tomatoes", zone: "pantry", qty: 3, threshold: 2, expiryDates: [] },
  { id: "i9", name: "Salt", zone: "spices", qty: 1, threshold: 1, expiryDates: [] },
  { id: "i10", name: "Black pepper", zone: "spices", qty: 1, threshold: 1, expiryDates: [] },
  { id: "i11", name: "Dish soap", zone: "household", qty: 1, threshold: 1, expiryDates: [] },
  { id: "i12", name: "Paper towels", zone: "household", qty: 2, threshold: 1, expiryDates: [] },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function needsRestock(it) {
  return it.qty <= it.threshold;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.round((d - today) / 86400000);
}

function soonestExpiryDays(it) {
  const dates = it.expiryDates || [];
  if (dates.length === 0) return null;
  const days = dates.map((d) => daysUntil(d.date)).filter((x) => x !== null);
  if (days.length === 0) return null;
  return Math.min(...days);
}

function expiryTierColors(daysLeft) {
  if (daysLeft === null || daysLeft === undefined || daysLeft > 30) return null;
  if (daysLeft <= 7) return { bg: EXP_WEEK_BG, fg: EXP_WEEK_FG };
  if (daysLeft <= 14) return { bg: EXP_2W_BG, fg: EXP_2W_FG };
  return { bg: WARN_BG, fg: WARN_FG };
}

function tierOf(daysLeft) {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "week";
  if (daysLeft <= 14) return "twoWeek";
  return "month";
}

function twoMonthsFromToday() {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d;
}

export default function HouseholdInventory() {
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pantry");
  const [addInputs, setAddInputs] = useState({});
  const [extraInput, setExtraInput] = useState("");
  const [restockInputs, setRestockInputs] = useState({});
  const [restockDateInputs, setRestockDateInputs] = useState({});
  const [addZoneInput, setAddZoneInput] = useState("");
  const [search, setSearch] = useState("");
  const [alsoNeedSearch, setAlsoNeedSearch] = useState("");
  const [newItemZone, setNewItemZone] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState({});
  const [dateInputs, setDateInputs] = useState({});
  const [qtyInputs, setQtyInputs] = useState({});
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [dragItemId, setDragItemId] = useState(null);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const loaded = useRef(false);
  const saveTimer = useRef(null);
  const saveToken = useRef(0);

  // Realtime subscription: fires immediately with the current data, then again
  // every time ANYONE (you or your wife) changes it, on any device.
  useEffect(() => {
    const dataRef = ref(db, DATA_PATH);
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        const parsed = snapshot.val();
        if (parsed) {
          const rawItems = toArray(parsed.items, DEFAULT_ITEMS);
          const migratedItems = rawItems.map((it) => {
            let dates = it.expiryDates;
            if (!dates) {
              dates = it.expiry ? [{ date: it.expiry, qty: 1 }] : [];
            } else {
              dates = toArray(dates, []);
              if (dates.length && typeof dates[0] === "string") {
                dates = dates.map((d) => ({ date: d, qty: 1 }));
              }
            }
            const { expiry, ...rest } = it;
            return { ...rest, expiryDates: dates };
          });
          setItems(migratedItems);
          setZones(toArray(parsed.zones, DEFAULT_ZONES));
          setExtras(toArray(parsed.extras, []));
        } else {
          // Nothing saved yet under this path - genuinely first run.
          setItems(DEFAULT_ITEMS);
          setZones(DEFAULT_ZONES);
          setExtras([]);
        }
        setError("");
        setLoading(false);
        loaded.current = true;
      },
      (err) => {
        setError("Couldn't connect to the shared database - check your internet connection.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const performSave = async () => {
    const myToken = ++saveToken.current;
    setSaveState("saving");
    try {
      await set(ref(db, DATA_PATH), { items, extras, zones });
      if (myToken !== saveToken.current) return;
      setError("");
      setSaveState("saved");
    } catch (e) {
      if (myToken !== saveToken.current) return;
      setError("Couldn't save - check your internet connection.");
      setSaveState("error");
    }
  };

  useEffect(() => {
    if (!loaded.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(performSave, 500);
    return () => clearTimeout(saveTimer.current);
  }, [items, extras, zones]);

  function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    performSave();
  }

  function adjustQty(id, delta) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = Math.max(0, it.qty + delta);
        let newExpiryDates = it.expiryDates;
        if (delta < 0 && newExpiryDates && newExpiryDates.length > 0) {
          let closestIdx = -1;
          let closestDays = Infinity;
          newExpiryDates.forEach((d, idx) => {
            if (d.qty > 0) {
              const days = daysUntil(d.date);
              const effectiveDays = days === null ? Infinity : days;
              if (effectiveDays < closestDays) {
                closestDays = effectiveDays;
                closestIdx = idx;
              }
            }
          });
          if (closestIdx !== -1) {
            newExpiryDates = newExpiryDates.map((d, idx) =>
              idx === closestIdx ? { ...d, qty: d.qty - 1 } : d
            );
          }
        }
        return { ...it, qty: newQty, expiryDates: newExpiryDates };
      })
    );
  }

  function setThreshold(id, value) {
    const n = Math.max(0, Number(value) || 0);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, threshold: n } : it)));
  }

  function setQty(id, value) {
    const n = Math.max(0, Number(value) || 0);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty: n } : it)));
  }

  function addExpiryDate(id, date, qty) {
    if (!date) return;
    const q = Math.max(1, Number(qty) || 1);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, expiryDates: [...(it.expiryDates || []), { date, qty: q }] }
          : it
      )
    );
  }

  function setExpiryDateQty(id, idx, qty) {
    const q = Math.max(0, Number(qty) || 0);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              expiryDates: it.expiryDates.map((d, i) => (i === idx ? { ...d, qty: q } : d)),
            }
          : it
      )
    );
  }

  function removeExpiryDateAt(id, idx) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, expiryDates: (it.expiryDates || []).filter((_, i) => i !== idx) }
          : it
      )
    );
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function addItem(zone) {
    const name = (addInputs[zone] || "").trim();
    if (!name) return;
    setItems((prev) => [...prev, { id: uid(), name, zone, qty: 1, threshold: 0, expiryDates: [] }]);
    setAddInputs((prev) => ({ ...prev, [zone]: "" }));
  }

  function createItem(name, zone) {
    const trimmed = name.trim();
    if (!trimmed || !zone) return;
    setItems((prev) => [...prev, { id: uid(), name: trimmed, zone, qty: 1, threshold: 0, expiryDates: [] }]);
  }

  function restock(id) {
    const raw = restockInputs[id];
    const item = items.find((it) => it.id === id);
    const fallback = item ? item.threshold + 1 : 1;
    const n = raw === undefined || raw === "" ? fallback : Math.max(0, Number(raw) || 0);
    const date = restockDateInputs[id];
    const addedAmount = item ? Math.max(0, n - item.qty) : 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, qty: n };
        if (date && addedAmount > 0) {
          updated.expiryDates = [...(it.expiryDates || []), { date, qty: addedAmount }];
        }
        return updated;
      })
    );
    setRestockInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRestockDateInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addExtra() {
    const name = extraInput.trim();
    if (!name) return;
    setExtras((prev) => [...prev, { id: uid(), name }]);
    setExtraInput("");
  }

  function removeExtra(id) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  function slugify(name) {
    let base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!base) base = "category";
    let candidate = base;
    let i = 2;
    while (zones.some((z) => z.key === candidate)) {
      candidate = base + "-" + i;
      i++;
    }
    return candidate;
  }

  function renameZone(key, label) {
    setZones((prev) => prev.map((z) => (z.key === key ? { ...z, label } : z)));
  }

  function addZone() {
    const name = addZoneInput.trim();
    if (!name) return;
    const key = slugify(name);
    setZones((prev) => [...prev, { key, label: name }]);
    setAddZoneInput("");
  }

  function removeZone(key) {
    const hasItems = items.some((it) => it.zone === key);
    if (hasItems) return;
    setZones((prev) => prev.filter((z) => z.key !== key));
  }

  function renameItem(id, name) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function changeItemZone(id, newZone) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item || item.zone === newZone) return prev;
      const without = prev.filter((i) => i.id !== id);
      const updated = { ...item, zone: newZone };
      let lastIdx = -1;
      without.forEach((it, idx) => {
        if (it.zone === newZone) lastIdx = idx;
      });
      const insertAt = lastIdx === -1 ? without.length : lastIdx + 1;
      return [...without.slice(0, insertAt), updated, ...without.slice(insertAt)];
    });
  }

  function moveItem(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    setItems((prev) => {
      const dragged = prev.find((i) => i.id === draggedId);
      const target = prev.find((i) => i.id === targetId);
      if (!dragged || !target) return prev;
      const without = prev.filter((i) => i.id !== draggedId);
      const targetIdx = without.findIndex((i) => i.id === targetId);
      const updated = { ...dragged, zone: target.zone };
      return [...without.slice(0, targetIdx), updated, ...without.slice(targetIdx)];
    });
  }

  function moveItemToZoneEnd(draggedId, zoneKey) {
    if (!draggedId) return;
    setItems((prev) => {
      const dragged = prev.find((i) => i.id === draggedId);
      if (!dragged) return prev;
      const without = prev.filter((i) => i.id !== draggedId);
      const updated = { ...dragged, zone: zoneKey };
      let lastIdx = -1;
      without.forEach((it, idx) => {
        if (it.zone === zoneKey) lastIdx = idx;
      });
      const insertAt = lastIdx === -1 ? without.length : lastIdx + 1;
      return [...without.slice(0, insertAt), updated, ...without.slice(insertAt)];
    });
  }

  const needsAttention = items.filter(needsRestock);
  const shoppingCount = needsAttention.length + extras.length;

  const expiringSoon = items
    .flatMap((it) =>
      (it.expiryDates || []).map((d) => ({
        itemId: it.id,
        name: it.name,
        zone: it.zone,
        date: d.date,
        qty: d.qty,
        daysLeft: daysUntil(d.date),
      }))
    )
    .filter((e) => e.daysLeft !== null && e.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (loading) {
    return (
      <div style={{ padding: "3rem 1rem", textAlign: "center", color: MUTED, fontFamily: "sans-serif" }}>
        Connecting…
      </div>
    );
  }

  const dragHandleStyle = {
    cursor: "grab",
    color: MUTED,
    fontSize: 14,
    padding: "0 2px",
    userSelect: "none",
  };

  return (
    <div
      style={{
        background: PAGE_BG,
        minHeight: "100vh",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: INK,
        padding: "0 0 3rem",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "1.75rem 1.25rem 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <h1
              style={{
                fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 28,
                margin: "0 0 2px",
              }}
            >
              Household Inventory
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
              Shared pantry and shopping list
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setEditMode((v) => !v)}
              style={{
                border: `1px solid ${editMode ? OK_FG : DIVIDER}`,
                borderRadius: 8,
                background: editMode ? OK_BG : "transparent",
                color: editMode ? OK_FG : INK,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: editMode ? 600 : 400,
                padding: "0 10px",
                height: 32,
              }}
            >
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: error ? ALERT_FG : MUTED }}>
            {error
              ? error
              : saveState === "saving"
              ? "Syncing…"
              : saveState === "saved"
              ? "Synced"
              : "Live"}
          </span>
        </div>

        {editMode && (
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 1rem" }}>
            Rename items or categories, change an item's category, drag to reorder or move between categories, and add new categories below.
          </p>
        )}

        <div
          style={{
            display: "flex",
            border: `1px solid ${DIVIDER}`,
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: "1.5rem",
          }}
        >
          <button
            onClick={() => setTab("pantry")}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              cursor: "pointer",
              background: tab === "pantry" ? CARD_BG : "transparent",
              color: INK,
              fontWeight: tab === "pantry" ? 600 : 400,
              fontSize: 13,
            }}
          >
            Stock
          </button>
          <button
            onClick={() => setTab("shopping")}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderLeft: `1px solid ${DIVIDER}`,
              cursor: "pointer",
              background: tab === "shopping" ? CARD_BG : "transparent",
              color: INK,
              fontWeight: tab === "shopping" ? 600 : 400,
              fontSize: 13,
              position: "relative",
            }}
          >
            Shopping
            {shoppingCount > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  background: ALERT_BG,
                  color: ALERT_FG,
                  borderRadius: 10,
                  fontSize: 11,
                  padding: "1px 6px",
                  fontWeight: 600,
                }}
              >
                {shoppingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("expiring")}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderLeft: `1px solid ${DIVIDER}`,
              cursor: "pointer",
              background: tab === "expiring" ? CARD_BG : "transparent",
              color: INK,
              fontWeight: tab === "expiring" ? 600 : 400,
              fontSize: 13,
              position: "relative",
            }}
          >
            Expiring soon
            {expiringSoon.length > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  background: WARN_BG,
                  color: WARN_FG,
                  borderRadius: 10,
                  fontSize: 11,
                  padding: "1px 6px",
                  fontWeight: 600,
                }}
              >
                {expiringSoon.length}
              </span>
            )}
          </button>
        </div>

        {tab === "pantry" && (
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${DIVIDER}`,
                borderRadius: 8,
                background: CARD_BG,
                padding: "8px 10px",
                fontSize: 13,
                color: INK,
                outline: "none",
                marginBottom: "1.25rem",
              }}
            />
            {zones.map((zone) => {
              const q = search.trim().toLowerCase();
              const zoneItems = items
                .filter((it) => it.zone === zone.key && (q === "" || it.name.toLowerCase().includes(q)))
                .sort((a, b) => a.name.localeCompare(b.name));
              if (q !== "" && zoneItems.length === 0) return null;
              const lowCount = zoneItems.filter(needsRestock).length;
              return (
                <div
                  key={zone.key}
                  onDragOver={(e) => editMode && e.preventDefault()}
                  onDrop={(e) => {
                    if (!editMode) return;
                    e.preventDefault();
                    moveItemToZoneEnd(dragItemId, zone.key);
                    setDragItemId(null);
                  }}
                  style={{ marginBottom: "1.75rem" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      borderBottom: `1px solid ${DIVIDER}`,
                      paddingBottom: 6,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {editMode ? (
                        <input
                          value={zone.label}
                          onChange={(e) => renameZone(zone.key, e.target.value)}
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            border: "none",
                            borderBottom: `1px dashed ${DIVIDER}`,
                            background: "transparent",
                            color: INK,
                            padding: "2px 2px",
                            outline: "none",
                            width: 180,
                          }}
                        />
                      ) : (
                        zone.label
                      )}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {lowCount > 0 && (
                        <span style={{ fontSize: 12, color: MUTED }}>
                          {lowCount} need{lowCount === 1 ? "s" : ""} restock
                        </span>
                      )}
                      {editMode && zoneItems.length === 0 && (
                        <button
                          onClick={() => removeZone(zone.key)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: MUTED,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  </div>

                  {zoneItems.map((it) => {
                    const low = needsRestock(it);
                    return (
                      <React.Fragment key={it.id}>
                      <div
                        draggable={editMode}
                        onDragStart={() => editMode && setDragItemId(it.id)}
                        onDragOver={(e) => editMode && e.preventDefault()}
                        onDrop={(e) => {
                          if (!editMode) return;
                          e.preventDefault();
                          e.stopPropagation();
                          moveItem(dragItemId, it.id);
                          setDragItemId(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 0",
                          flexWrap: "wrap",
                          opacity: dragItemId === it.id ? 0.4 : 1,
                        }}
                      >
                        {editMode && <span style={dragHandleStyle}>⠿</span>}
                        {editMode ? (
                          <input
                            value={it.name}
                            onChange={(e) => renameItem(it.id, e.target.value)}
                            style={{
                              flex: "1 1 90px",
                              fontSize: 14,
                              border: "none",
                              borderBottom: `1px dashed ${DIVIDER}`,
                              background: "transparent",
                              color: INK,
                              padding: "2px 2px",
                              outline: "none",
                            }}
                          />
                        ) : (
                          <span style={{ flex: "1 1 90px", fontSize: 14 }}>{it.name}</span>
                        )}

                        {editMode && (
                          <select
                            value={it.zone}
                            onChange={(e) => changeItemZone(it.id, e.target.value)}
                            style={{
                              border: `1px solid ${DIVIDER}`,
                              borderRadius: 6,
                              background: "transparent",
                              fontSize: 11,
                              color: INK,
                              padding: "3px 4px",
                              outline: "none",
                            }}
                          >
                            {zones.map((z) => (
                              <option key={z.key} value={z.key}>
                                {z.label}
                              </option>
                            ))}
                          </select>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button
                            onClick={() => adjustQty(it.id, -1)}
                            aria-label={`Decrease ${it.name}`}
                            style={{
                              width: 24,
                              height: 24,
                              border: `1px solid ${DIVIDER}`,
                              borderRadius: 6,
                              background: "transparent",
                              cursor: "pointer",
                              color: INK,
                              fontSize: 14,
                              lineHeight: 1,
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={it.qty}
                            onChange={(e) => setQty(it.id, e.target.value)}
                            style={{
                              width: 40,
                              textAlign: "center",
                              fontSize: 14,
                              fontWeight: 600,
                              padding: "2px 2px",
                              borderRadius: 6,
                              border: "none",
                              background: low ? ALERT_BG : OK_BG,
                              color: low ? ALERT_FG : OK_FG,
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => adjustQty(it.id, 1)}
                            aria-label={`Increase ${it.name}`}
                            style={{
                              width: 24,
                              height: 24,
                              border: `1px solid ${DIVIDER}`,
                              borderRadius: 6,
                              background: "transparent",
                              cursor: "pointer",
                              color: INK,
                              fontSize: 14,
                              lineHeight: 1,
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED }}>
                          <span>restock ≤</span>
                          <input
                            type="number"
                            min="0"
                            value={it.threshold}
                            onChange={(e) => setThreshold(it.id, e.target.value)}
                            style={{
                              width: 32,
                              border: "none",
                              borderBottom: `1px dashed ${DIVIDER}`,
                              background: "transparent",
                              fontSize: 12,
                              color: INK,
                              padding: "2px 2px",
                              outline: "none",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button
                            onClick={() => toggleExpanded(it.id)}
                            style={{
                              border: `1px solid ${DIVIDER}`,
                              borderRadius: 6,
                              background: (expiryTierColors(soonestExpiryDays(it)) || {}).bg || "transparent",
                              color: (expiryTierColors(soonestExpiryDays(it)) || {}).fg || MUTED,
                              cursor: "pointer",
                              fontSize: 11,
                              padding: "3px 7px",
                            }}
                          >
                            {(it.expiryDates || []).length > 0
                              ? (it.expiryDates.length === 1
                                  ? "1 date"
                                  : it.expiryDates.length + " dates")
                              : "Add date"}
                          </button>
                        </div>

                        {editMode &&
                          (pendingRemoveId === it.id ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 11, color: ALERT_FG }}>Remove?</span>
                              <button
                                onClick={() => {
                                  removeItem(it.id);
                                  setPendingRemoveId(null);
                                }}
                                style={{
                                  border: "none",
                                  background: ALERT_BG,
                                  color: ALERT_FG,
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                }}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setPendingRemoveId(null)}
                                style={{
                                  border: `1px solid ${DIVIDER}`,
                                  background: "transparent",
                                  color: INK,
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontSize: 11,
                                  padding: "3px 8px",
                                }}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setPendingRemoveId(it.id)}
                              aria-label={`Remove ${it.name}`}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: MUTED,
                                cursor: "pointer",
                                fontSize: 15,
                                padding: "0 2px",
                              }}
                            >
                              ×
                            </button>
                          ))}
                      </div>
                      {expandedIds[it.id] && (
                        <div style={{ padding: "2px 0 12px 20px", borderBottom: `1px solid ${DIVIDER}` }}>
                          {(it.expiryDates || []).length === 0 && (
                            <p style={{ fontSize: 12, color: MUTED, margin: "0 0 6px" }}>
                              No expiry dates yet - add one below, or add another each time you buy a fresh batch.
                            </p>
                          )}
                          {(it.expiryDates || []).map((d, idx) => {
                            const dLeft = daysUntil(d.date);
                            return (
                              <div
                                key={idx}
                                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  value={d.qty}
                                  onChange={(e) => setExpiryDateQty(it.id, idx, e.target.value)}
                                  style={{
                                    width: 32,
                                    border: `1px solid ${DIVIDER}`,
                                    borderRadius: 6,
                                    background: "transparent",
                                    fontSize: 12,
                                    color: INK,
                                    padding: "2px 4px",
                                    outline: "none",
                                  }}
                                />
                                <span style={{ fontSize: 12, color: MUTED }}>×</span>
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: (expiryTierColors(dLeft) || {}).fg || INK,
                                  }}
                                >
                                  {d.date}
                                </span>
                                {dLeft !== null && (
                                  <span style={{ fontSize: 11, color: MUTED }}>
                                    {dLeft < 0 ? "expired" : dLeft + "d left"}
                                  </span>
                                )}
                                {(editMode || d.qty === 0) && (
                                  <button
                                    onClick={() => removeExpiryDateAt(it.id, idx)}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      color: MUTED,
                                      cursor: "pointer",
                                      fontSize: 13,
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                            <input
                              type="number"
                              min="1"
                              placeholder="qty"
                              value={qtyInputs[it.id] || ""}
                              onChange={(e) =>
                                setQtyInputs((prev) => ({ ...prev, [it.id]: e.target.value }))
                              }
                              style={{
                                width: 44,
                                border: `1px solid ${DIVIDER}`,
                                borderRadius: 6,
                                background: "transparent",
                                fontSize: 12,
                                color: INK,
                                padding: "3px 4px",
                                outline: "none",
                              }}
                            />
                            <input
                              type="date"
                              value={dateInputs[it.id] || ""}
                              onChange={(e) =>
                                setDateInputs((prev) => ({ ...prev, [it.id]: e.target.value }))
                              }
                              style={{
                                border: `1px solid ${DIVIDER}`,
                                borderRadius: 6,
                                background: "transparent",
                                fontSize: 12,
                                color: INK,
                                padding: "3px 4px",
                                outline: "none",
                              }}
                            />
                            <button
                              onClick={() => {
                                addExpiryDate(it.id, dateInputs[it.id], qtyInputs[it.id]);
                                setDateInputs((prev) => ({ ...prev, [it.id]: "" }));
                                setQtyInputs((prev) => ({ ...prev, [it.id]: "" }));
                              }}
                              style={{
                                border: `1px solid ${DIVIDER}`,
                                borderRadius: 6,
                                background: "transparent",
                                color: INK,
                                cursor: "pointer",
                                fontSize: 12,
                                padding: "4px 10px",
                              }}
                            >
                              Add date
                            </button>
                          </div>
                        </div>
                      )}
                      </React.Fragment>
                    );
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <input
                      value={addInputs[zone.key] || ""}
                      onChange={(e) =>
                        setAddInputs((prev) => ({ ...prev, [zone.key]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && addItem(zone.key)}
                      placeholder="Add item"
                      style={{
                        flex: 1,
                        border: "none",
                        borderBottom: `1px dashed ${DIVIDER}`,
                        background: "transparent",
                        padding: "6px 2px",
                        fontSize: 13,
                        color: INK,
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => addItem(zone.key)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: MUTED,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              );
            })}

            {editMode && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${DIVIDER}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add a category</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={addZoneInput}
                    onChange={(e) => setAddZoneInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addZone()}
                    placeholder="e.g. Garage shelf"
                    style={{
                      flex: 1,
                      border: `1px solid ${DIVIDER}`,
                      borderRadius: 6,
                      background: "transparent",
                      padding: "6px 8px",
                      fontSize: 13,
                      color: INK,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={addZone}
                    style={{
                      border: `1px solid ${DIVIDER}`,
                      borderRadius: 6,
                      background: "transparent",
                      color: INK,
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "6px 12px",
                    }}
                  >
                    Add category
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "shopping" && (
          <div>
            <div style={{ marginBottom: "1.75rem" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  borderBottom: `1px solid ${DIVIDER}`,
                  paddingBottom: 6,
                  marginBottom: 8,
                }}
              >
                Running low
              </div>
              {needsAttention.length === 0 && (
                <p style={{ fontSize: 13, color: MUTED, margin: "8px 0" }}>
                  Nothing under threshold. The list fills in as quantities drop.
                </p>
              )}
              {needsAttention.map((it) => {
                const zone = zones.find((z) => z.key === it.zone);
                return (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ flex: "1 1 100px", fontSize: 14 }}>{it.name}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>
                      have {it.qty}, restock ≤ {it.threshold}
                    </span>
                    <span style={{ fontSize: 11, color: MUTED, minWidth: 46 }}>
                      {zone ? zone.label : ""}
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder={String(it.threshold + 1)}
                      value={restockInputs[it.id] ?? ""}
                      onChange={(e) =>
                        setRestockInputs((prev) => ({ ...prev, [it.id]: e.target.value }))
                      }
                      style={{
                        width: 44,
                        border: `1px solid ${DIVIDER}`,
                        borderRadius: 6,
                        background: "transparent",
                        fontSize: 12,
                        color: INK,
                        padding: "3px 4px",
                        outline: "none",
                      }}
                    />
                    <input
                      type="date"
                      value={restockDateInputs[it.id] || ""}
                      onChange={(e) =>
                        setRestockDateInputs((prev) => ({ ...prev, [it.id]: e.target.value }))
                      }
                      title="Expiry date for what you're buying now (optional)"
                      style={{
                        border: `1px solid ${DIVIDER}`,
                        borderRadius: 6,
                        background: "transparent",
                        fontSize: 11,
                        color: INK,
                        padding: "3px 4px",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => restock(it.id)}
                      style={{
                        border: "none",
                        background: OK_BG,
                        color: OK_FG,
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 9px",
                      }}
                    >
                      Bought
                    </button>
                  </div>
                );
              })}
            </div>

            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  borderBottom: `1px solid ${DIVIDER}`,
                  paddingBottom: 6,
                  marginBottom: 8,
                }}
              >
                Also need
              </div>

              <input
                value={alsoNeedSearch}
                onChange={(e) => setAlsoNeedSearch(e.target.value)}
                placeholder="Search for an item, or type a new one"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${DIVIDER}`,
                  borderRadius: 8,
                  background: CARD_BG,
                  padding: "8px 10px",
                  fontSize: 13,
                  color: INK,
                  outline: "none",
                  marginBottom: 10,
                }}
              />

              {alsoNeedSearch.trim() !== "" &&
                (() => {
                  const q = alsoNeedSearch.trim().toLowerCase();
                  const matches = items.filter((it) => it.name.toLowerCase().includes(q));

                  if (matches.length > 0) {
                    return matches.map((it) => {
                      const zone = zones.find((z) => z.key === it.zone);
                      return (
                        <div
                          key={it.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 0",
                            flexWrap: "wrap",
                            borderBottom: `1px solid ${DIVIDER}`,
                          }}
                        >
                          <span style={{ flex: "1 1 100px", fontSize: 14 }}>{it.name}</span>
                          <span style={{ fontSize: 11, color: MUTED, minWidth: 46 }}>
                            {zone ? zone.label : ""}
                          </span>
                          <span style={{ fontSize: 11, color: MUTED }}>have {it.qty}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder={String(it.threshold + 1)}
                            value={restockInputs[it.id] ?? ""}
                            onChange={(e) =>
                              setRestockInputs((prev) => ({ ...prev, [it.id]: e.target.value }))
                            }
                            style={{
                              width: 44,
                              border: `1px solid ${DIVIDER}`,
                              borderRadius: 6,
                              background: "transparent",
                              fontSize: 12,
                              color: INK,
                              padding: "3px 4px",
                              outline: "none",
                            }}
                          />
                          <input
                            type="date"
                            value={restockDateInputs[it.id] || ""}
                            onChange={(e) =>
                              setRestockDateInputs((prev) => ({ ...prev, [it.id]: e.target.value }))
                            }
                            title="Expiry date for what you're buying now (optional)"
                            style={{
                              border: `1px solid ${DIVIDER}`,
                              borderRadius: 6,
                              background: "transparent",
                              fontSize: 11,
                              color: INK,
                              padding: "3px 4px",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => restock(it.id)}
                            style={{
                              border: "none",
                              background: OK_BG,
                              color: OK_FG,
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "4px 9px",
                            }}
                          >
                            Bought
                          </button>
                        </div>
                      );
                    });
                  }

                  const zoneValue = newItemZone || (zones[0] && zones[0].key) || "";
                  return (
                    <div style={{ padding: "8px 0", borderBottom: `1px solid ${DIVIDER}` }}>
                      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 6px" }}>
                        No match for "{alsoNeedSearch.trim()}" - add it as a new item:
                      </p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={zoneValue}
                          onChange={(e) => setNewItemZone(e.target.value)}
                          style={{
                            border: `1px solid ${DIVIDER}`,
                            borderRadius: 6,
                            background: "transparent",
                            fontSize: 13,
                            color: INK,
                            padding: "5px 6px",
                            outline: "none",
                          }}
                        >
                          {zones.map((z) => (
                            <option key={z.key} value={z.key}>
                              {z.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => createItem(alsoNeedSearch, zoneValue)}
                          style={{
                            border: "none",
                            background: OK_BG,
                            color: OK_FG,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "5px 10px",
                          }}
                        >
                          Add item
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: MUTED, margin: "6px 0 0" }}>
                        Once added, it'll show up right here so you can set the quantity and expiry date.
                      </p>
                    </div>
                  );
                })()}

              {extras.length > 0 && (
                <div style={{ marginTop: alsoNeedSearch.trim() !== "" ? 16 : 0 }}>
                  <p style={{ fontSize: 12, color: MUTED, margin: "0 0 4px" }}>Previously added</p>
                  {extras.map((e) => (
                    <label
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        onChange={() => removeExtra(e.id)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ flex: 1, fontSize: 14 }}>{e.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "expiring" && (
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                borderBottom: `1px solid ${DIVIDER}`,
                paddingBottom: 6,
                marginBottom: 8,
              }}
            >
              Expiring within 1 month
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1rem" }}>
              {[
                { key: "all", label: "All" },
                { key: "expired", label: "Expired" },
                { key: "week", label: "1 week" },
                { key: "twoWeek", label: "2 weeks" },
                { key: "month", label: "1 month" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setExpiryFilter(f.key)}
                  style={{
                    border: `1px solid ${expiryFilter === f.key ? INK : DIVIDER}`,
                    borderRadius: 12,
                    background: expiryFilter === f.key ? CARD_BG : "transparent",
                    color: INK,
                    fontWeight: expiryFilter === f.key ? 600 : 400,
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "4px 10px",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {expiringSoon.length === 0 && (
              <p style={{ fontSize: 13, color: MUTED, margin: "8px 0" }}>
                Nothing with an expiry date coming up. Add dates from the Stock tab to track this.
              </p>
            )}
            {expiringSoon.length > 0 &&
              expiringSoon.filter((e) => expiryFilter === "all" || tierOf(e.daysLeft) === expiryFilter)
                .length === 0 && (
                <p style={{ fontSize: 13, color: MUTED, margin: "8px 0" }}>
                  Nothing matches this filter.
                </p>
              )}
            {expiringSoon
              .filter((e) => expiryFilter === "all" || tierOf(e.daysLeft) === expiryFilter)
              .map((e, idx) => {
              const zone = zones.find((z) => z.key === e.zone);
              const expired = e.daysLeft < 0;
              return (
                <div
                  key={e.itemId + "-" + e.date + "-" + idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ flex: "1 1 100px", fontSize: 14 }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: MUTED, minWidth: 46 }}>
                    {zone ? zone.label : ""}
                  </span>
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {e.qty} × {e.date}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 10,
                      background: expired
                        ? EXP_WEEK_BG
                        : (expiryTierColors(e.daysLeft) || {}).bg || WARN_BG,
                      color: expired
                        ? EXP_WEEK_FG
                        : (expiryTierColors(e.daysLeft) || {}).fg || WARN_FG,
                    }}
                  >
                    {expired ? "Expired" : `${e.daysLeft}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

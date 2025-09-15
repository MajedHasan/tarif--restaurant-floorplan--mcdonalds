"use client";

import Konva from "konva";
import React, { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Group,
  Text,
  Image as KonvaImage,
} from "react-konva";

function useImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => setImage(img);
  }, [url]);
  return image;
}

type Seat = {
  id: string;
  label: string;
  name?: string;
  x: number;
  y: number;
  radius: number;
  fill: string;
  visible?: boolean; // new property
};

const STORAGE_KEY = "floorplan_v3_seats_only";
const RIGHT_WIDTH = 350;

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export default function FloorPlanEditor() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  // modal/panel visibility
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const background = useImage("/floorplan.png");

  // Stage is full viewport (canvas always full width)
  const [stageSize, setStageSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 800,
    height: typeof window !== "undefined" ? window.innerHeight : 600,
  });

  useEffect(() => {
    function updateSizeFromContainer() {
      const el = containerRef.current;
      if (el) {
        setStageSize({ width: el.clientWidth, height: el.clientHeight });
      } else {
        setStageSize({ width: window.innerWidth, height: window.innerHeight });
      }
    }

    updateSizeFromContainer();
    const onWin = () => updateSizeFromContainer();
    window.addEventListener("resize", onWin);

    let ro: ResizeObserver | null = null;
    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => updateSizeFromContainer());
      if (containerRef.current) ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", onWin);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, []);

  // Load seats (migration)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Seat>[];
        const migrated: Seat[] = parsed.map((s) => ({
          id: s.id ?? uid("S-"),
          label: s.label ?? "0",
          name: s.name ?? "",
          x: s.x ?? stageSize.width / 2,
          y: s.y ?? stageSize.height / 2,
          radius: s.radius ?? 24, // <-- just use default radius
          fill: s.fill ?? "#ffffff",
          visible: s.visible ?? true,
        }));
        setSeats(migrated);
        return;
      }
    } catch {}
    setSeats([
      {
        id: "S1",
        label: "1",
        name: "A",
        x: 180,
        y: 120,
        radius: 24,
        fill: "#ffffff",
        visible: true,
      },
      {
        id: "S2",
        label: "2",
        name: "B",
        x: 320,
        y: 220,
        radius: 24,
        fill: "#ffffff",
        visible: true,
      },
      {
        id: "S3",
        label: "3",
        name: "C",
        x: 240,
        y: 360,
        radius: 24,
        fill: "#ffffff",
        visible: true,
      },
    ]);
  }, [stageSize.width, stageSize.height]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seats));
    } catch {}
  }, [seats]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // keyboard: 'b' toggle, Escape close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key.toLowerCase() === "b") {
        setSidebarVisible((v) => !v);
      } else if (e.key === "Escape") {
        setSidebarVisible(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function addSeat() {
    const id = uid("S-");
    const s: Seat = {
      id,
      label: `${seats.length + 1}`,
      name: "",
      x: stageSize.width / 2,
      y: stageSize.height / 2,
      radius: 24,
      fill: "#ffffff",
      visible: true,
    };
    setSeats((p) => [...p, s]);
    setSelectedId(s.id);
    setTimeout(() => {
      setEditingId(s.id);
      setEditingText("");
    }, 30);
  }

  function getTextColor(fill: string) {
    // Convert hex to RGB
    if (!fill.startsWith("#") || (fill.length !== 7 && fill.length !== 4))
      return "#000";

    let r: number, g: number, b: number;

    if (fill.length === 7) {
      r = parseInt(fill.slice(1, 3), 16);
      g = parseInt(fill.slice(3, 5), 16);
      b = parseInt(fill.slice(5, 7), 16);
    } else {
      // shorthand e.g. #fff
      r = parseInt(fill[1] + fill[1], 16);
      g = parseInt(fill[2] + fill[2], 16);
      b = parseInt(fill[3] + fill[3], 16);
    }

    // Calculate luminance (0 = dark, 255 = bright)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    // if bright, use black text; if dark, use white text
    return luminance > 186 ? "#000000" : "#ffffff";
  }

  function confirmAndDelete(id: string) {
    const seat = seats.find((s) => s.id === id);
    const name =
      seat?.name && seat.name.trim().length > 0
        ? seat!.name
        : seat?.label ?? id;
    if (window.confirm(`Delete rectangle "${name}" (${id}) ?`)) {
      setSeats((p) => p.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      if (editingId === id) {
        setEditingId(null);
        setEditingText("");
      }
    }
  }

  function updateSeat(id: string, patch: Partial<Seat>) {
    setSeats((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function getInputStyleForSeat(id: string | null) {
    if (!id || !stageRef.current)
      return { display: "none" } as React.CSSProperties;
    const seat = seats.find((s) => s.id === id);
    if (!seat) return { display: "none" } as React.CSSProperties;
    try {
      const container = stageRef.current.container();
      const rect = container.getBoundingClientRect();
      const left = rect.left + seat.x;
      const top = rect.top + seat.y;
      return {
        position: "fixed",
        left,
        top,
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
      } as React.CSSProperties;
    } catch {
      return { display: "none" } as React.CSSProperties;
    }
  }

  function commitEdit() {
    if (!editingId) {
      setEditingText("");
      return;
    }
    updateSeat(editingId, { name: editingText });
    setEditingId(null);
    setEditingText("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  // toggle sidebar handler
  function toggleSidebar() {
    setSidebarVisible((v) => !v);
  }

  return (
    <>
      {/* small handle (secret) to open the panel */}
      {!sidebarVisible && (
        <button
          onClick={toggleSidebar}
          title='Open sidebar (or press "b")'
          style={{
            position: "fixed",
            right: 12,
            top: 12,
            zIndex: 4000,
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            cursor: "pointer",
          }}
        >
          ≡
        </button>
      )}

      {/* Canvas area -- always full width */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          right: 0,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}>
          <Layer>
            {background && (
              <KonvaImage
                image={background}
                width={stageSize.width}
                height={stageSize.height}
                listening={false}
              />
            )}

            {seats.map((s) => {
              if (!s.visible) return null; // skip hidden seats
              const displayText =
                s.name && s.name.trim().length > 0 ? s.name : s.label;
              return (
                <Group
                  key={s.id}
                  x={s.x}
                  y={s.y}
                  draggable
                  onDragMove={(e) =>
                    updateSeat(s.id, { x: e.target.x(), y: e.target.y() })
                  }
                  onDragEnd={(e) =>
                    updateSeat(s.id, { x: e.target.x(), y: e.target.y() })
                  }
                  onClick={() => setSelectedId(s.id)}
                  onDblClick={() => {
                    setSelectedId(s.id);
                    setEditingId(s.id);
                    setEditingText(s.name ?? "");
                  }}
                >
                  <Rect
                    width={s.radius * 2.5}
                    height={s.radius * 2.5}
                    offsetX={(s.radius * 2.5) / 2}
                    offsetY={(s.radius * 2.5) / 2}
                    fill={s.fill}
                    stroke={s.id === selectedId ? "orange" : "black"}
                    strokeWidth={s.id === selectedId ? 3 : 1}
                  />
                  <Text
                    text={displayText}
                    fontSize={14}
                    width={s.radius * 2}
                    align="center"
                    offsetX={s.radius}
                    offsetY={-7}
                    fill={getTextColor(s.fill)}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* Inline rename input */}
      <div style={getInputStyleForSeat(editingId)}>
        {editingId && (
          <input
            ref={inputRef}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            placeholder="Enter name"
            onBlur={() => commitEdit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitEdit();
              } else if (e.key === "Escape") {
                cancelEdit();
              }
            }}
            style={{
              width: 160,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #ccc",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
          />
        )}
      </div>

      {/* Dim overlay: visual only, pointerEvents none so canvas remains interactive */}
      {sidebarVisible && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.20)",
            zIndex: 4000,
            pointerEvents: "none", // IMPORTANT: allows Konva/canvas to keep receiving pointer events
          }}
        />
      )}

      {/* Right-side panel: full height (top->bottom->right) */}
      {sidebarVisible && (
        <aside
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: RIGHT_WIDTH,
            background: "#fafafa",
            borderLeft: "1px solid #ddd",
            padding: 12,
            boxSizing: "border-box",
            overflow: "auto",
            zIndex: 4100, // above overlay
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: "6px 0 12px 0" }}>
              Rectangles (scaled by radius)
            </h3>
            <div>
              <button onClick={() => setSidebarVisible(false)}>Close ✖</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={addSeat}>➕ Add Rectangle</button>
            <button
              onClick={() => {
                if (!selectedId) return alert("Select a rectangle first.");
                const s = seats.find((x) => x.id === selectedId);
                if (!s) return;
                setEditingId(s.id);
                setEditingText(s.name ?? "");
              }}
            >
              ✏️ Rename Selected
            </button>
            <button
              onClick={() => {
                if (!selectedId) return alert("Select a rectangle first.");
                const s = seats.find((x) => x.id === selectedId);
                if (!s) return alert("No selected rectangle");
                const color = prompt("Enter hex color (e.g. #ffcc00):", s.fill);
                if (color) updateSeat(selectedId, { fill: color });
              }}
            >
              🎨 Color Selected
            </button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <strong>Selected:</strong>{" "}
            {selectedId ? (
              selectedId
            ) : (
              <span style={{ color: "#888" }}>none</span>
            )}
          </div>

          {selectedId && (
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                border: "1px solid #eee",
                borderRadius: 6,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <label>
                  Color:{" "}
                  <input
                    type="color"
                    value={
                      seats.find((s) => s.id === selectedId)?.fill || "#ffffff"
                    }
                    onChange={(e) =>
                      updateSeat(selectedId, { fill: e.target.value })
                    }
                  />
                </label>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Radius:{" "}
                  <input
                    type="range"
                    min={8}
                    max={80}
                    value={seats.find((s) => s.id === selectedId)?.radius ?? 24}
                    onChange={(e) =>
                      updateSeat(selectedId, { radius: +e.target.value })
                    }
                  />{" "}
                  {seats.find((s) => s.id === selectedId)?.radius ?? 24}px{" "}
                  (diameter:{" "}
                  {(seats.find((s) => s.id === selectedId)?.radius ?? 24) * 2}
                  px)
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => confirmAndDelete(selectedId)}>
                  Delete
                </button>
                <button
                  onClick={() => {
                    const s = seats.find((x) => x.id === selectedId);
                    if (!s) return;
                    setEditingId(s.id);
                    setEditingText(s.name ?? "");
                  }}
                >
                  Rename
                </button>
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 110px 60px 110px",
                gap: 8,
                alignItems: "center",
                padding: "8px 4px",
                fontWeight: 700,
              }}
            >
              <div>#</div>
              <div>Name</div>
              <div>ID</div>
              <div>Color</div>
              <div>Actions</div>
            </div>
            <div>
              {seats.length === 0 && (
                <div style={{ padding: 8 }}>No rectangles</div>
              )}
              {seats.map((s, idx) => {
                const isSelected = selectedId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 110px 60px 110px",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 4px",
                      cursor: "pointer",
                      background: isSelected ? "#fff6d6" : "transparent",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{idx + 1}</div>

                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.name && s.name.trim().length > 0 ? s.name : s.label}
                    </div>

                    <div
                      style={{ color: "#666", fontSize: 12, fontWeight: 600 }}
                    >
                      {s.name}
                    </div>

                    <div>
                      <input
                        title="Change color"
                        type="color"
                        value={s.fill}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateSeat(s.id, { fill: e.target.value })
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        title={s.visible ? "Hide seat" : "Show seat"}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSeat(s.id, { visible: !s.visible });
                        }}
                      >
                        {s.visible ? "👁️" : "🙈"}
                      </button>
                      <button
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(s.id);
                          setEditingText(s.name ?? "");
                          setSelectedId(s.id);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmAndDelete(s.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

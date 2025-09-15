"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Circle,
  Group,
  Text,
  Image as KonvaImage,
} from "react-konva";
import Konva from "konva";

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
};

const STORAGE_KEY = "floorplan_v3_seats_only";
const RIGHT_WIDTH = 350;

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export default function FloorPlanEditor() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Editing state (stable and simple)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const background = useImage("/floorplan.png");

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    function updateSize() {
      const el = containerRef.current;
      if (el) {
        setStageSize({ width: el.clientWidth, height: el.clientHeight });
      } else {
        setStageSize({
          width: window.innerWidth - RIGHT_WIDTH,
          height: window.innerHeight,
        });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Load seats from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSeats(JSON.parse(raw));
        return;
      }
    } catch {}
    // defaults
    setSeats([
      {
        id: "S1",
        label: "1",
        name: "A",
        x: 180,
        y: 120,
        radius: 24,
        fill: "#ffffff",
      },
      {
        id: "S2",
        label: "2",
        name: "B",
        x: 320,
        y: 220,
        radius: 24,
        fill: "#ffffff",
      },
      {
        id: "S3",
        label: "3",
        name: "C",
        x: 240,
        y: 360,
        radius: 24,
        fill: "#ffffff",
      },
    ]);
  }, []);

  // Save seats
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seats));
    } catch {}
  }, [seats]);

  // Focus the input when entering editing mode
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Helpers
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
    };
    setSeats((p) => [...p, s]);
    setSelectedId(s.id);
    // start editing name immediately
    setTimeout(() => {
      setEditingId(s.id);
      setEditingText("");
    }, 30);
  }

  function confirmAndDelete(id: string) {
    const seat = seats.find((s) => s.id === id);
    const name =
      seat?.name && seat.name.trim().length > 0
        ? seat!.name
        : seat?.label ?? id;
    if (window.confirm(`Delete circle "${name}" (${id}) ?`)) {
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

  // Compute input center position relative to viewport for the editing seat
  function getInputStyleForSeat(id: string | null) {
    if (!id || !stageRef.current)
      return { display: "none" } as React.CSSProperties;
    const seat = seats.find((s) => s.id === id);
    if (!seat) return { display: "none" } as React.CSSProperties;
    try {
      const container = stageRef.current.container();
      const rect = container.getBoundingClientRect();
      // seat.x/y are stage coords (top-left 0,0)
      const left = rect.left + seat.x;
      const top = rect.top + seat.y;
      // center with transform
      return {
        position: "fixed",
        left,
        top,
        transform: "translate(-50%, -50%)",
        zIndex: 2000,
      } as React.CSSProperties;
    } catch {
      return { display: "none" } as React.CSSProperties;
    }
  }

  // Commit editing text to seat name
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

  return (
    <>
      {/* Right sidebar only */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: RIGHT_WIDTH,
          background: "#fafafa",
          borderLeft: "1px solid #ddd",
          padding: 12,
          boxSizing: "border-box",
          overflow: "auto",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial",
        }}
      >
        <h3 style={{ margin: "6px 0 12px 0" }}>Circles</h3>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={addSeat}>➕ Add Circle</button>
          <button
            onClick={() => {
              // center view on selected if any
              if (!selectedId) return alert("Select a circle first.");
              const s = seats.find((x) => x.id === selectedId);
              if (!s) return;
              // start editing name
              setEditingId(s.id);
              setEditingText(s.name ?? "");
            }}
          >
            ✏️ Rename Selected
          </button>
          <button
            onClick={() => {
              if (!selectedId) return alert("Select a circle first.");
              const s = seats.find((x) => x.id === selectedId);
              if (!s) return alert("No selected circle");
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

        {/* Selected controls */}
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
                Size:{" "}
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={seats.find((s) => s.id === selectedId)?.radius ?? 24}
                  onChange={(e) =>
                    updateSeat(selectedId, { radius: +e.target.value })
                  }
                />
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

        {/* Table-like list */}
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
            {seats.length === 0 && <div style={{ padding: 8 }}>No circles</div>}
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

                  <div style={{ color: "#666", fontSize: 12, fontWeight: 600 }}>
                    {/* {s.id} */}
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
      </div>

      {/* Canvas area (left side) */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          right: RIGHT_WIDTH,
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
              const displayText =
                s.name && s.name.trim().length > 0 ? s.name : s.label;
              return (
                <Group
                  key={s.id}
                  x={s.x}
                  y={s.y}
                  draggable
                  onDragMove={(e) => {
                    // while dragging keep state responsive
                    const nx = e.target.x();
                    const ny = e.target.y();
                    updateSeat(s.id, { x: nx, y: ny });
                  }}
                  onDragEnd={(e) => {
                    updateSeat(s.id, { x: e.target.x(), y: e.target.y() });
                  }}
                  onClick={(e) => {
                    setSelectedId(s.id);
                  }}
                  onDblClick={(e) => {
                    setSelectedId(s.id);
                    setEditingId(s.id);
                    setEditingText(s.name ?? "");
                  }}
                >
                  <Circle
                    radius={s.radius}
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
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* Inline rename input (centered on the circle) */}
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
    </>
  );
}

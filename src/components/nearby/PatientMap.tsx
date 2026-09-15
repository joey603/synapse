"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  rank: number;
  href: string;
  action: string;
};

export function PatientMap({
  here,
  pins,
  meLabel,
}: {
  here: { lat: number; lng: number } | null;
  pins: MapPin[];
  meLabel: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const groupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const dataRef = useRef({ here, pins, meLabel });

  useEffect(() => {
    const host = node.current;
    if (!host) return;
    let cancelled = false;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !node.current || mapRef.current) return;
      const map = leaflet.map(node.current, { zoomControl: true }).setView([31.5, 34.9], 7);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);
      mapRef.current = map;
      leafletRef.current = leaflet;
      groupRef.current = leaflet.layerGroup().addTo(map);
      paint(leaflet, map, groupRef.current, dataRef.current);
      window.setTimeout(() => {
        if (!cancelled && mapRef.current === map) map.invalidateSize();
      }, 200);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    dataRef.current = { here, pins, meLabel };
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const group = groupRef.current;
    if (!leaflet || !map || !group) return;
    paint(leaflet, map, group, dataRef.current);
  }, [here, meLabel, pins]);

  return <div ref={node} className="synapse-map h-72 w-full bg-[#d5dde3]" />;
}

function paint(
  leaflet: typeof import("leaflet"),
  map: import("leaflet").Map,
  group: import("leaflet").LayerGroup,
  data: { here: { lat: number; lng: number } | null; pins: MapPin[]; meLabel: string },
) {
  group.clearLayers();
  const here = data.here;
  const pins = data.pins;
  const bounds: [number, number][] = [];

  if (here) {
    bounds.push([here.lat, here.lng]);
    leaflet
      .circleMarker([here.lat, here.lng], {
        radius: 12,
        color: "#ffffff",
        weight: 3,
        fillColor: "#1e4d6b",
        fillOpacity: 1,
      })
      .addTo(group);
    leaflet
      .marker([here.lat, here.lng], {
        icon: leaflet.divIcon({
          className: "synapse-pin",
          html: pinMarkup("#1e4d6b"),
          iconSize: [34, 44],
          iconAnchor: [17, 42],
        }),
        zIndexOffset: 1000,
      })
      .addTo(group)
      .bindTooltip(data.meLabel, { permanent: true, direction: "right", offset: [14, -16], className: "synapse-me-label" });
  }

  for (const pin of pins) {
    bounds.push([pin.lat, pin.lng]);
    const body = document.createElement("div");
    const title = document.createElement("p");
    title.textContent = pin.label;
    title.style.margin = "0";
    title.style.fontSize = "14px";
    title.style.fontWeight = "600";
    const link = document.createElement("a");
    link.href = pin.href;
    link.rel = "noreferrer";
    link.textContent = pin.action;
    link.style.display = "inline-block";
    link.style.marginTop = "6px";
    link.style.fontSize = "14px";
    link.style.fontWeight = "600";
    link.style.color = "#1e4d6b";
    body.append(title, link);
    leaflet
      .marker([pin.lat, pin.lng], {
        icon: leaflet.divIcon({
          className: "synapse-pin",
          html: pinMarkup("#9a4f3c", pin.rank),
          iconSize: [32, 42],
          iconAnchor: [16, 40],
        }),
      })
      .addTo(group)
      .bindPopup(body);
  }

  const size = map.getSize();
  if (!size.x || !size.y) return;
  if (bounds.length === 1) map.setView(bounds[0], 14);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
}

function pinMarkup(color: string, rank?: number) {
  const mark = rank
    ? `<text x="16" y="19" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial,sans-serif">${rank}</text>`
    : `<circle cx="16" cy="15" r="4.2" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 41s13-14.2 13-25.2C29 7.4 23.2 1.5 16 1.5S3 7.4 3 15.8C3 26.8 16 41 16 41z" fill="${color}" stroke="#fff" stroke-width="1.6"/>${mark}</svg>`;
}

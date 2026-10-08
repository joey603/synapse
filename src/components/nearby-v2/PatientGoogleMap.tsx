"use client";

import { useEffect, useRef, useState } from "react";

import { openGoogleNavigation } from "@/lib/geo/google-maps-link";
import {
  loadGoogleMaps,
  publicGoogleMapsKey,
  type GoogleMap,
  type GoogleMarker,
} from "@/lib/geo/load-google-maps";

export type GoogleMapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  rank: number;
  action: string;
  address?: string | null;
  city?: string | null;
};

const PIN_BROWN = "#9a4f3c";
const ME_BLUE = "#1e4d6b";

export function PatientGoogleMap({
  here,
  pins,
  meLabel,
  missingKeyLabel,
}: {
  here: { lat: number; lng: number } | null;
  pins: GoogleMapPin[];
  meLabel: string;
  missingKeyLabel: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const patientMarkersRef = useRef<GoogleMarker[]>([]);
  const meMarkerRef = useRef<GoogleMarker | null>(null);
  const fittedPinsKey = useRef<string>("");
  const pinsRef = useRef(pins);
  const hereRef = useRef(here);
  const meLabelRef = useRef(meLabel);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    pinsRef.current = pins;
    hereRef.current = here;
    meLabelRef.current = meLabel;
  }, [pins, here, meLabel]);

  useEffect(() => {
    const key = publicGoogleMapsKey();
    if (!key) {
      setStatus("missing");
      return;
    }

    let cancelled = false;
    void loadGoogleMaps(key)
      .then(() => {
        if (cancelled || !node.current || !window.google?.maps) return;
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(node.current, {
            center: { lat: 31.5, lng: 34.9 },
            zoom: 8,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Pastilles patients : reconstruites seulement si la liste / rangs changent.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;
    clearMarkers(patientMarkersRef);

    const bounds = new window.google.maps.LatLngBounds();
    let count = 0;

    for (const pin of pins) {
      bounds.extend({ lat: pin.lat, lng: pin.lng });
      count += 1;
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.label,
        label: {
          text: String(pin.rank),
          color: "#ffffff",
          fontWeight: "700",
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: PIN_BROWN,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 14,
        },
      });
      marker.addListener("click", () => {
        const origin = hereRef.current;
        openGoogleNavigation({
          latitude: pin.lat,
          longitude: pin.lng,
          address: pin.address,
          city: pin.city,
          from: origin ? { latitude: origin.lat, longitude: origin.lng } : null,
        });
      });
      patientMarkersRef.current.push(marker);
    }

    const pinsKey = pins.map((pin) => `${pin.id}:${pin.rank}:${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`).join("|");
    const shouldFit = pinsKey !== fittedPinsKey.current;
    if (shouldFit && count > 0) {
      fittedPinsKey.current = pinsKey;
      if (hereRef.current) bounds.extend(hereRef.current);
      if (count === 1 && !hereRef.current) {
        map.setCenter({ lat: pins[0]!.lat, lng: pins[0]!.lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 48);
      }
    }
  }, [pins, status]);

  // Marqueur « Moi » : suit le GPS sans recentrer toute la carte.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;

    if (!here) {
      if (meMarkerRef.current) {
        meMarkerRef.current.setMap(null);
        meMarkerRef.current = null;
      }
      return;
    }

    if (!meMarkerRef.current) {
      meMarkerRef.current = new window.google.maps.Marker({
        map,
        position: here,
        title: meLabelRef.current,
        zIndex: 1000,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: ME_BLUE,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 10,
        },
      });
      if (fittedPinsKey.current === "" && pinsRef.current.length === 0) {
        map.setCenter(here);
        map.setZoom(14);
      }
    } else {
      meMarkerRef.current.setPosition(here);
    }
  }, [here, status]);

  useEffect(() => {
    return () => {
      clearMarkers(patientMarkersRef);
      if (meMarkerRef.current) {
        meMarkerRef.current.setMap(null);
        meMarkerRef.current = null;
      }
      mapRef.current = null;
    };
  }, []);

  if (status === "missing" || status === "error") {
    return (
      <div className="flex h-72 items-center justify-center bg-[#d5dde3] px-4 text-center text-sm text-muted">
        {missingKeyLabel}
      </div>
    );
  }

  return <div ref={node} className="h-72 w-full bg-[#d5dde3]" />;
}

function clearMarkers(markersRef: { current: GoogleMarker[] }) {
  for (const marker of markersRef.current) {
    marker.setMap(null);
    window.google?.maps.event.clearInstanceListeners(marker);
  }
  markersRef.current = [];
}

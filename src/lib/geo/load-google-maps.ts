let loading: Promise<void> | null = null;

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          el: HTMLElement,
          opts: {
            center: { lat: number; lng: number };
            zoom: number;
            mapTypeControl?: boolean;
            streetViewControl?: boolean;
            fullscreenControl?: boolean;
            rotateControl?: boolean;
            tilt?: number;
            heading?: number;
            /** VECTOR = vue GPS inclinable (comme Google Maps nav). */
            renderingType?: "RASTER" | "VECTOR" | string;
            tiltInteractionEnabled?: boolean;
            headingInteractionEnabled?: boolean;
            isFractionalZoomEnabled?: boolean;
            mapId?: string;
            styles?: Array<Record<string, unknown>>;
          },
        ) => GoogleMap;
        RenderingType?: { RASTER: string; VECTOR: string };
        Marker: new (opts: {
          map: GoogleMap;
          position: { lat: number; lng: number };
          title?: string;
          label?: { text: string; color: string; fontWeight: string };
          icon?: {
            path: number | string;
            fillColor: string;
            fillOpacity: number;
            strokeColor: string;
            strokeWeight: number;
            scale: number;
            rotation?: number;
            anchor?: { x: number; y: number };
            labelOrigin?: { x: number; y: number };
          };
          zIndex?: number;
        }) => GoogleMarker;
        LatLngBounds: new () => GoogleBounds;
        Polyline: new (opts: {
          map?: GoogleMap | null;
          path: Array<{ lat: number; lng: number }>;
          strokeColor?: string;
          strokeOpacity?: number;
          strokeWeight?: number;
        }) => GooglePolyline;
        SymbolPath: { CIRCLE: number };
        event: {
          clearInstanceListeners: (target: unknown) => void;
          addListener?: (target: unknown, event: string, handler: () => void) => void;
        };
      };
    };
  }
}

export type GoogleMap = {
  fitBounds: (bounds: GoogleBounds, padding?: number) => void;
  setCenter: (pos: { lat: number; lng: number }) => void;
  panTo: (pos: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  setTilt: (tilt: number) => void;
  setHeading: (heading: number) => void;
  moveCamera?: (opts: {
    center?: { lat: number; lng: number };
    zoom?: number;
    tilt?: number;
    heading?: number;
  }) => void;
  setOptions: (opts: {
    gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
    rotateControl?: boolean;
    zoomControl?: boolean;
    tilt?: number;
    heading?: number;
    tiltInteractionEnabled?: boolean;
    headingInteractionEnabled?: boolean;
    styles?: Array<Record<string, unknown>>;
  }) => void;
};

/** Styles plats : pas de volumes / bâtiments 3D. */
export const FLAT_MAP_STYLES: Array<Record<string, unknown>> = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ visibility: "simplified" }, { lightness: 20 }],
  },
];

export type GooglePolyline = {
  setMap: (map: GoogleMap | null) => void;
};

export type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  setPosition: (pos: { lat: number; lng: number }) => void;
  setIcon: (icon: {
    path: number | string;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWeight: number;
    scale: number;
    rotation?: number;
  }) => void;
  addListener: (event: string, handler: () => void) => void;
};

export type GoogleBounds = {
  extend: (pos: { lat: number; lng: number }) => void;
  isEmpty: () => boolean;
};

export function publicGoogleMapsKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

/** Charge le script Maps JS une seule fois. */
export function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.google?.maps) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-synapse-gmaps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gmaps_load")));
      return;
    }
    const script = document.createElement("script");
    script.dataset.synapseGmaps = "1";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("gmaps_load"));
    };
    document.head.appendChild(script);
  });

  return loading;
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dépôt git parent est le dossier personnel. Sans cette racine,
  // Turbopack remonte trop haut et peut voir des fichiers hors projet.
  turbopack: {
    root: process.cwd(),
  },
  // Ne pas générer AGENTS.md / CLAUDE.md dans le dépôt.
  agentRules: false,
  // Le badge Next recouvre la navigation mobile. Les erreurs restent affichées.
  devIndicators: false,
  experimental: {
    // Le proxy coupe les corps au-dessus de 10 Mo. Un entretien compressé peut approcher 25 Mo.
    proxyClientMaxBodySize: "26mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Permissions-Policy", value: "geolocation=(self)" }],
      },
    ];
  },
  // Les secrets (OPENAI_API_KEY, DATABASE_URL, AUTH_SECRET) restent
  // dans l'environnement serveur. Ne pas les déclarer dans `env`.
};

export default nextConfig;

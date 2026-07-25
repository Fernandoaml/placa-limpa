import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// IPs IPv4 de rede da própria máquina, detectados em runtime.
// Assim o dev server aceita a URL de rede (ex.: http://192.168.x.x:3000) sem hardcodar
// nem versionar nenhum IP — funciona em qualquer rede automaticamente.
const lanOrigins = Object.values(networkInterfaces())
  .flat()
  .filter((iface): iface is NonNullable<typeof iface> => Boolean(iface) && iface!.family === "IPv4" && !iface!.internal)
  .map((iface) => iface.address);

const nextConfig: NextConfig = {
  // localhost já é same-origin; adicionamos os IPs de LAN detectados (dev only).
  allowedDevOrigins: lanOrigins,
  // Empacota a base local SQLite nas funções de API para leitura em produção (Vercel).
  outputFileTracingIncludes: {
    "/api/veiculos": ["./data/**"],
    "/api/emissores": ["./data/**"],
    "/api/dados": ["./data/**"],
  },
};

export default nextConfig;

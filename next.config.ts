import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/** Dev assets must load from this machine and from the LAN address a colleague opens. */
function devOrigins(): string[] {
  const origins = new Set<string>(["127.0.0.1"]);
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === "IPv4" && entry.address) origins.add(entry.address);
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins(),
};

export default nextConfig;

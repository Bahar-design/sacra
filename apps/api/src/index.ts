import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { prayerRoutes } from "./routes/prayers";
import { searchRoutes } from "./routes/search";
import { listenRoutes } from "./routes/listen";
import { translateRoutes } from "./routes/translate";
import { communityRoutes } from "./routes/community";
import { dashboardRoutes } from "./routes/dashboard";
import "dotenv/config";

async function main() {
  const server = Fastify({ logger: true });
  await server.register(cors, { origin: true });
  await server.register(websocket);
  await server.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  await server.register(prayerRoutes,   { prefix: "/api/prayers" });
  await server.register(searchRoutes,   { prefix: "/api/search" });
  await server.register(listenRoutes,   { prefix: "/api/listen" });
  await server.register(translateRoutes, { prefix: "/api/translate" });
  await server.register(communityRoutes, { prefix: "/api/community" });
  await server.register(dashboardRoutes, { prefix: "/api/dashboard" });
  server.get("/health", async () => ({ status: "ok", timestamp: new Date() }));

  const PORT = parseInt(process.env.PORT || "3001");
  try {
    await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`✦ SACRA API running on port ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();

import { Hono } from "hono"
import { cors } from "hono/cors"

import { usageDashboardHtml } from "./dashboard-page"
import { requireApiKey, safeRequestLogger } from "./lib/api-key"
import { completionRoutes } from "./routes/chat-completions/route"
import { embeddingRoutes } from "./routes/embeddings/route"
import { messageRoutes } from "./routes/messages/route"
import { modelRoutes } from "./routes/models/route"
import { responsesRoutes } from "./routes/responses/route"
import { tokenRoute } from "./routes/token/route"
import { usageRoute } from "./routes/usage/route"
import { getCopilotUsage } from "./services/github/get-copilot-usage"

export const server = new Hono()

server.use(safeRequestLogger)
server.use(cors())

server.get("/", (c) => c.text("Server running"))

server.use("*", requireApiKey)

server.get("/dashboard", (c) => {
  return c.html(usageDashboardHtml)
})

server.get("/dashboard/data", async (c) => {
  try {
    return c.json(await getCopilotUsage())
  } catch (error) {
    console.error("Error fetching dashboard usage:", error)
    return c.json({ error: "Failed to fetch Copilot usage" }, 500)
  }
})

server.route("/chat/completions", completionRoutes)
server.route("/models", modelRoutes)
server.route("/embeddings", embeddingRoutes)
server.route("/responses", responsesRoutes)
server.route("/usage", usageRoute)
server.route("/token", tokenRoute)

// Compatibility with tools that expect v1/ prefix
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/models", modelRoutes)
server.route("/v1/embeddings", embeddingRoutes)
server.route("/v1/responses", responsesRoutes)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)

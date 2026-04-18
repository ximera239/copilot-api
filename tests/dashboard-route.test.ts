import { afterEach, beforeEach, expect, mock, test } from "bun:test"

import { state } from "../src/lib/state"
import { server } from "../src/server"

const originalApiKey = state.apiKey

beforeEach(() => {
  state.authFailures.clear()
  state.apiKey = "test-key"
})

afterEach(() => {
  state.authFailures.clear()
  state.apiKey = originalApiKey
})

test("rejects unauthenticated dashboard requests", async () => {
  const response = await server.request("http://localhost/dashboard")

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({
    error: {
      message: "Invalid API key",
      type: "authentication_error",
    },
  })
})

test("serves embedded dashboard html for authenticated requests", async () => {
  const response = await server.request("http://localhost/dashboard", {
    headers: {
      Authorization: "Bearer test-key",
    },
  })

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/html")

  const body = await response.text()
  expect(body).toContain("<title>Copilot API Usage Dashboard</title>")
  expect(body).toContain('const DASHBOARD_DATA_ENDPOINT = "/dashboard/data"')
  expect(body).toContain("const REFRESH_INTERVAL_MS = 30000")
  expect(body).not.toContain('id="endpoint-form"')
  expect(body).toContain("The dashboard refreshes every 30 seconds.")
})

test("serves dashboard data from a same-origin protected endpoint", async () => {
  const fetchMock = mock((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          access_type_sku: "free",
          analytics_tracking_id: "tracking-id",
          assigned_date: "2026-01-01",
          can_signup_for_limited: false,
          chat_enabled: true,
          copilot_plan: "individual",
          organization_login_list: [],
          organization_list: [],
          quota_reset_date: "2026-01-31",
          quota_snapshots: {
            chat: {
              entitlement: 100,
              overage_count: 0,
              overage_permitted: false,
              percent_remaining: 70,
              quota_id: "chat",
              quota_remaining: 70,
              remaining: 70,
              unlimited: false,
            },
            completions: {
              entitlement: 100,
              overage_count: 0,
              overage_permitted: false,
              percent_remaining: 80,
              quota_id: "completions",
              quota_remaining: 80,
              remaining: 80,
              unlimited: false,
            },
            premium_interactions: {
              entitlement: 50,
              overage_count: 0,
              overage_permitted: false,
              percent_remaining: 40,
              quota_id: "premium_interactions",
              quota_remaining: 20,
              remaining: 20,
              unlimited: false,
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    ),
  )
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const response = await server.request("http://localhost/dashboard/data", {
    headers: {
      Authorization: "Bearer test-key",
    },
  })

  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    copilot_plan: "individual",
    quota_snapshots: {
      chat: {
        remaining: 70,
      },
    },
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("rejects unauthenticated dashboard data requests", async () => {
  const response = await server.request("http://localhost/dashboard/data")

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({
    error: {
      message: "Invalid API key",
      type: "authentication_error",
    },
  })
})

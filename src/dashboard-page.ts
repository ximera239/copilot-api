export const usageDashboardHtml = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Copilot API Usage Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <script src="https://unpkg.com/lucide-react@0.378.0/dist/umd/lucide.min.js"></script>
    <style>
      :root {
        --color-red: #cc241d;
        --color-green: #98971a;
        --color-yellow: #d79921;
        --color-blue: #458588;
        --color-aqua: #689d6a;
        --color-gray: #a89984;
        --color-bg-darkest: #1d2021;
        --color-bg: #282828;
        --color-bg-light-1: #3c3836;
        --color-bg-light-2: #504945;
        --color-bg-light-3: #665c54;
        --color-bg-soft: #32302f;
        --color-fg-dark: #bdae93;
        --color-fg-medium: #d5c4a1;
        --color-fg-light: #ebdbb2;
        --color-fg-lightest: #fbf1c7;
      }

      body {
        font-family: "Inter", sans-serif;
        background-color: var(--color-bg-darkest);
        color: var(--color-fg-light);
      }

      .progress-bar-bg {
        background-color: var(--color-bg-light-1);
      }

      .progress-bar-fg {
        transition: width 0.5s ease-in-out;
      }

      .input-focus:focus {
        --tw-ring-color: var(--color-blue);
        border-color: var(--color-blue);
      }
    </style>
  </head>
  <body class="antialiased">
    <div id="app" class="min-h-screen p-4 sm:p-6">
      <div class="mx-auto max-w-7xl">
        <header class="mb-6">
          <h1 class="flex items-center gap-2 text-2xl font-bold" style="color: var(--color-fg-lightest)">
            <span>Copilot API Usage Dashboard</span>
          </h1>
          <p class="mt-1 text-sm" style="color: var(--color-gray)">
            Hosted directly by this server.
          </p>
        </header>

        <div
          class="mb-6 border p-4"
          style="background-color: var(--color-bg-soft); border-color: var(--color-bg-light-2)"
        >
          <div class="flex flex-col gap-1 text-sm">
            <p style="color: var(--color-fg-lightest)">Usage data is loaded automatically from this server.</p>
            <p style="color: var(--color-gray)">The dashboard refreshes every 30 seconds.</p>
          </div>
        </div>

        <main id="content-area"></main>
      </div>
    </div>

    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const contentArea = document.getElementById("content-area");
        const DASHBOARD_DATA_ENDPOINT = "/dashboard/data";
        const REFRESH_INTERVAL_MS = 30000;

        const state = {
          isLoading: false,
          error: null,
          data: null,
        };

        function createIcons() {
          if (typeof lucide !== "undefined") {
            lucide.createIcons();
          }
        }

        function renderSpinner() {
          return '<div class="flex items-center justify-center py-20"><div class="h-12 w-12 animate-spin rounded-full border-4 border-transparent" style="border-top-color: var(--color-blue)"></div></div>';
        }

        function renderError(message) {
          return '<div class="border p-3" role="alert" style="background-color: rgba(204, 36, 29, 0.2); border-color: var(--color-red); color: #fb4934"><p class="text-sm font-bold">An Error Occurred</p><p class="text-xs">' + message + '</p></div>';
        }

        function renderWelcomeMessage() {
          return '<div class="border px-4 py-16 text-center" style="background-color: var(--color-bg-soft); border-color: var(--color-bg-light-2)"><h3 class="text-lg font-semibold" style="color: var(--color-fg-lightest)">Loading usage data…</h3><p class="mt-1 text-sm" style="color: var(--color-gray)">This page refreshes automatically every 30 seconds.</p></div>';
        }

        function formatObject(obj) {
          if (obj === null || typeof obj !== "object") {
            return '<span style="color: var(--color-green)">' + JSON.stringify(obj) + '</span>';
          }

          return '<div class="pl-4">' + Object.entries(obj).map(([key, value]) => {
            const formattedKey = key.replace(/_/g, " ");

            if (Array.isArray(value)) {
              return '<div class="mt-1"><span class="font-semibold capitalize" style="color: var(--color-fg-medium)">' + formattedKey + ':</span> <span style="color: var(--color-gray)">[' + value.length + ' items]</span></div>';
            }

            if (typeof value === "object" && value !== null) {
              return '<div class="mt-1"><span class="font-semibold capitalize" style="color: var(--color-fg-medium)">' + formattedKey + ':</span>' + formatObject(value) + '</div>';
            }

            return '<div class="mt-1"><span class="font-semibold capitalize" style="color: var(--color-fg-medium)">' + formattedKey + ':</span> <span style="color: var(--color-blue)">' + JSON.stringify(value) + '</span></div>';
          }).join("") + '</div>';
        }

        function renderQuotaCard(title, details) {
          const entitlement = details.entitlement;
          const remaining = details.remaining;
          const percentRemaining = details.percent_remaining;
          const unlimited = details.unlimited;
          const percentUsed = unlimited ? 0 : 100 - percentRemaining;
          const used = unlimited ? "N/A" : (entitlement - remaining).toLocaleString();

          let progressBarColor = "var(--color-green)";
          if (percentUsed > 75) progressBarColor = "var(--color-yellow)";
          if (percentUsed > 90) progressBarColor = "var(--color-red)";
          if (unlimited) progressBarColor = "var(--color-blue)";

          return '<div class="border p-4" style="background-color: var(--color-bg); border-color: var(--color-bg-light-2)"><div class="mb-2 flex items-center justify-between"><h3 class="text-md font-semibold capitalize" style="color: var(--color-fg-lightest)">' + title.replace(/_/g, " ") + '</h3><span class="text-sm font-mono" style="color: var(--color-fg-medium)">' + (unlimited ? "Unlimited" : percentUsed.toFixed(1) + '% Used') + '</span></div><div class="mb-3"><div class="progress-bar-bg h-2 w-full"><div class="progress-bar-fg h-2" style="width: ' + (unlimited ? 100 : percentUsed) + '%; background-color: ' + progressBarColor + '"></div></div></div><div class="flex justify-between text-xs font-mono" style="color: var(--color-fg-dark)"><span>' + used + ' / ' + (unlimited ? '∞' : entitlement.toLocaleString()) + '</span><span>' + (unlimited ? '∞' : remaining.toLocaleString() + ' remaining') + '</span></div></div>';
        }

        function renderUsageQuotas(snapshots) {
          if (!snapshots) {
            return "";
          }

          const quotaCards = Object.entries(snapshots)
            .map(([key, value]) => renderQuotaCard(key, value))
            .join("");

          return '<section id="usage-quotas" class="mb-6"><h2 class="mb-3 text-xl font-bold" style="color: var(--color-fg-lightest)">Usage Quotas</h2><div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">' + quotaCards + '</div></section>';
        }

        function renderDetailedData(data) {
          return '<section id="detailed-data"><h2 class="mb-3 text-xl font-bold" style="color: var(--color-fg-lightest)">Detailed Information</h2><div class="relative border p-4 font-mono text-xs" style="background-color: var(--color-bg-darkest); border-color: var(--color-bg-light-2)">' + formatObject(data) + '</div></section>';
        }

        function render() {
          if (state.isLoading) {
            contentArea.innerHTML = renderSpinner();
            return;
          }

          if (state.error) {
            contentArea.innerHTML = renderError(state.error);
          } else if (state.data) {
            contentArea.innerHTML = renderUsageQuotas(state.data.quota_snapshots) + renderDetailedData(state.data);
          } else {
            contentArea.innerHTML = renderWelcomeMessage();
          }

          createIcons();
        }

        async function fetchData() {
          state.isLoading = true;
          state.error = null;
          render();

          try {
            const response = await fetch(DASHBOARD_DATA_ENDPOINT);
            if (!response.ok) {
              throw new Error('Request failed with status ' + response.status + ': ' + response.statusText);
            }

            state.data = await response.json();
          } catch (error) {
            console.error("Fetch error:", error);
            state.data = null;
            state.error = error instanceof Error ? error.message : String(error);
          } finally {
            state.isLoading = false;
            render();
          }
        }

        function init() {
          render();
          fetchData();
          window.setInterval(fetchData, REFRESH_INTERVAL_MS);
        }

        init();
      });
    </script>
  </body>
</html>
`

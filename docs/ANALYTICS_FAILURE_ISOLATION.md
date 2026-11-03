# Prevent delayed analytics from blanking the app

## Reproduced failure

DeferredAnalytics mounted a React.lazy import after four seconds outside every error boundary. A failed analytics chunk download caused an uncaught React error and unmounted the entire root, leaving the black body background. Refreshing initially restored the page until the same delayed import failed again.

The previous production build reproduced this exactly with a local static server returning HTTP 503 for the analytics module: the landing page initially rendered, then its accessibility tree became empty and the console reported `Failed to fetch dynamically imported module` for the analytics chunk.

## Fix

- Keep telemetry deferred, but explicitly handle its import rejection. A failed optional download does not become an uncaught lazy-render error.
- Isolate analytics rendering in its own error boundary, returning nothing for analytics if its render or lifecycle fails. Training, nutrition and account state remain mounted.
- Wrap the router and account/sync providers in the existing recovery boundary, so a provider render failure has a visible recovery screen too.
- No auth state, cache, queued logs or workout records are cleared. No AI requests are added to startup.

## Verification

- 210 unit tests pass and production build succeeds.
- Production browser test with analytics module returning HTTP 503: page remains visible after the four-second timer; navigation to sign-in works.
- Production browser test with analytics module exporting a component that throws `Synthetic analytics render failure`: console confirms the injected error, landing page remains visible.
- Saved screenshot shows working sign-in after the forced failed download: `artifacts/analytics-failure-fixed-mobile.png`.

Local failure fixture is `artifacts/startup-qa/analytics-failure-server.mjs`: run from the repository root after building, with arguments `4192 download` or `4193 render`. It binds only 127.0.0.1, serves the production output and replaces only the optional analytics module. It does not use customer accounts or modify data.

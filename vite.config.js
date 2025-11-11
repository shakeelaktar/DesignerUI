import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Helper: sensible defaults when running UI outside docker-compose (e.g., in a dev container)
const HOST = 'host.docker.internal'
const DEFAULTS = {
  TRIGGER: process.env.PROXY_TRIGGER_URL || process.env.VITE_TRIGGER_URL || `http://${HOST}:5002`,
  METADATA: process.env.PROXY_METADATA_URL || process.env.VITE_METADATA_URL || `http://${HOST}:5005`,
  GATEWAY: process.env.PROXY_GATEWAY_BASE || process.env.VITE_GATEWAY_BASE || `http://${HOST}:8080`,
}

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces and explicitly allow common hostnames used from Docker Desktop
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  // Accept all hosts when running behind reverse proxies (gateway/docker)
  // See https://vitejs.dev/config/server-options#server-allowedhosts
  allowedHosts: true,
    proxy: {
      '/api': {
        // Server-only proxy target for Trigger service
        target: DEFAULTS.TRIGGER,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/meta': {
        // Server-only proxy target for Metadata API
        target: DEFAULTS.METADATA,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/meta/, '')
      },
      '/devportal': {
        // Forward designer UI calls to ApiGateway alias for dev portal APIs
        // Example: /devportal/audit/t1/ProductSurvey -> http://host.docker.internal:8080/devportal/audit/t1/ProductSurvey
        target: DEFAULTS.GATEWAY,
        changeOrigin: true,
        secure: false
      },
      '/idp': {
        // Forward auth calls to the ApiGateway; keep '/idp' prefix intact to match gateway routes
        target: process.env.PROXY_IDP_BASE || DEFAULTS.GATEWAY,
        changeOrigin: true,
        secure: false
      }
    }
  }
})

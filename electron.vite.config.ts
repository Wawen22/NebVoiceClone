import { dirname, resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// simli-client 3.0.2 publishes TS with Windows-only import casing and incomplete stop cleanup.
const simliCompatibility = {
  name: 'simli-3.0.2-compatibility',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (!importer?.replace(/\\/g, '/').includes('/node_modules/simli-client/lib/') || !source.startsWith('.')) return
    const fixed = source.replace('/Client', '/client').replace('/Events', '/events').replace('/Transports/', '/transports/').replace('/Signaling/', '/signaling/')
    if (fixed !== source) return resolve(dirname(importer), `${fixed}.ts`)
  },
  transform(code: string, id: string) {
    if (!id.replace(/\\/g, '/').includes('/node_modules/simli-client/lib/')) return
    let fixed = code.replace(/(['"])(\.\.?\/)Client\1/g, '$1$2client$1')
      .replace(/(['"])(\.\.?\/)Events\1/g, '$1$2events$1')
      .replace(/(['"])(\.\.?\/)Transports\//g, '$1$2transports/')
      .replace(/(['"])(\.\.?\/)Signaling\//g, '$1$2signaling/')
    if (id.endsWith('/client.ts') || id.endsWith('\\client.ts')) fixed = fixed
      .replace('MAX_RETRY_ATTEMPTS = 10', 'MAX_RETRY_ATTEMPTS = 0')
      .replace('this.connectionResolve = resolveFn!;', 'this.connectionPromise.catch(() => undefined); this.connectionResolve = resolveFn!;')
      .replace('await this.connection.disconnect()\n    }', 'clearTimeout(this.connectionTimeout); this.connectionReject("Stopped"); await this.connection.disconnect(); await this.audioContext.close();\n    }')
    if (id.endsWith('/P2PTransport.ts') || id.endsWith('\\P2PTransport.ts')) fixed = fixed
      .replace('this.pc = new window.RTCPeerConnection(config);', `this.pc = new window.RTCPeerConnection(config);
        this.websocketPromise.catch(() => undefined);
        this.signalingConnection.wsConnection.onclose = () => {
            this.websocketReject?.("Websocket closed"); this.websocketReject = null;
            this.emit("error", "Websocket closed");
        };
        this.pc.addEventListener("connectionstatechange", () => {
            if (["failed", "disconnected", "closed"].includes(this.pc.connectionState)) this.emit("error", "Peer disconnected");
        });`)
    return { code: fixed, map: null }
  }
}

export default defineConfig({
  main: {
    build: { rollupOptions: { input: resolve('src/main/index.ts') } }
  },
  preload: {
    build: { rollupOptions: { input: resolve('src/preload/index.ts') } }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias: { 'simli-client': resolve('node_modules/simli-client/lib/client.ts') } },
    plugins: [simliCompatibility, react()],
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } }
  }
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import LogiTrackVasche from './logitrack_vasche_v2'

// Marker: usato dal fallback in index.html per capire se il bundle e partito.
window.__LOGITRACK_BOOTSTRAPPED__ = true
try {
    const bootFallback = document.getElementById('boot-fallback')
    if (bootFallback) {
        bootFallback.style.display = 'none'
    }
} catch {
    // ignore
}

const FATAL_OVERLAY_ID = 'logitrack-fatal-overlay'

function formatError(error) {
    return error instanceof Error ? (error.stack || error.message) : String(error)
}

function showFatalError(error) {
    const message = formatError(error)
    const body = document.body
    if (!body) return

    let overlay = document.getElementById(FATAL_OVERLAY_ID)
    if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = FATAL_OVERLAY_ID
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ffffff;padding:16px;overflow:auto;'
        body.appendChild(overlay)
    }

    overlay.innerHTML = `
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: #0f172a;">
        <h1 style="font-size: 16px; margin: 0 0 12px;">LogiTrack - Errore di avvio</h1>
        <pre style="white-space: pre-wrap; margin: 0; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">${message}</pre>
      </div>
    `
}

window.addEventListener('error', (event) => {
    showFatalError(event?.error || event?.message || event)
})
window.addEventListener('unhandledrejection', (event) => {
    showFatalError(event?.reason || event)
})

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error) {
        // Keep for console visibility in dev tools
        console.error('React render error:', error)
    }

    render() {
        if (this.state.hasError) {
            const message = formatError(this.state.error)
            return (
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", padding: 16, color: '#0f172a' }}>
                    <h1 style={{ fontSize: 16, margin: '0 0 12px' }}>LogiTrack - Errore di avvio</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>{message}</pre>
                </div>
            )
        }
        return this.props.children
    }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
    showFatalError('Elemento #root non trovato')
} else {
    ReactDOM.createRoot(rootEl).render(
        <React.StrictMode>
            <ErrorBoundary>
                <LogiTrackVasche />
            </ErrorBoundary>
        </React.StrictMode>,
    )
}

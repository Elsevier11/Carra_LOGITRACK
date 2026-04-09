import React from 'react'
import ReactDOM from 'react-dom/client'
import LogiTrackVasche from './logitrack_vasche_v2'

// Marker: usato dal fallback in index.html per capire se il bundle è partito.
window.__LOGITRACK_BOOTSTRAPPED__ = true
try {
    document.getElementById('boot-fallback')?.remove()
} catch {
    // ignore
}

function showFatalError(error) {
    const root = document.getElementById('root')
    const message = error instanceof Error ? (error.stack || error.message) : String(error)

    if (!root) {
        document.body.innerText = `Fatal error: ${message}`
        return
    }

    root.innerHTML = `
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; padding: 16px; color: #0f172a;">
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
            showFatalError(this.state.error)
            return null
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

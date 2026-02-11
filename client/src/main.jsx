import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { this.setState({ error, errorInfo }); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-red-500 font-mono p-8 flex flex-col items-center justify-center">
                    <div className="border border-red-800 p-6 rounded max-w-2xl w-full bg-gray-900">
                        <h1 className="text-2xl font-bold mb-4 border-b border-red-800 pb-2">SYSTEM FAILURE</h1>
                        <p className="mb-4">An unexpected error occurred.</p>
                        <button onClick={() => window.location.reload()} className="bg-red-900/50 hover:bg-red-800 text-white px-4 py-2 rounded border border-red-700 w-full">REBOOT SYSTEM</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

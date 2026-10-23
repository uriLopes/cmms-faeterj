import { BrowserRouter, Routes, Route } from 'react-router-dom'

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-cmms-accent rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">⚙</span>
          </div>
          <h1 className="text-3xl font-bold text-cmms-text">CMMS FAETERJ</h1>
        </div>
        <p className="text-cmms-muted text-lg">
          Sistema de Gestão de Manutenção Fabril
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <span className="px-3 py-1.5 bg-cmms-danger/15 text-cmms-danger rounded text-sm font-medium">
            Corretiva
          </span>
          <span className="px-3 py-1.5 bg-cmms-warning/15 text-cmms-warning rounded text-sm font-medium">
            Preventiva
          </span>
          <span className="px-3 py-1.5 bg-cmms-success/15 text-cmms-success rounded text-sm font-medium">
            Operacional
          </span>
          <span className="px-3 py-1.5 bg-cmms-info/15 text-cmms-info rounded text-sm font-medium">
            Rotina
          </span>
        </div>
        <p className="text-cmms-muted/60 text-sm pt-6">
          Etapa 01 concluída — Monorepo & Ambiente configurados
        </p>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CockpitPCM from './pages/CockpitPCM';
import OperadorChamado from './pages/OperadorChamado';
import MantenedorPainel from './pages/MantenedorPainel';
import AlmoxarifadoPainel from './pages/AlmoxarifadoPainel';
import IndicadoresPainel from './pages/IndicadoresPainel';
import TotemQR from './pages/TotemQR';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Raiz aponta diretamente para o Vanguard Central (Cockpit PCM Desktop) */}
        <Route path="/" element={<Navigate to="/central" replace />} />
        <Route path="/central" element={<CockpitPCM />} />
        <Route path="/cockpit" element={<Navigate to="/central" replace />} />
        <Route path="/vanguard-central" element={<Navigate to="/central" replace />} />
        <Route path="/painel-manutencao" element={<Navigate to="/central" replace />} />

        {/* Totem de QR Codes (Exibição no Desktop) */}
        <Route path="/totem-qr" element={<TotemQR />} />
        <Route path="/simulador-qr" element={<Navigate to="/totem-qr" replace />} />
        <Route path="/placas-qr" element={<Navigate to="/totem-qr" replace />} />

        {/* Almoxarifado & Peças */}
        <Route path="/almoxarifado" element={<AlmoxarifadoPainel />} />
        <Route path="/estoque" element={<Navigate to="/almoxarifado" replace />} />
        <Route path="/pecas" element={<Navigate to="/almoxarifado" replace />} />

        {/* Indicadores & Métricas */}
        <Route path="/indicadores" element={<IndicadoresPainel />} />
        <Route path="/metricas" element={<Navigate to="/indicadores" replace />} />
        <Route path="/analytics" element={<Navigate to="/indicadores" replace />} />

        {/* Rotas Mobile (se acessadas diretamente no navegador) */}
        <Route path="/operador" element={<OperadorChamado />} />
        <Route path="/abrir-chamado" element={<OperadorChamado />} />
        <Route path="/abrir-chamado/:token" element={<OperadorChamado />} />
        <Route path="/mantenedor" element={<MantenedorPainel />} />
        <Route path="/tecnico" element={<MantenedorPainel />} />

        {/* Fallback sempre direciona para o Central */}
        <Route path="*" element={<Navigate to="/central" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import OperadorChamado from './pages/OperadorChamado';
import CockpitPCM from './pages/CockpitPCM';
import MantenedorPainel from './pages/MantenedorPainel';
import AlmoxarifadoPainel from './pages/AlmoxarifadoPainel';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/operador" element={<OperadorChamado />} />
        <Route path="/abrir-chamado" element={<OperadorChamado />} />
        <Route path="/abrir-chamado/:token" element={<OperadorChamado />} />
        <Route path="/cockpit" element={<CockpitPCM />} />
        <Route path="/painel-manutencao" element={<CockpitPCM />} />
        <Route path="/mantenedor" element={<MantenedorPainel />} />
        <Route path="/tecnico" element={<MantenedorPainel />} />
        <Route path="/almoxarifado" element={<AlmoxarifadoPainel />} />
        <Route path="/estoque" element={<AlmoxarifadoPainel />} />
        <Route path="/pecas" element={<AlmoxarifadoPainel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

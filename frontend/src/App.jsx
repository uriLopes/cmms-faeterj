import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import OperadorChamado from './pages/OperadorChamado';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/operador" element={<OperadorChamado />} />
        <Route path="/abrir-chamado" element={<OperadorChamado />} />
        <Route path="/abrir-chamado/:token" element={<OperadorChamado />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

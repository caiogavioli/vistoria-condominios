import { Navigate, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { Condominios } from './pages/Condominios'
import { CondominioEditor } from './pages/CondominioEditor'
import { HistoricoCondominio } from './pages/HistoricoCondominio'
import { NovaVistoria } from './pages/NovaVistoria'
import { VistoriaAreas } from './pages/VistoriaAreas'
import { AreaEditor } from './pages/AreaEditor'
import { Relatorio } from './pages/Relatorio'
import { Ajustes } from './pages/Ajustes'
import { Painel } from './pages/Painel'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/condominios" element={<Condominios />} />
      <Route path="/condominios/:id" element={<CondominioEditor />} />
      <Route path="/condominios/:id/historico" element={<HistoricoCondominio />} />
      <Route path="/vistorias/nova" element={<NovaVistoria />} />
      <Route path="/vistorias/:id" element={<VistoriaAreas />} />
      <Route path="/vistorias/:id/areas/:areaId" element={<AreaEditor />} />
      <Route path="/vistorias/:id/relatorio" element={<Relatorio />} />
      <Route path="/painel" element={<Painel />} />
      <Route path="/ajustes" element={<Ajustes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SolicitacoesPage } from './features/solicitacoes/pages/SolicitacoesPage';
import { NovaSolicitacaoPage } from './features/solicitacoes/pages/NovaSolicitacaoPage';
import { EditarSolicitacaoPage } from './features/solicitacoes/pages/EditarSolicitacaoPage';
import { SolicitacaoDetailPage } from './features/solicitacoes/pages/SolicitacaoDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SolicitacoesPage />} />
          <Route path="solicitacoes" element={<Navigate to="/" replace />} />
          <Route path="solicitacoes/nova" element={<NovaSolicitacaoPage />} />
          <Route path="solicitacoes/:id" element={<SolicitacaoDetailPage />} />
          <Route path="solicitacoes/:id/editar" element={<EditarSolicitacaoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

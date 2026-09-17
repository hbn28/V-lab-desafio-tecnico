import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SolicitacoesPage } from './features/solicitacoes/pages/SolicitacoesPage';
import { NovaSolicitacaoPage } from './features/solicitacoes/pages/NovaSolicitacaoPage';
import { SolicitacaoDetailPage } from './features/solicitacoes/pages/SolicitacaoDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/solicitacoes" replace />} />
          <Route path="solicitacoes" element={<SolicitacoesPage />} />
          <Route path="solicitacoes/nova" element={<NovaSolicitacaoPage />} />
          <Route path="solicitacoes/:id" element={<SolicitacaoDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

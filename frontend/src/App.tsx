import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProvedorAvisos } from './components/ui';
import { ProvedorLookups } from './lib/dados';
import { Painel } from './pages/Painel';
import { Ocorrencias } from './pages/Ocorrencias';
import { TaTurnos } from './pages/TaTurnos';
import { Cadastros } from './pages/Cadastros';

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorAvisos>
        <ProvedorLookups>
          <Layout>
            <Routes>
              <Route path="/" element={<Painel />} />
              <Route path="/ocorrencias" element={<Ocorrencias />} />
              <Route path="/ta" element={<TaTurnos />} />
              <Route path="/cadastros" element={<Cadastros />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ProvedorLookups>
      </ProvedorAvisos>
    </BrowserRouter>
  );
}

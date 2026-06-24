import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import USHomePage from './pages/USHomePage';
import StockDetailPage from './pages/StockDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/us" element={<USHomePage />} />
        <Route path="/stock/:id" element={<StockDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

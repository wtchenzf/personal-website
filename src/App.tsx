import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Tools from './pages/Tools';
import Investment from './pages/Investment';
import MarketCalendar from './pages/MarketCalendar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Navigation />
        <main className="page-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/investment" element={<Investment />} />
            <Route path="/calendar" element={<MarketCalendar />} />
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

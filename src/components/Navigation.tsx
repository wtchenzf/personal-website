import { NavLink } from 'react-router-dom';
import { Home, Wrench, TrendingUp, CalendarDays, Newspaper } from 'lucide-react';
import './Navigation.css';

export default function Navigation() {
  return (
    <nav className="nav-container">
      <div className="nav-content">
        <div className="nav-brand">
          <span className="nav-logo">William Chen</span>
          <span className="nav-subtitle">AI & Tech Sharing</span>
        </div>

        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Home size={18} />
            <span>首頁</span>
          </NavLink>
          <NavLink to="/tools" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Wrench size={18} />
            <span>好用工具</span>
          </NavLink>
          <NavLink to="/investment" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <TrendingUp size={18} />
            <span>投資</span>
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <CalendarDays size={18} />
            <span>行事曆</span>
          </NavLink>
          <NavLink to="/news" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Newspaper size={18} />
            <span>財經新聞</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

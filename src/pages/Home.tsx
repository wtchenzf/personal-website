import './Home.css';

export default function Home() {
  return (
    <div className="home-page animate-fade-in">
      <p className="home-greeting animate-delay-100 animate-fade-in">Welcome</p>
      
      <h1 className="home-title animate-delay-200 animate-fade-in">
        William<br />
        <em>Chen</em>
      </h1>

      <div className="home-divider animate-delay-200 animate-fade-in" />

      <p className="home-subtitle animate-delay-300 animate-fade-in">
        AI 技術探索者 · 軟體工程師<br />
        以技術化繁為簡，用 AI 創造價值
      </p>

      <div className="home-tags animate-delay-300 animate-fade-in">
        <span className="home-tag">AI Engineering</span>
        <span className="home-tag">React</span>
        <span className="home-tag">Investment</span>
        <span className="home-tag">台灣</span>
      </div>
    </div>
  );
}

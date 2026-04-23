import { BookOpen, Presentation, FileText } from 'lucide-react';
import './Tools.css';

const tools = [
  {
    id: 'english-tutor',
    number: '01',
    name: 'AI English Tutor',
    description: '專為兒童與成人設計的英語學習 App。AI 家教模擬真實情境對話，提供即時語法糾正、重點單字萃取與文字轉語音，幫助使用者快速提升口說與閱讀能力。',
    icon: <BookOpen size={28} strokeWidth={1.5} />,
    link: '#',   // 請替換為實際 URL
    tags: ['React', 'Gemini AI', 'Text-to-Speech', 'Roleplay'],
  },
  {
    id: 'ppt-wording',
    number: '02',
    name: 'PPT Wording AI',
    description: '一鍵將靜態簡報圖片轉換為可編輯的 PowerPoint 檔案。自動識別排版、字體大小與對齊方式，具備智慧縮放機制以防止文字溢出版面。',
    icon: <Presentation size={28} strokeWidth={1.5} />,
    link: '#',   // 請替換為實際 URL
    tags: ['React', 'Gemini 1.5 Flash', 'PptxGenJS', 'OCR'],
  },
  {
    id: 'paper-to-slide',
    number: '03',
    name: 'Paper-to-Slide AI',
    description: '學術論文一鍵轉簡報。剖析 PDF 論文後自動生成符合 16:9 專業比例的結構化講題簡報，支援動態模型備援確保高可用性。',
    icon: <FileText size={28} strokeWidth={1.5} />,
    link: '#',   // 請替換為實際 URL
    tags: ['PDF Parsing', 'Layout AI', 'Gemini', 'PPTX'],
  },
];

export default function Tools() {
  return (
    <div className="animate-fade-in">
      <div className="tools-header">
        <span className="tools-eyebrow">Portfolio</span>
        <h1 className="section-title">好用工具</h1>
        <p className="tools-subtitle">
          結合最先進的 AI 模型，打造的個人化自動化解決方案
        </p>
      </div>

      <div className="grid-3 animate-delay-200 animate-fade-in">
        {tools.map((tool) => (
          <div key={tool.id} className="card tool-card">
            <span className="tool-number">{tool.number}</span>
            <div className="tool-icon-wrapper">{tool.icon}</div>
            <h3 className="tool-title">{tool.name}</h3>
            <p className="tool-desc">{tool.description}</p>
            <div className="tool-tags">
              {tool.tags.map((tag) => (
                <span key={tag} className="tool-tag">{tag}</span>
              ))}
            </div>
            <a
              href={tool.link}
              className="tool-link-btn"
              target="_blank"
              rel="noreferrer"
            >
              開啟工具 →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

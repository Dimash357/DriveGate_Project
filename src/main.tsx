import { createRoot } from 'react-dom/client'; import { App } from './ui/App'; 
import './ui/styles.css'; 
createRoot(document.getElementById('root')!).render(<App />); 

if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
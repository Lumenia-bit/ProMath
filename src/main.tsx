import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'katex/dist/katex.min.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/global.css';
import './styles/keyboard.css';
import './styles/solution.css';
import './styles/history.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

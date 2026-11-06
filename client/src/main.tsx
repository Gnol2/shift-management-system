import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ToastProvider } from './ui';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></BrowserRouter>);

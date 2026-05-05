import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TV from './TV';
import ErrorBoundary from './ErrorBoundary';
import reportWebVitals from './reportWebVitals';

const isTV = typeof window !== 'undefined' && window.location.pathname === '/tv';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isTV ? <TV /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

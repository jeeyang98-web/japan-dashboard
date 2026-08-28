import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import {DataProvider} from './context/DataContext';import './style.css';import './brand.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><DataProvider><App/></DataProvider></React.StrictMode>);


import React from 'react';
import ReactDOM from 'react-dom/client';
import { BatchDataGenerator } from '../../components/BatchDataGenerator';
import '../../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BatchDataGenerator />
  </React.StrictMode>
);

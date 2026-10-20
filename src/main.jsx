import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// (StrictMode is intentionally omitted: its double-mount in dev would
// dispose and rebuild the GPU particle buffers and audio players.)
createRoot(document.getElementById('root')).render(<App />);

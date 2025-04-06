import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
// Import other page components here later, e.g.:
// import PostingInterface from './components/PostingInterface';

// Remove default Vite CSS import if not needed, or keep if base styles are useful
// import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* Define other routes here, e.g.: */}
      {/* <Route path="/app" element={<PostingInterface />} /> */}
      {/* Add a 404 Not Found route if desired */}
      {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
    </Routes>
  );
}

export default App;

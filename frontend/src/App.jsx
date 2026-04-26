import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RepoPage from './pages/RepoPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/repo/:repoId" element={<RepoPage />} />
      </Routes>
    </Router>
  );
}

export default App;








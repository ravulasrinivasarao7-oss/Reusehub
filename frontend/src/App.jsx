import { Route, Routes } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MaterialsPage from './pages/MaterialsPage.jsx';
import MaterialDetailPage from './pages/MaterialDetailPage.jsx';
import MaterialFormPage from './pages/MaterialFormPage.jsx';
import MyListingsPage from './pages/MyListingsPage.jsx';
import ComingSoonPage from './pages/ComingSoonPage.jsx';

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link rounded bg-green-700 px-3 py-2 text-white">
        Skip to main content
      </a>
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/materials" element={<ProtectedRoute><MaterialsPage /></ProtectedRoute>} />
          <Route path="/materials/new" element={<ProtectedRoute><MaterialFormPage mode="create" /></ProtectedRoute>} />
          <Route path="/materials/:id" element={<ProtectedRoute><MaterialDetailPage /></ProtectedRoute>} />
          <Route path="/materials/:id/edit" element={<ProtectedRoute><MaterialFormPage mode="edit" /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
          <Route path="*" element={<ComingSoonPage title="Page not found" notFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

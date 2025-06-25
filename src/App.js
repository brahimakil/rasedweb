import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme, darkTheme, GlobalStyles } from './themes';
import { getCurrentUser } from './utils/auth';
import { getFromLocalStorage, saveToLocalStorage } from './utils/storage';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import Login from './pages/admin/Login';
import Signup from './pages/admin/Signup';
import Dashboard from './pages/admin/Dashboard';
import News from './pages/admin/News';
import Favorites from './pages/admin/Favorites';
import Instagram from './pages/admin/Instagram';
import Profile from './pages/admin/Profile';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser();
      setIsAuthenticated(!!user);
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin" />;
  }

  return children;
};

// Public route component (redirects if logged in)
const PublicRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser();
      setIsAuthenticated(!!user);
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" />;
  }

  return children;
};

function App() {
  // Theme management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = getFromLocalStorage('rased_theme');
    return savedTheme === 'dark';
  });

  const toggleTheme = () => {
    const newThemeValue = !isDarkMode;
    setIsDarkMode(newThemeValue);
    saveToLocalStorage('rased_theme', newThemeValue ? 'dark' : 'light');
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <GlobalStyles />
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/admin" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/admin/signup" element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          } />
          
          {/* Protected routes with layout */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <MainLayout toggleTheme={toggleTheme} isDarkMode={isDarkMode}>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/news" element={
            <ProtectedRoute>
              <MainLayout toggleTheme={toggleTheme} isDarkMode={isDarkMode}>
                <News />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/favorites" element={
            <ProtectedRoute>
              <MainLayout toggleTheme={toggleTheme} isDarkMode={isDarkMode}>
                <Favorites />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/instagram" element={
            <ProtectedRoute>
              <MainLayout toggleTheme={toggleTheme} isDarkMode={isDarkMode}>
                <Instagram />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/profile" element={
            <ProtectedRoute>
              <MainLayout toggleTheme={toggleTheme} isDarkMode={isDarkMode}>
                <Profile />
              </MainLayout>
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;

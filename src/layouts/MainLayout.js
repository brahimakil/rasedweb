import React from 'react';
import styled from 'styled-components';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const MainContent = styled.main`
  flex: 1;
  margin-top: 60px;
  margin-left: 250px;
  padding: 2rem;
  transition: margin-left 0.3s ease;
  
  @media (max-width: 768px) {
    margin-left: 0;
  }
`;

const MainLayout = ({ children, toggleTheme, isDarkMode }) => {
  return (
    <LayoutContainer>
      <Header toggleTheme={toggleTheme} isDarkMode={isDarkMode} />
      <Sidebar />
      <MainContent>
        {children}
      </MainContent>
      <Footer />
    </LayoutContainer>
  );
};

export default MainLayout;

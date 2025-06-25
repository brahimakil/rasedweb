import React, { useState } from 'react';
import styled from 'styled-components';
import { NavLink } from 'react-router-dom';

const SidebarContainer = styled.aside`
  background-color: ${props => props.theme.sidebar.background};
  color: ${props => props.theme.sidebar.text};
  width: 250px;
  height: 100vh;
  position: fixed;
  top: 60px;
  left: ${props => props.isOpen ? '0' : '-250px'};
  transition: left 0.3s ease;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 999;
  padding-top: 1rem;

  @media (max-width: 768px) {
    left: ${props => props.isOpen ? '0' : '-250px'};
  }
`;

const ToggleButton = styled.button`
  position: fixed;
  top: 70px;
  left: ${props => props.isOpen ? '250px' : '10px'};
  z-index: 1000;
  background-color: ${props => props.theme.primary};
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: left 0.3s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  
  @media (min-width: 769px) {
    display: none;
  }
`;

const NavItem = styled(NavLink)`
  display: block;
  padding: 1rem 1.5rem;
  color: ${props => props.theme.sidebar.text};
  text-decoration: none;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${props => props.theme.sidebar.activeItem};
  }
  
  &.active {
    background-color: ${props => props.theme.sidebar.activeItem};
    border-left: 4px solid ${props => props.theme.primary};
  }
`;

const SectionTitle = styled.h3`
  padding: 1rem 1.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  color: ${props => props.theme.secondary};
  font-weight: bold;
  margin-top: 1rem;
`;

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <ToggleButton isOpen={isOpen} onClick={toggleSidebar}>
        {isOpen ? '←' : '→'}
      </ToggleButton>
      <SidebarContainer isOpen={isOpen}>
        <NavItem to="/admin/dashboard" end>Dashboard</NavItem>
        
        <SectionTitle>Content</SectionTitle>
        <NavItem to="/admin/news">News</NavItem>
        <NavItem to="/admin/favorites">Favorite Articles</NavItem>
        
        <SectionTitle>Social Media</SectionTitle>
        <NavItem to="/admin/instagram">Instagram</NavItem>
        
        <SectionTitle>Settings</SectionTitle>
        <NavItem to="/admin/profile">Profile</NavItem>
      </SidebarContainer>
    </>
  );
};

export default Sidebar;

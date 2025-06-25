import React from 'react';
import styled from 'styled-components';

const FooterContainer = styled.footer`
  background-color: ${props => props.theme.footer.background};
  color: ${props => props.theme.footer.text};
  padding: 1rem 2rem;
  text-align: center;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
`;

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <FooterContainer>
      <p>&copy; {currentYear} RASED. All rights reserved.</p>
    </FooterContainer>
  );
};

export default Footer;

import { createGlobalStyle } from 'styled-components';

// Theme variables
export const lightTheme = {
  primary: '#007bff',
  secondary: '#6c757d',
  background: '#f8f9fa',
  surface: '#ffffff',
  text: '#212529',
  border: '#dee2e6',
  error: '#dc3545',
  success: '#4caf50',
  warning: '#ffc107',
  info: '#17a2b8',
  sidebar: {
    background: '#ffffff',
    activeItem: '#f0f0f0',
    text: '#212529',
  },
  header: {
    background: '#ffffff',
    text: '#212529',
  },
  footer: {
    background: '#f8f9fa',
    text: '#6c757d',
  }
};

export const darkTheme = {
  primary: '#0d6efd',
  secondary: '#495057',
  background: '#212529',
  surface: '#343a40',
  text: '#f8f9fa',
  border: '#495057',
  error: '#dc3545',
  success: '#81c784',
  warning: '#ffc107',
  info: '#17a2b8',
  sidebar: {
    background: '#343a40',
    activeItem: '#495057',
    text: '#f8f9fa',
  },
  header: {
    background: '#343a40',
    text: '#f8f9fa',
  },
  footer: {
    background: '#212529',
    text: '#adb5bd',
  }
};

// Global styles
export const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
    background-color: ${props => props.theme.background};
    color: ${props => props.theme.text};
    transition: all 0.3s ease;
  }

  a {
    text-decoration: none;
    color: ${props => props.theme.primary};
  }

  button {
    cursor: pointer;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    transition: all 0.2s ease;
    background-color: ${props => props.theme.primary};
    color: white;
    
    &:hover {
      opacity: 0.9;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  input, select, textarea {
    padding: 8px 16px;
    border-radius: 4px;
    border: 1px solid ${props => props.theme.border};
    background-color: ${props => props.theme.surface};
    color: ${props => props.theme.text};
    
    &:focus {
      outline: none;
      border-color: ${props => props.theme.primary};
    }
  }
`;

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getCurrentUser } from '../../utils/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const ProfileContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 2rem;
`;

const ProfileHeader = styled.div`
  margin-bottom: 2rem;
`;

const ProfileTitle = styled.h1`
  font-size: 2rem;
  color: ${props => props.theme.text};
  margin-bottom: 0.5rem;
`;

const ProfileSubtitle = styled.p`
  color: ${props => props.theme.secondary};
  font-size: 1rem;
`;

const Section = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  overflow: hidden;
`;

const SectionHeader = styled.div`
  background-color: ${props => props.theme.primary};
  color: white;
  padding: 1rem 1.5rem;
  font-size: 1.2rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SectionContent = styled.div`
  padding: 1.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: ${props => props.theme.text};
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text};
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 2px ${props => props.theme.primary}20;
  }
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
  
  &:disabled {
    background-color: ${props => props.theme.background};
    color: ${props => props.theme.text};
    opacity: 0.7;
    cursor: not-allowed;
    border-color: ${props => props.theme.border};
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text};
  font-size: 1rem;
  min-height: 100px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 2px ${props => props.theme.primary}20;
  }
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
  
  &:disabled {
    background-color: ${props => props.theme.background};
    color: ${props => props.theme.text};
    opacity: 0.7;
    cursor: not-allowed;
    border-color: ${props => props.theme.border};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(Button)`
  background-color: ${props => props.theme.primary};
  color: white;
  border: none;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const SecondaryButton = styled(Button)`
  background-color: transparent;
  color: ${props => props.theme.primary};
  border: 1px solid ${props => props.theme.primary};
  
  &:hover:not(:disabled) {
    background-color: ${props => props.theme.primary}10;
  }
`;

const TestButton = styled(Button)`
  background-color: ${props => props.theme.success};
  color: white;
  border: none;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const StatusMessage = styled.div`
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-weight: 500;
  
  &.success {
    background-color: ${props => props.theme.success}20;
    color: ${props => props.theme.success};
    border: 1px solid ${props => props.theme.success}40;
  }
  
  &.error {
    background-color: ${props => props.theme.error}20;
    color: ${props => props.theme.error};
    border: 1px solid ${props => props.theme.error}40;
  }
  
  &.info {
    background-color: ${props => props.theme.primary}20;
    color: ${props => props.theme.primary};
    border: 1px solid ${props => props.theme.primary}40;
  }
`;

const InfoBox = styled.div`
  background-color: ${props => props.theme.primary}10;
  border: 1px solid ${props => props.theme.primary}30;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  
  h4 {
    margin: 0 0 0.5rem 0;
    color: ${props => props.theme.primary};
  }
  
  p {
    margin: 0;
    color: ${props => props.theme.text};
    font-size: 0.9rem;
    line-height: 1.5;
  }
  
  a {
    color: ${props => props.theme.primary};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [testPrompt, setTestPrompt] = useState('Hello, can you tell me a short joke?');
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);
        
        // Load user profile data from Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setGeminiApiKey(userData.geminiApiKey || '');
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setStatusMessage({
        type: 'error',
        message: 'Failed to load profile data. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      setStatusMessage({ type: '', message: '' });
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const profileData = {
        email: user.email,
        geminiApiKey: geminiApiKey,
        updatedAt: new Date().toISOString()
      };
      
      if (userDoc.exists()) {
        await updateDoc(userDocRef, profileData);
      } else {
        await setDoc(userDocRef, {
          ...profileData,
          createdAt: new Date().toISOString()
        });
      }
      
      setStatusMessage({
        type: 'success',
        message: 'Profile saved successfully!'
      });
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setStatusMessage({ type: '', message: '' });
      }, 3000);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      setStatusMessage({
        type: 'error',
        message: 'Failed to save profile. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const loadAvailableModels = async () => {
    if (!geminiApiKey.trim()) return;
    
    try {
      setLoadingModels(true);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
      
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        setAvailableModels(models);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const testGeminiApi = async () => {
    if (!geminiApiKey.trim()) {
      setStatusMessage({
        type: 'error',
        message: 'Please enter a Gemini API key first.'
      });
      return;
    }
    
    if (!testPrompt.trim()) {
      setStatusMessage({
        type: 'error',
        message: 'Please enter a test prompt.'
      });
      return;
    }
    
    try {
      setTesting(true);
      setStatusMessage({ type: '', message: '' });
      
      // Test the Gemini API with the selected model
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: testPrompt
            }]
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }
      
      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
      
      setStatusMessage({
        type: 'success',
        message: `✅ API Test Successful!\n\nModel: ${selectedModel}\nResponse: ${generatedText}`
      });
      
    } catch (error) {
      console.error('Error testing Gemini API:', error);
      setStatusMessage({
        type: 'error',
        message: `❌ API Test Failed: ${error.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const clearApiKey = () => {
    setGeminiApiKey('');
    setStatusMessage({
      type: 'info',
      message: 'API key cleared. Remember to save to persist changes.'
    });
  };

  if (loading) {
    return (
      <ProfileContainer>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <LoadingSpinner />
        </div>
      </ProfileContainer>
    );
  }

  return (
    <ProfileContainer>
      <ProfileHeader>
        <ProfileTitle>Profile Settings</ProfileTitle>
        <ProfileSubtitle>Manage your account settings and API configurations</ProfileSubtitle>
      </ProfileHeader>

      {statusMessage.message && (
        <StatusMessage className={statusMessage.type}>
          {statusMessage.message.split('\n').map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </StatusMessage>
      )}

      <Section>
        <SectionHeader>
          👤 Account Information
        </SectionHeader>
        <SectionContent>
          <FormGroup>
            <Label>Email Address</Label>
            <Input 
              type="email" 
              value={user?.email || ''} 
              disabled 
              placeholder="Loading email..."
            />
          </FormGroup>
          <FormGroup>
            <Label>User ID</Label>
            <Input 
              type="text" 
              value={user?.uid || ''} 
              disabled 
              placeholder="Loading user ID..."
            />
          </FormGroup>
        </SectionContent>
      </Section>

      <Section>
        <SectionHeader>
          🤖 Gemini AI Configuration
        </SectionHeader>
        <SectionContent>
          <InfoBox>
            <h4>How to get your Gemini API Key:</h4>
            <p>
              1. Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a><br/>
              2. Sign in with your Google account<br/>
              3. Click "Create API Key" button<br/>
              4. Copy the generated API key and paste it below<br/>
              5. Test the API to ensure it's working correctly
            </p>
          </InfoBox>
          
          <FormGroup>
            <Label>Gemini API Key</Label>
            <Input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Enter your Gemini API key (e.g., AIzaSyC...)"
            />
          </FormGroup>

          <FormGroup>
            <Label>Test Prompt</Label>
            <TextArea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a test prompt to verify your API key works..."
            />
          </FormGroup>

          <FormGroup>
            <Label>Model Selection</Label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '4px',
                border: `1px solid var(--theme-border)`,
                backgroundColor: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                fontSize: '1rem'
              }}
            >
              <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              <option value="gemini-pro">gemini-pro (Legacy)</option>
            </select>
          </FormGroup>

          <ButtonGroup>
            <TestButton 
              onClick={testGeminiApi} 
              disabled={testing || !geminiApiKey.trim()}
            >
              {testing ? <LoadingSpinner /> : '🧪'} {testing ? 'Testing...' : 'Test API'}
            </TestButton>
            <SecondaryButton onClick={clearApiKey}>
              🗑️ Clear Key
            </SecondaryButton>
          </ButtonGroup>
        </SectionContent>
      </Section>

      <Section>
        <SectionHeader>
          💾 Save Changes
        </SectionHeader>
        <SectionContent>
          <p style={{ color: 'var(--theme-secondary)', marginBottom: '1rem' }}>
            Save your profile settings to persist changes across sessions.
          </p>
          <ButtonGroup>
            <PrimaryButton onClick={saveProfile} disabled={saving}>
              {saving ? <LoadingSpinner /> : '💾'} {saving ? 'Saving...' : 'Save Profile'}
            </PrimaryButton>
          </ButtonGroup>
        </SectionContent>
      </Section>
    </ProfileContainer>
  );
};

export default Profile; 
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  fetchInstagramProfile, 
  getSavedInstagramProfiles, 
  saveInstagramProfile,
  deleteInstagramProfile,
  saveInstagramContentToFirebase,
  getInstagramContentFromFirebase,
  saveInstagramProfileToFirebase,
  IG_PROFILES_STORAGE_KEY
} from '../../utils/socialMedia';
import { getFromLocalStorage, saveToLocalStorage } from '../../utils/storage';
import { collection, getDocs, doc } from 'firebase/firestore';
import { db } from '../../firebase';

const InstagramContainer = styled.div`
  padding-bottom: 2rem;
`;

const InstagramHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
`;

const InstagramTitle = styled.h1`
  font-size: 2rem;
  color: ${props => props.theme.text};
`;

const UsernameForm = styled.form`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  align-items: flex-end;
  background-color: ${props => props.theme.surface};
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 200px;
  
  @media (max-width: 768px) {
    min-width: auto;
  }
`;

const FormLabel = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.secondary};
  font-weight: 500;
`;

const FormInput = styled.input`
  padding: 0.75rem 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.inputBackground};
  color: ${props => props.theme.text};
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
  }
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
`;

const ActionButton = styled.button`
  padding: ${props => props.size === 'small' ? '0.5rem 0.75rem' : '0.75rem 1.5rem'};
  border-radius: 4px;
  background-color: ${props => 
    props.variant === 'danger' ? props.theme.error :
    props.variant === 'secondary' ? props.theme.secondary :
    props.variant === 'success' ? '#28a745' :
    props.variant === 'warning' ? '#ffc107' :
    props.theme.primary
  };
  color: ${props => props.variant === 'warning' ? '#212529' : 'white'};
  border: none;
  font-weight: 500;
  font-size: ${props => props.size === 'small' ? '0.8rem' : '0.9rem'};
  cursor: pointer;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex: ${props => props.fullWidth ? '1' : '0'};
  min-width: ${props => props.fullWidth ? '100%' : 'auto'};
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ProfilesContainer = styled.div`
  margin-top: 2rem;
`;

const ProfilesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ProfilesTitle = styled.h2`
  font-size: 1.5rem;
  color: ${props => props.theme.text};
`;

const ProfilesList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const ProfileCard = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 340px; /* Set a minimum height to ensure consistency */
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

const ProfileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const ProfilePic = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid ${props => props.theme.primary};
`;

const ProfileInfo = styled.div`
  flex: 1;
`;

const ProfileName = styled.h3`
  font-size: 1.25rem;
  margin: 0;
  color: ${props => props.theme.text};
`;

const ProfileLink = styled.a`
  font-size: 0.875rem;
  color: ${props => props.theme.secondary};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ProfileStats = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  flex: 1;
  min-width: 70px;
  text-align: center;
  background-color: ${props => props.theme.background};
  padding: 0.75rem 0.5rem;
  border-radius: 4px;
`;

const StatValue = styled.div`
  font-size: 1.25rem;
  font-weight: bold;
  color: ${props => props.theme.text};
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.secondary};
  margin-top: 0.25rem;
`;

const ProfileBio = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.text};
  margin-bottom: 1rem;
  line-height: 1.5;
`;

const ProfileActions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.5rem;
  grid-column: span 2;
`;

const ScanForm = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
`;

const FormInputSmall = styled.input`
  padding: 0.25rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.75rem;
  width: 50px;
  height: 28px;
  text-align: center;
`;

const TabsContainer = styled.div`
  margin-top: 2rem;
`;

const TabsHeader = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.border};
  margin-bottom: 1.5rem;
`;

const Tab = styled.button`
  padding: 0.75rem 1.5rem;
  background-color: transparent;
  border: none;
  border-bottom: 3px solid ${props => props.active ? props.theme.primary : 'transparent'};
  color: ${props => props.active ? props.theme.primary : props.theme.text};
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${props => props.theme.primary};
  }
`;

const PostsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
`;

const PostCard = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-4px);
  }
`;

const PostImage = styled.div`
  position: relative;
  height: 200px;
  background-color: ${props => props.theme.background};
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  
  &:hover img {
    transform: scale(1.05);
  }
`;

const PostType = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: ${props => props.isReel ? props.theme.error : props.type === 'carousel' ? props.theme.success : props.theme.primary};
  color: white;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 4px;
  font-weight: bold;
`;

const PostContent = styled.div`
  padding: 1rem;
`;

const PostDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.text};
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PostDate = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.secondary};
`;

const PostLink = styled.a`
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.theme.primary};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const NoResultsMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${props => props.theme.secondary};
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  grid-column: 1 / -1;
`;

const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  grid-column: 1 / -1;
  
  span {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid ${props => props.theme.primary};
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const FilterSelect = styled.select`
  padding: 0.75rem 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.inputBackground};
  color: ${props => props.theme.text};
  min-width: 180px;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
  }
`;

// Add these styled components for realtime loading indicator
const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
`;

const LoadingContent = styled.div`
  background-color: ${props => props.theme.surface};
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 90%;
  width: 400px;
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 5px solid ${props => props.theme.border};
  border-top-color: ${props => props.theme.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.div`
  font-size: 1rem;
  color: ${props => props.theme.text};
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background-color: ${props => props.theme.border};
  border-radius: 4px;
  margin-top: 1rem;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background-color: ${props => props.theme.primary};
  border-radius: 4px;
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const PrivateAccountBadge = styled.div`
  background-color: ${props => props.theme.error + '20'};
  color: ${props => props.theme.error};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  
  svg {
    margin-right: 0.25rem;
  }
`;

// Data URI placeholders that don't require network requests
const DEFAULT_PROFILE_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3e%3crect width=\'60\' height=\'60\' fill=\'%23cccccc\'/%3e%3ctext x=\'50%25\' y=\'50%25\' font-size=\'10\' text-anchor=\'middle\' alignment-baseline=\'middle\' font-family=\'sans-serif\' fill=\'%23666666\'%3eProfile%3c/text%3e%3c/svg%3e';

const ERROR_PROFILE_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3e%3crect width=\'60\' height=\'60\' fill=\'%23ffcccc\'/%3e%3ctext x=\'50%25\' y=\'50%25\' font-size=\'8\' text-anchor=\'middle\' alignment-baseline=\'middle\' font-family=\'sans-serif\' fill=\'%23cc0000\'%3eNo Image%3c/text%3e%3c/svg%3e';

const DEFAULT_POST_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 300 300\'%3e%3crect width=\'300\' height=\'300\' fill=\'%23eeeeee\'/%3e%3ctext x=\'50%25\' y=\'50%25\' font-size=\'18\' text-anchor=\'middle\' alignment-baseline=\'middle\' font-family=\'sans-serif\' fill=\'%23999999\'%3eNo Image%3c/text%3e%3c/svg%3e';

const ERROR_POST_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 300 300\'%3e%3crect width=\'300\' height=\'300\' fill=\'%23ffeeee\'/%3e%3ctext x=\'50%25\' y=\'50%25\' font-size=\'18\' text-anchor=\'middle\' alignment-baseline=\'middle\' font-family=\'sans-serif\' fill=\'%23cc0000\'%3eImage Error%3c/text%3e%3c/svg%3e';

// Instagram Page Component
const Instagram = () => {
  const [username, setUsername] = useState('');
  const [postLimit, setPostLimit] = useState(10);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [profileLimits, setProfileLimits] = useState({});
  
  // Load saved profiles on mount
  useEffect(() => {
    const init = async () => {
      await loadSavedProfiles();
    };
    
    init();
  }, []);
  
  // Handle adding a new username
  const handleAddUsername = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    // Validate username
    if (!validateInstagramUsername(username)) {
      alert('Please enter a valid Instagram username');
      return;
    }
    
    setLoading(true);
    setLoadingMessage(`Adding profile @${username}...`);
    setLoadingProgress(50);
    
    try {
      // Save the username to Firebase
      const result = await saveInstagramProfileToFirebase(username);
      
      setLoadingProgress(100);
      setLoadingMessage(`Profile @${username} added!`);
      
      // Create a basic profile object
      const basicProfileData = {
        username: username,
        profileUrl: `https://www.instagram.com/${username}/`,
        profilePicUrl: '',
        bio: 'Not scanned yet',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isScanned: false,
        firestoreId: result.docId,
        posts: [],
        savedToFirebase: false,
        lastUpdated: new Date().toISOString()
      };
      
      // Add to our saved profiles
      setSavedProfiles(prev => {
        // Check if profile already exists
        if (prev.some(p => p.username === username)) {
          return prev;
        }
        
        const updatedProfiles = [...prev, basicProfileData];
        
        // Update localStorage
        saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
        
        return updatedProfiles;
      });
      
      // Clear the input
      setUsername('');
      
      setTimeout(() => {
        setLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Error adding Instagram profile:', error);
      setLoadingMessage(`Error: ${error.message}`);
      setTimeout(() => {
        alert('Failed to add Instagram profile: ' + error.message);
        setLoading(false);
      }, 1000);
    }
  };
  
  // Handle deleting a profile
  const handleDeleteProfile = async (username) => {
    if (window.confirm(`Are you sure you want to delete @${username}?`)) {
      try {
        await deleteInstagramProfile(username);
        
        // Refresh the list
        const profiles = await getSavedInstagramProfiles();
        setSavedProfiles(profiles);
        
        // Clear current profile data if it matches the deleted one
        if (profileData && profileData.username === username) {
          setProfileData(null);
        }
      } catch (error) {
        console.error('Error deleting profile:', error);
        alert('Failed to delete profile: ' + error.message);
      }
    }
  };
  
  // Handle viewing a profile
  const handleViewProfile = async (profile) => {
    // If the profile hasn't been scanned yet, scan it first
    if (!profile.isScanned && (!profile.posts || profile.posts.length === 0)) {
      return handleScanProfile(profile);
    }
    
    setLoading(true);
    setLoadingMessage(`Loading posts for @${profile.username}...`);
    
    try {
      // First, check if we need to load posts from Firebase
      if (!profile.posts || profile.posts.length === 0 || profile.loadFromFirebase) {
        console.log('Loading posts from Firebase for:', profile.username);
        
        // Get the profile data from Firebase
        const firebaseProfiles = await getInstagramContentFromFirebase(profile.username);
        
        if (firebaseProfiles && firebaseProfiles.length > 0) {
          const firebaseProfile = firebaseProfiles[0];
          
          // Update our local profile with Firebase data
          profile = {
            ...profile,
            posts: firebaseProfile.posts || [],
            bio: firebaseProfile.bio || profile.bio,
            followersCount: firebaseProfile.followersCount || profile.followersCount,
            followingCount: firebaseProfile.followingCount || profile.followingCount,
            postsCount: firebaseProfile.postsCount || profile.postsCount,
            profilePicUrl: firebaseProfile.profilePicUrl || profile.profilePicUrl,
            isScanned: true,  // Mark as scanned since we have data
            loadFromFirebase: false
          };
          
          // Update the profile in our saved profiles list too
          setSavedProfiles(prevProfiles => {
            const updatedProfiles = prevProfiles.map(p => {
              if (p.username === profile.username) {
                return {
                  ...p,
                  posts: profile.posts,
                  bio: profile.bio,
                  followersCount: profile.followersCount,
                  followingCount: profile.followingCount,
                  postsCount: profile.postsCount,
                  profilePicUrl: profile.profilePicUrl,
                  isScanned: true,
                  loadFromFirebase: false
                };
              }
              return p;
            });
            
            // Update localStorage
            saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
            
            return updatedProfiles;
          });
        } else {
          console.warn('No profile found in Firebase for:', profile.username);
        }
      }
      
      // Make sure all posts have valid imageUrls
      if (profile.posts && profile.posts.length > 0) {
        profile.posts = profile.posts.map(post => {
          if (!post.imageUrl) {
            post.imageUrl = DEFAULT_POST_PLACEHOLDER;
          }
          return post;
        });
      }
      
      // Make sure profile has a valid profilePicUrl
      if (!profile.profilePicUrl) {
        profile.profilePicUrl = DEFAULT_PROFILE_PLACEHOLDER;
      }
      
      // Set the profile data for display
      setProfileData(profile);
    } catch (error) {
      console.error('Error loading profile data:', error);
      alert(`Error loading posts for @${profile.username}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle scanning all profiles
  const handleScanAllProfiles = async () => {
    if (savedProfiles.length === 0) {
      alert('No profiles to scan. Please add profiles first.');
      return;
    }
    
    setLoadingScan(true);
    setLoadingMessage('Starting scan...');
    setLoadingProgress(0);
    
    try {
      const updatedProfiles = [];
      const totalProfiles = savedProfiles.length;
      
      for (let i = 0; i < savedProfiles.length; i++) {
        const profile = savedProfiles[i];
        const progressPercent = Math.floor((i / totalProfiles) * 100);
        
        setLoadingProgress(progressPercent);
        setLoadingMessage(`Scanning profile ${i+1}/${totalProfiles}: @${profile.username}`);
        
        try {
          console.log(`Scanning profile: @${profile.username}`);
          const freshData = await fetchInstagramProfile(profile.username, postLimit);
          
          // Add isScanned flag
          const updatedProfile = {
            ...freshData,
            isScanned: true,
            savedToFirebase: false  // Reset saved status after fresh scan
          };
          
          // Save to localStorage
          await saveInstagramProfile(updatedProfile);
          
          // Save to Firebase
          await saveInstagramContentToFirebase(updatedProfile);
          
          // Mark as saved to Firebase
          updatedProfile.savedToFirebase = true;
          
          updatedProfiles.push(updatedProfile);
        } catch (error) {
          console.error(`Error scanning @${profile.username}:`, error);
          // Continue with next profile even if one fails
          updatedProfiles.push({
            ...profile,
            savedToFirebase: false  // Mark as not saved since scan failed
          });
        }
      }
      
      // Update progress to 100%
      setLoadingProgress(100);
      setLoadingMessage('Scan completed successfully!');
      
      // Update localStorage with the updated profiles
      saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
      
      // Refresh the list of saved profiles
      setSavedProfiles(updatedProfiles);
      
      // Short delay to show the completion message
      setTimeout(() => {
        alert('Scan completed successfully!');
        setLoadingScan(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error during scan:', error);
      setLoadingMessage(`Error: ${error.message}`);
      
      setTimeout(() => {
        alert('An error occurred during the scan. Some profiles may not have been updated.');
        setLoadingScan(false);
      }, 1000);
    }
  };
  
  // Handle saving profile to Firebase
  const handleSaveToFirebase = async (profile) => {
    try {
      await saveInstagramContentToFirebase(profile);
      
      // Update the saved status in state and localStorage
      setSavedProfiles(prevProfiles => {
        const updatedProfiles = prevProfiles.map(p => {
          if (p.username === profile.username) {
            return {
              ...p,
              savedToFirebase: true
            };
          }
          return p;
        });
        
        // Update in localStorage too
        saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
        
        return updatedProfiles;
      });
      
      alert(`Profile @${profile.username} saved to database!`);
    } catch (error) {
      console.error('Error saving to database:', error);
      alert('Failed to save to database: ' + error.message);
    }
  };
  
  // Define a helper function to create thumbnails without using external URLs
  const getPostImage = (post) => {
    // Create a function to show a thumbnail based on the post type
    if (post.isReel) {
      // Reel icon style
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#f0f0f0'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎬</div>
          <div>Instagram Reel</div>
        </div>
      );
    } else if (post.mediaType === 'carousel') {
      // Carousel icon style
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#f0f0f0'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
          <div>Carousel Post</div>
        </div>
      );
    } else {
      // Regular post icon style
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#f0f0f0'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
          <div>Instagram Post</div>
        </div>
      );
    }
  };
  
  // Filter posts based on active tab
  const getFilteredPosts = () => {
    if (!profileData || !profileData.posts) return [];
    
    // Then filter based on the active tab (simplified to just three categories)
    switch (activeTab) {
      case 'reels':
        return profileData.posts.filter(post => post.isReel);
      case 'carousels':
        return profileData.posts.filter(post => post.mediaType === 'carousel');
      case 'all':
      default:
        return profileData.posts;
    }
  };
  
  // Format large numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num;
  };

  // Add this function to validate Instagram usernames
  const validateInstagramUsername = (username) => {
    // Instagram usernames can contain letters, numbers, periods, and underscores
    // They cannot start with a period and they must be between 1 and 30 characters
    const regex = /^(?!.*\.\.)(?!.*\.$)[^\W][\w.]{0,29}$/;
    return regex.test(username);
  };

  // Add a new handler for just saving the username
  const handleSaveUsername = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Please enter an Instagram username');
      return;
    }
    
    if (!validateInstagramUsername(username)) {
      alert('Please enter a valid Instagram username');
      return;
    }
    
    setLoading(true);
    setLoadingMessage(`Saving username @${username}...`);
    setLoadingProgress(50);
    
    try {
      const result = await saveInstagramProfileToFirebase(username);
      
      setLoadingProgress(100);
      setLoadingMessage(result.message);
      
      // Short delay to show the completion message
      setTimeout(async () => {
        // Add the username to local storage too for immediate display
        const existingProfiles = getFromLocalStorage(IG_PROFILES_STORAGE_KEY) || [];
        
        // If the username doesn't already exist in local storage
        if (!existingProfiles.some(p => p.username === username)) {
          const basicProfileData = {
            username: username,
            profileUrl: `https://www.instagram.com/${username}/`,
            profilePicUrl: '',
            bio: 'Not scanned yet',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            isScanned: false,
            firestoreId: result.docId,
            posts: [],
            lastUpdated: new Date().toISOString()
          };
          
          existingProfiles.push(basicProfileData);
          saveToLocalStorage(IG_PROFILES_STORAGE_KEY, existingProfiles);
        }
        
        // Refresh the list of saved profiles
        await loadSavedProfiles(true);
        setUsername('');
        setLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Error saving Instagram username:', error);
      setLoadingMessage(`Error: ${error.message}`);
      setTimeout(() => {
        alert('Failed to save username: ' + error.message);
        setLoading(false);
      }, 1000);
    }
  };

  // Update the loadSavedProfiles function to use our new function
  const loadSavedProfiles = async (forceRefresh = false) => {
    try {
      // If we have profiles in localStorage and we're not forcing a refresh
      if (!forceRefresh) {
        const existingProfiles = getFromLocalStorage(IG_PROFILES_STORAGE_KEY);
        if (existingProfiles && existingProfiles.length > 0) {
          setSavedProfiles(existingProfiles);
          
          // Now check which profiles are fully saved in Firebase
          // We'll need to do this to properly display the "Saved to DB" status
          const profilesInFirebase = await getInstagramContentFromFirebase();
          const profilesMap = new Map();
          
          profilesInFirebase.forEach(profile => {
            profilesMap.set(profile.username, profile);
          });
          
          // Update the savedProfiles with the saved status
          const updatedProfiles = existingProfiles.map(profile => {
            const inFirebase = profilesMap.has(profile.username);
            return {
              ...profile,
              savedToFirebase: inFirebase
            };
          });
          
          // Save the updated profiles back to localStorage
          saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
          setSavedProfiles(updatedProfiles);
          return;
        }
      }
      
      // If we need to refresh or don't have cached data, fetch from Firebase
      try {
        const profiles = await getSavedInstagramProfiles();
        const profilesInFirebase = await getInstagramContentFromFirebase();
        
        // Create a map of profiles saved in Firebase for quick lookup
        const profilesMap = new Map();
        profilesInFirebase.forEach(profile => {
          profilesMap.set(profile.username, profile);
        });
        
        // Update profiles with their saved status
        const updatedProfiles = profiles.map(profile => {
          const inFirebase = profilesMap.has(profile.username);
          return {
            ...profile,
            savedToFirebase: inFirebase
          };
        });
        
        // Save to localStorage and state
        saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
        setSavedProfiles(updatedProfiles);
      } catch (error) {
        console.error('Error fetching profiles:', error);
        alert('Failed to load profiles: ' + error.message);
      }
    } catch (error) {
      console.error('Error loading saved profiles:', error);
    }
  };

  // Add a function to handle individual profile scans
  const handleScanProfile = async (profile) => {
    // Get the post limit for this profile, or use the default
    const limit = profileLimits[profile.username] || postLimit;
    
    setLoading(true);
    setLoadingMessage(`Scanning profile @${profile.username}...`);
    setLoadingProgress(20); // Start with 20%
    
    try {
      // Progress updates
      setTimeout(() => {
        setLoadingProgress(50);
        setLoadingMessage(`Retrieving profile data...`);
      }, 300);
      
      console.log(`Scanning profile: @${profile.username} with limit: ${limit}`);
      const freshData = await fetchInstagramProfile(profile.username, parseInt(limit, 10));
      
      // Process posts to ensure they all have imageUrls
      if (freshData.posts && freshData.posts.length > 0) {
        freshData.posts = freshData.posts.map(post => {
          // Ensure each post has an imageUrl
          if (!post.imageUrl) {
            post.imageUrl = DEFAULT_POST_PLACEHOLDER;
          }
          return post;
        });
      }
      
      // Ensure the profile has a profilePicUrl
      if (!freshData.profilePicUrl) {
        freshData.profilePicUrl = DEFAULT_PROFILE_PLACEHOLDER;
      }
      
      setLoadingProgress(80);
      setLoadingMessage(`Processing ${freshData.posts?.length || 0} posts...`);
      
      // Add isScanned flag and reset saved status
      const updatedProfile = {
        ...freshData,
        isScanned: true,
        savedToFirebase: false  // Reset saved status after fresh scan
      };
      
      // Save to localStorage
      await saveInstagramProfile(updatedProfile);
      
      // Save to Firebase
      await saveInstagramContentToFirebase(updatedProfile);
      
      setLoadingProgress(100);
      setLoadingMessage(`Profile @${profile.username} scanned successfully!`);
      
      // Update the saved profiles list
      setSavedProfiles(prevProfiles => {
        const updatedProfiles = prevProfiles.map(p => {
          if (p.username === profile.username) {
            return {
              ...updatedProfile,
              savedToFirebase: true
            };
          }
          return p;
        });
        
        // Update localStorage
        saveToLocalStorage(IG_PROFILES_STORAGE_KEY, updatedProfiles);
        
        return updatedProfiles;
      });
      
      // Short delay to show completion message
      setTimeout(() => {
        setLoading(false);
        // If the user was viewing this profile, update the view
        if (profileData && profileData.username === profile.username) {
          setProfileData(updatedProfile);
        }
      }, 500);
      
    } catch (error) {
      console.error(`Error scanning profile @${profile.username}:`, error);
      setLoadingMessage(`Error: ${error.message}`);
      setTimeout(() => {
        alert(`Failed to scan profile @${profile.username}: ${error.message}`);
        setLoading(false);
      }, 500);
    }
  };

  // Add a handler for updating post limits for individual profiles
  const handlePostLimitChange = (username, value) => {
    setProfileLimits(prev => ({
      ...prev,
      [username]: value
    }));
  };

  return (
    <InstagramContainer>
      <InstagramHeader>
        <InstagramTitle>Instagram</InstagramTitle>
      </InstagramHeader>
      
      <UsernameForm onSubmit={handleAddUsername}>
        <FormGroup>
          <FormLabel>Username</FormLabel>
          <FormInput 
            type="text" 
            placeholder="e.g. fcbarcelona" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </FormGroup>
        
        <FormGroup>
          <FormLabel>Default Post Limit</FormLabel>
          <FormInput 
            type="number" 
            min="1"
            max="50"
            value={postLimit}
            onChange={(e) => setPostLimit(e.target.value)}
          />
        </FormGroup>
        
        <ActionButton 
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Profile'}
        </ActionButton>
      </UsernameForm>
      
      {/* Loading overlay */}
      {(loading || loadingScan) && (
        <LoadingOverlay>
          <LoadingContent>
            <LoadingSpinner />
            <LoadingText>{loadingMessage}</LoadingText>
            <ProgressBar>
              <ProgressFill progress={loadingProgress} />
            </ProgressBar>
          </LoadingContent>
        </LoadingOverlay>
      )}
      
      <ProfilesContainer>
        <ProfilesHeader>
          <ProfilesTitle>Saved Profiles</ProfilesTitle>
          
          <ActionButton 
            onClick={handleScanAllProfiles} 
            disabled={loadingScan || savedProfiles.length === 0}
          >
            {loadingScan ? 'Scanning...' : 'Scan All Profiles'}
          </ActionButton>
        </ProfilesHeader>
        
        {savedProfiles.length === 0 ? (
          <NoResultsMessage>
            No profiles added yet. Add an Instagram profile above to get started.
          </NoResultsMessage>
        ) : (
          <ProfilesList>
            {savedProfiles.map(profile => (
              <ProfileCard key={profile.username}>
                <ProfileHeader>
                  <ProfilePic 
                    src={profile.profilePicUrl || DEFAULT_PROFILE_PLACEHOLDER} 
                    alt={profile.username}
                    onError={(e) => {
                      // Prevent infinite error loop by checking if already using error placeholder
                      if (e.target.src !== ERROR_PROFILE_PLACEHOLDER) {
                        e.target.src = ERROR_PROFILE_PLACEHOLDER;
                      }
                    }}
                  />
                  <ProfileInfo>
                    <ProfileName>@{profile.username}</ProfileName>
                    <ProfileLink href={profile.profileUrl} target="_blank" rel="noopener noreferrer">
                      View on Instagram
                    </ProfileLink>
                  </ProfileInfo>
                </ProfileHeader>
                
                <ProfileStats>
                  <StatItem>
                    <StatValue>{(profile.postsCount || 0).toLocaleString()}</StatValue>
                    <StatLabel>Posts</StatLabel>
                  </StatItem>
                  <StatItem>
                    <StatValue>{(profile.followersCount || 0).toLocaleString()}</StatValue>
                    <StatLabel>Followers</StatLabel>
                  </StatItem>
                  <StatItem>
                    <StatValue>{(profile.followingCount || 0).toLocaleString()}</StatValue>
                    <StatLabel>Following</StatLabel>
                  </StatItem>
                </ProfileStats>
                
                <ProfileBio>
                  {profile.bio?.substring(0, 120) || 'No bio available'}
                  {profile.bio?.length > 120 ? '...' : ''}
                </ProfileBio>
                
                <ProfileActions>
                  <ActionButton 
                    size="small"
                    onClick={() => handleViewProfile(profile)}
                  >
                    {!profile.isScanned && (!profile.posts || profile.posts.length === 0) 
                      ? 'Scan & View' 
                      : 'View Posts'}
                  </ActionButton>
                  
                  <ActionButton 
                    size="small"
                    variant={profile.savedToFirebase ? "success" : "secondary"}
                    onClick={() => handleSaveToFirebase(profile)}
                    disabled={profile.savedToFirebase}
                  >
                    {profile.savedToFirebase ? 'Saved ✓' : 'Save to DB'}
                  </ActionButton>
                  
                  <ActionRow>
                    <ScanForm>
                      <FormInputSmall
                        type="number"
                        min="1"
                        max="50"
                        value={profileLimits[profile.username] || postLimit}
                        onChange={(e) => handlePostLimitChange(profile.username, e.target.value)}
                        placeholder="#"
                      />
                      <ActionButton 
                        size="small"
                        variant="warning"
                        onClick={() => handleScanProfile(profile)}
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        Rescan
                      </ActionButton>
                    </ScanForm>
                  </ActionRow>
                  
                  <ActionRow>
                    <ActionButton 
                      size="small"
                      variant="danger" 
                      onClick={() => handleDeleteProfile(profile.username)}
                      fullWidth
                    >
                      Delete
                    </ActionButton>
                  </ActionRow>
                </ProfileActions>
              </ProfileCard>
            ))}
          </ProfilesList>
        )}
      </ProfilesContainer>
      
      {/* Only show posts section if we have a non-private profile selected */}
      {profileData && !profileData.isPrivate && (
        <TabsContainer>
          <ProfilesHeader>
            <ProfilesTitle>@{profileData.username}'s Posts</ProfilesTitle>
          </ProfilesHeader>
          
          <TabsHeader>
            <Tab 
              active={activeTab === 'all'} 
              onClick={() => setActiveTab('all')}
            >
              All Posts
            </Tab>
            <Tab 
              active={activeTab === 'reels'} 
              onClick={() => setActiveTab('reels')}
            >
              Reels
            </Tab>
            <Tab 
              active={activeTab === 'carousels'} 
              onClick={() => setActiveTab('carousels')}
            >
              Carousels
            </Tab>
          </TabsHeader>
          
          <PostsGrid>
            {getFilteredPosts().length === 0 ? (
              <NoResultsMessage>
                No posts found in this category.
              </NoResultsMessage>
            ) : (
              getFilteredPosts().map((post) => (
                <PostCard key={post.id}>
                  <PostImage>
                    <div 
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        background: '#f0f0f0'
                      }}
                      onClick={() => window.open(post.url, '_blank')}
                    >
                      {getPostImage(post)}
                    </div>
                    <PostType isReel={post.isReel} type={post.mediaType}>
                      {post.isReel ? 'Reel' : post.mediaType.charAt(0).toUpperCase() + post.mediaType.slice(1)}
                    </PostType>
                  </PostImage>
                  <PostContent>
                    <PostDescription>
                      {post.description || 'No description'}
                    </PostDescription>
                    {post.timestamp && (
                      <PostDate>
                        {new Date(post.timestamp).toLocaleString()}
                      </PostDate>
                    )}
                    <PostLink 
                      href={post.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      View on Instagram
                    </PostLink>
                  </PostContent>
                </PostCard>
              ))
            )}
          </PostsGrid>
        </TabsContainer>
      )}
      
      {/* Show a message if the profile is private */}
      {profileData && profileData.isPrivate && (
        <NoResultsMessage>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: '1rem' }}>
            <path d="M19 10h-1V7c0-3.9-3.1-7-7-7S4 3.1 4 7v3H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V12c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM6 7c0-3.3 2.7-6 6-6s6 2.7 6 6v3H6V7z" />
          </svg>
          <h3>This Account is Private</h3>
          <p>Posts from this account cannot be viewed as the account is set to private.</p>
        </NoResultsMessage>
      )}
    </InstagramContainer>
  );
};

export default Instagram; 
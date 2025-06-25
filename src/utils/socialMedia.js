import axios from 'axios';
import { saveToLocalStorage, getFromLocalStorage } from './storage';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc,
  updateDoc
} from 'firebase/firestore';

const API_URL = 'http://localhost:3000/api';
export const IG_PROFILES_STORAGE_KEY = 'rased_instagram_profiles';

// Fetch Instagram profile data
export const fetchInstagramProfile = async (username, limit = 10) => {
  try {
    const response = await axios.get(`${API_URL}/scraper/instagram`, {
      params: {
        url: `https://www.instagram.com/${username}/`,
        limit
      }
    });
    
    if (response.data.success) {
      // Check if the account is private
      const isPrivate = response.data.isPrivate || false;
      
      // Process posts only if the account is not private
      let processedPosts = [];
      
      if (!isPrivate && response.data.posts && Array.isArray(response.data.posts)) {
        processedPosts = response.data.posts.map(post => {
          // Ensure timestamp
          if (!post.timestamp || post.timestamp === '') {
            post = { ...post, timestamp: new Date().toISOString() };
          }
          
          // Process the imageUrl to handle Instagram's CORS restrictions
          // Create a proxy URL or a data URI instead of using the direct Instagram URL
          if (post.imageUrl && post.imageUrl.includes('instagram.fbey')) {
            post = {
              ...post,
              // Use the original URL as is, but also store it separately
              originalImageUrl: post.imageUrl,
              // Don't try to proxy it, as this would require backend changes
              imageUrl: post.imageUrl
            };
          } else if (!post.imageUrl) {
            // If no image URL at all, use a placeholder
            post = {
              ...post,
              imageUrl: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect fill="%23EEE" width="300" height="200"/%3E%3Ctext fill="%23AAA" font-family="sans-serif" font-size="18" dy=".3em" text-anchor="middle" x="150" y="100"%3ENo Image%3C/text%3E%3C/svg%3E'
            };
          }
          
          return post;
        });
      }
      
      // Update and return the processed data, including isPrivate flag
      const processedData = {
        ...response.data,
        posts: processedPosts,
        isPrivate: isPrivate,
        lastFetched: new Date().toISOString()
      };
      
      return processedData;
    } else {
      throw new Error('Failed to fetch Instagram profile data');
    }
  } catch (error) {
    console.error('Error fetching Instagram profile:', error);
    throw error;
  }
};

// Save profile data to localStorage
export const saveInstagramProfile = async (profileData) => {
  try {
    // Get existing profiles
    const existingProfiles = getFromLocalStorage(IG_PROFILES_STORAGE_KEY) || [];
    
    // Check if this profile already exists
    const existingIndex = existingProfiles.findIndex(p => p.username === profileData.username);
    
    if (existingIndex >= 0) {
      // Update existing profile
      existingProfiles[existingIndex] = {
        ...profileData,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new profile
      existingProfiles.push({
        ...profileData,
        lastUpdated: new Date().toISOString()
      });
    }
    
    // Save back to localStorage
    saveToLocalStorage(IG_PROFILES_STORAGE_KEY, existingProfiles);
    
    return true;
  } catch (error) {
    console.error('Error saving Instagram profile:', error);
    throw error;
  }
};

// Get all saved Instagram profiles
export const getSavedInstagramProfiles = () => {
  try {
    const profiles = getFromLocalStorage(IG_PROFILES_STORAGE_KEY) || [];
    return profiles;
  } catch (error) {
    console.error('Error getting saved Instagram profiles:', error);
    return [];
  }
};

// Delete a saved Instagram profile
export const deleteInstagramProfile = async (username) => {
  try {
    const profiles = getFromLocalStorage(IG_PROFILES_STORAGE_KEY) || [];
    const filteredProfiles = profiles.filter(p => p.username !== username);
    
    saveToLocalStorage(IG_PROFILES_STORAGE_KEY, filteredProfiles);
    
    return true;
  } catch (error) {
    console.error('Error deleting Instagram profile:', error);
    throw error;
  }
};

// Save just the Instagram profile username to Firebase
export const saveInstagramProfileToFirebase = async (username) => {
  try {
    // Check if this profile already exists in Firebase
    const q = query(
      collection(db, "instagram_profiles"),
      where("username", "==", username)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Profile already exists, return it
      return {
        success: true,
        message: `Profile @${username} already saved in database`,
        isNew: false,
        docId: querySnapshot.docs[0].id
      };
    } else {
      // Profile doesn't exist, create a new document with placeholder data
      const newProfileDoc = {
        username: username,
        profileUrl: `https://www.instagram.com/${username}/`,
        profilePicUrl: '', // Placeholder
        bio: 'Not scanned yet',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isScanned: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, "instagram_profiles"), newProfileDoc);
      
      return {
        success: true,
        message: `Profile @${username} saved to database`,
        isNew: true,
        docId: docRef.id
      };
    }
  } catch (error) {
    console.error('Error saving Instagram profile to Firebase:', error);
    throw error;
  }
};

// Get Instagram content from Firebase
export const getInstagramContentFromFirebase = async (username = null) => {
  try {
    let q;
    
    if (username) {
      // Get a specific profile
      q = query(
        collection(db, "instagram_content"),
        where("username", "==", username)
      );
    } else {
      // Get all profiles
      q = collection(db, "instagram_content");
    }
    
    const querySnapshot = await getDocs(q);
    const profiles = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      profiles.push({
        ...data,
        firestoreId: doc.id
      });
    });
    
    return profiles;
  } catch (error) {
    console.error('Error getting Instagram content from Firebase:', error);
    throw error;
  }
};

// Save Instagram content to Firebase with deduplication
export const saveInstagramContentToFirebase = async (profileData) => {
  try {
    // First, save/update the profile in instagram_profiles collection
    const profilesQuery = query(
      collection(db, "instagram_profiles"),
      where("username", "==", profileData.username)
    );
    
    const profilesSnapshot = await getDocs(profilesQuery);
    
    if (!profilesSnapshot.empty) {
      // Update the existing profile
      await updateDoc(doc(db, "instagram_profiles", profilesSnapshot.docs[0].id), {
        username: profileData.username,
        profileUrl: profileData.profileUrl,
        profilePicUrl: profileData.profilePicUrl || '',
        bio: profileData.bio || '',
        followersCount: profileData.followersCount || 0,
        followingCount: profileData.followingCount || 0,
        postsCount: profileData.postsCount || 0,
        isScanned: true,
        lastUpdated: new Date().toISOString()
      });
    } else {
      // Create a new profile document
      await addDoc(collection(db, "instagram_profiles"), {
        username: profileData.username,
        profileUrl: profileData.profileUrl,
        profilePicUrl: profileData.profilePicUrl || '',
        bio: profileData.bio || '',
        followersCount: profileData.followersCount || 0,
        followingCount: profileData.followingCount || 0,
        postsCount: profileData.postsCount || 0,
        isScanned: true,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }
    
    // Now continue with the existing function logic for instagram_content
    // Check if this profile already exists in instagram_content
    const q = query(
      collection(db, "instagram_content"),
      where("username", "==", profileData.username)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Profile exists, get the document
      const docSnapshot = querySnapshot.docs[0];
      const existingData = docSnapshot.data();
      
      // Create a map of existing post IDs for easy lookup
      const existingPostIds = new Set();
      if (existingData.posts && Array.isArray(existingData.posts)) {
        existingData.posts.forEach(post => existingPostIds.add(post.id));
      }
      
      // Filter out posts that already exist
      const newPosts = profileData.posts.filter(post => !existingPostIds.has(post.id));
      
      if (newPosts.length > 0) {
        // If we have new posts, append them to existing ones
        const updatedPosts = [
          ...(existingData.posts || []),
          ...newPosts
        ];
        
        // Update the document with new posts and profile data
        await updateDoc(doc(db, "instagram_content", docSnapshot.id), {
          username: profileData.username,
          profileUrl: profileData.profileUrl,
          profilePicUrl: profileData.profilePicUrl,
          bio: profileData.bio,
          followersCount: profileData.followersCount,
          followingCount: profileData.followingCount,
          postsCount: profileData.postsCount,
          posts: updatedPosts,
          lastUpdated: new Date().toISOString()
        });
        
        return {
          success: true,
          message: `Updated profile with ${newPosts.length} new posts`,
          newPosts: newPosts.length,
          totalPosts: updatedPosts.length
        };
      } else {
        // No new posts, just update profile info
        await updateDoc(doc(db, "instagram_content", docSnapshot.id), {
          username: profileData.username,
          profileUrl: profileData.profileUrl,
          profilePicUrl: profileData.profilePicUrl,
          bio: profileData.bio,
          followersCount: profileData.followersCount,
          followingCount: profileData.followingCount,
          postsCount: profileData.postsCount,
          lastUpdated: new Date().toISOString()
        });
        
        return {
          success: true,
          message: `Profile updated, no new posts found`,
          newPosts: 0,
          totalPosts: existingData.posts ? existingData.posts.length : 0
        };
      }
    } else {
      // Profile doesn't exist, create a new document
      const newProfileDoc = {
        username: profileData.username,
        profileUrl: profileData.profileUrl,
        profilePicUrl: profileData.profilePicUrl,
        bio: profileData.bio,
        followersCount: profileData.followersCount,
        followingCount: profileData.followingCount,
        postsCount: profileData.postsCount,
        posts: profileData.posts || [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, "instagram_content"), newProfileDoc);
      
      return {
        success: true,
        message: `Profile saved with ${profileData.posts ? profileData.posts.length : 0} posts`,
        newPosts: profileData.posts ? profileData.posts.length : 0,
        totalPosts: profileData.posts ? profileData.posts.length : 0,
        docId: docRef.id
      };
    }
  } catch (error) {
    console.error('Error saving Instagram content to Firebase:', error);
    throw error;
  }
};

// Delete Instagram content from Firebase
export const deleteInstagramContentFromFirebase = async (username) => {
  try {
    // Find the document
    const q = query(
      collection(db, "instagram_content"),
      where("username", "==", username)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        success: false,
        message: `Profile ${username} not found in database`
      };
    }
    
    // Delete all matching documents
    const deletePromises = [];
    querySnapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, "instagram_content", docSnapshot.id)));
    });
    
    await Promise.all(deletePromises);
    
    return {
      success: true,
      message: `Profile ${username} deleted from database`,
      deletedCount: deletePromises.length
    };
  } catch (error) {
    console.error('Error deleting Instagram content from Firebase:', error);
    throw error;
  }
}; 
import axios from 'axios';
import { saveToLocalStorage, getFromLocalStorage } from './storage';
import { 
  collection, 
  addDoc, 
  writeBatch, 
  doc, 
  getDocs, 
  query, 
  deleteDoc, 
  updateDoc, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCurrentUser } from './auth';

const API_URL = 'https://rasedbackend.onrender.com/api';
const NEWS_STORAGE_KEY = 'rased_news_data';
const LAST_FETCHED_KEY = 'rased_last_fetched';

// Add error handling state
let isFirebaseUnavailable = false;
let lastFirebaseError = null;

// Fetch all news with caching
export const fetchAllNews = async (forceRefresh = false) => {
  try {
    // Check if we have cached data and if we're not forcing a refresh
    if (!forceRefresh) {
      const cachedData = getFromLocalStorage(NEWS_STORAGE_KEY);
      
      // If we have cached data, return it
      if (cachedData) {
        console.log('Using cached news data from localStorage');
        
        // Still fetch saved status from Firebase
        const savedNewsMap = await getSavedNewsFromFirebase();
        
        // Mark saved articles in the cached data
        if (Object.keys(savedNewsMap).length > 0) {
          Object.keys(cachedData.articlesBySource).forEach(source => {
            cachedData.articlesBySource[source] = cachedData.articlesBySource[source].map(article => {
              if (savedNewsMap[article.id]) {
                return { ...article, isSaved: true };
              }
              return article;
            });
          });
        }
        
        return cachedData;
      }
    }
    
    // If no cached data or we're forcing a refresh, fetch from API
    console.log('Fetching fresh news data from API');
    const response = await axios.get(`${API_URL}/scraper/all-news/`);
    
    // Also get the saved news status from Firebase
    const savedNewsMap = await getSavedNewsFromFirebase();
    
    // Check if any of the newly fetched articles are already saved
    if (Object.keys(savedNewsMap).length > 0) {
      Object.keys(response.data.articlesBySource).forEach(source => {
        response.data.articlesBySource[source] = response.data.articlesBySource[source].map(article => {
          if (savedNewsMap[article.id]) {
            return { ...article, isSaved: true };
          }
          return article;
        });
      });
    }
    
    // Cache the data
    saveToLocalStorage(NEWS_STORAGE_KEY, response.data);
    saveToLocalStorage(LAST_FETCHED_KEY, new Date().toISOString());
    
    return response.data;
  } catch (error) {
    console.error("Error fetching news:", error);
    
    // In case of error, try to use cached data as fallback
    const cachedData = getFromLocalStorage(NEWS_STORAGE_KEY);
    if (cachedData) {
      console.log('Using cached news data after API error');
      return cachedData;
    }
    
    throw error;
  }
};

// Filter news by source
export const filterNewsBySource = async (source, forceRefresh = false) => {
  try {
    const allNews = await fetchAllNews(forceRefresh);
    if (source === 'all') return allNews;
    
    return {
      ...allNews,
      articlesBySource: {
        [source]: allNews.articlesBySource[source] || []
      }
    };
  } catch (error) {
    console.error("Error filtering news by source:", error);
    throw error;
  }
};

// Filter news by category
export const filterNewsByCategory = async (category, forceRefresh = false) => {
  try {
    const allNews = await fetchAllNews(forceRefresh);
    if (category === 'all') return allNews;
    
    const filteredNews = {};
    
    Object.keys(allNews.articlesBySource).forEach(source => {
      const articles = allNews.articlesBySource[source].filter(article => {
        return article.fullContent && 
               article.fullContent.category && 
               article.fullContent.category.includes(category);
      });
      
      if (articles.length > 0) {
        filteredNews[source] = articles;
      }
    });
    
    return {
      ...allNews,
      articlesBySource: filteredNews
    };
  } catch (error) {
    console.error("Error filtering news by category:", error);
    throw error;
  }
};

// Get all available news sources
export const getAllNewsSources = async (forceRefresh = false) => {
  try {
    const allNews = await fetchAllNews(forceRefresh);
    return Object.keys(allNews.articlesBySource);
  } catch (error) {
    console.error("Error getting news sources:", error);
    throw error;
  }
};

// Get all available news categories
export const getAllNewsCategories = async (forceRefresh = false) => {
  try {
    const allNews = await fetchAllNews(forceRefresh);
    const categories = new Set();
    
    Object.values(allNews.articlesBySource).forEach(articles => {
      articles.forEach(article => {
        if (article.fullContent && article.fullContent.category) {
          categories.add(article.fullContent.category);
        }
      });
    });
    
    return Array.from(categories);
  } catch (error) {
    console.error("Error getting news categories:", error);
    throw error;
  }
};

// Save a single news item
export const saveNewsItem = async (article) => {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      console.log('User not authenticated, cannot save article');
      throw new Error('Authentication required to save articles');
    }

    // First check if this article is already saved
    const savedNewsMap = await getSavedNewsFromFirebase();
    
    // If article is already saved, return it without saving again
    if (savedNewsMap[article.id]) {
      console.log("Article already saved, skipping:", article.id);
      return savedNewsMap[article.id];
    }
    
    // Otherwise, proceed with saving
    const articleToSave = {
      id: article.id,
      title: article.title,
      source: article.source,
      date: article.date,
      category: article.fullContent?.category || '',
      imageUrl: article.imageUrl,
      summary: article.fullContent?.plainTextContent?.substring(0, 200) || '',
      link: article.link || article.fullContent?.link || '',
      isSaved: true,
      savedAt: new Date().toISOString(),
      userId: user.uid // Add user ID for better security
    };
    
    // Save to Firebase
    const docRef = await addDoc(collection(db, "saved_news"), articleToSave);
    console.log("Document saved with ID:", docRef.id);
    
    return { ...articleToSave, firestoreId: docRef.id };
  } catch (error) {
    console.error("Error saving news item to Firebase:", error);
    throw error;
  }
};

// Save multiple news items
export const saveMultipleNewsItems = async (articles) => {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      console.log('User not authenticated, cannot save articles');
      throw new Error('Authentication required to save articles');
    }

    // Get all currently saved articles first
    const savedNewsMap = await getSavedNewsFromFirebase();
    
    // Create a batch write
    const batch = writeBatch(db);
    
    // Track new articles that were saved
    const newlySavedArticles = [];
    
    // Process each article
    articles.forEach(article => {
      // Skip if already saved
      if (savedNewsMap[article.id]) {
        console.log("Article already saved, skipping:", article.id);
        return;
      }
      
      // Create a clean object for saving
      const articleToSave = {
        id: article.id,
        title: article.title,
        source: article.source,
        date: article.date,
        category: article.fullContent?.category || '',
        imageUrl: article.imageUrl,
        summary: article.fullContent?.plainTextContent?.substring(0, 200) || '',
        link: article.link || article.fullContent?.link || '',
        isSaved: true,
        savedAt: new Date().toISOString(),
        userId: user.uid // Add user ID for better security
      };
      
      // Add to batch
      const newDocRef = doc(collection(db, "saved_news"));
      batch.set(newDocRef, articleToSave);
      
      // Add to our tracking
      newlySavedArticles.push({
        ...articleToSave,
        firestoreId: newDocRef.id
      });
    });
    
    // Only commit if there are new articles to save
    if (newlySavedArticles.length > 0) {
      await batch.commit();
      console.log(`${newlySavedArticles.length} new articles saved to Firebase`);
    } else {
      console.log("No new articles to save, all were already saved");
    }
    
    // Return the count of newly saved articles and previously saved ones
    return {
      newlySaved: newlySavedArticles.length,
      alreadySaved: articles.length - newlySavedArticles.length,
      total: articles.length
    };
  } catch (error) {
    console.error("Error saving multiple articles to Firebase:", error);
    throw error;
  }
};

// Get saved news items
export const getSavedNewsItems = async () => {
  try {
    const response = await axios.get(`${API_URL}/news/saved`);
    return response.data;
  } catch (error) {
    console.error("Error getting saved news items:", error);
    throw error;
  }
};

// Get all saved news articles from Firebase
export const getSavedNewsFromFirebase = async () => {
  // If Firebase was recently unavailable, don't retry immediately
  if (isFirebaseUnavailable && Date.now() - lastFirebaseError < 30000) { // 30 seconds
    return {};
  }

  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      console.log('User not authenticated, skipping Firebase fetch');
      return {};
    }

    // Get all documents from the saved_news collection
    const savedNewsRef = collection(db, "saved_news");
    const querySnapshot = await getDocs(query(savedNewsRef));
    
    // Create a map of saved articles by ID for easy lookup
    const savedNewsMap = {};
    querySnapshot.forEach((doc) => {
      const savedArticle = doc.data();
      // Use the article's original ID as the key
      if (savedArticle.id) {
        savedNewsMap[savedArticle.id] = {
          ...savedArticle,
          firestoreId: doc.id // Save Firestore document ID for potential updates
        };
      }
    });
    
    // Reset error state on success
    isFirebaseUnavailable = false;
    lastFirebaseError = null;
    
    return savedNewsMap;
  } catch (error) {
    console.error("Error fetching saved news from Firebase:", error);
    
    // Set error state to prevent spam
    isFirebaseUnavailable = true;
    lastFirebaseError = Date.now();
    
    return {}; // Return empty object in case of error
  }
};

// Add theme success color
export { LAST_FETCHED_KEY };

// Add a function to unsave (delete) a news item
export const unsaveNewsItem = async (articleId) => {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      console.log('User not authenticated, cannot unsave article');
      throw new Error('Authentication required to unsave articles');
    }

    // First, check if this article is saved and get its Firestore document ID
    const savedNewsMap = await getSavedNewsFromFirebase();
    
    // If article is not saved, there's nothing to do
    if (!savedNewsMap[articleId]) {
      console.log("Article not saved, cannot unsave:", articleId);
      return false;
    }
    
    // Get the Firestore document ID
    const firestoreId = savedNewsMap[articleId].firestoreId;
    
    // Delete the document
    await deleteDoc(doc(db, "saved_news", firestoreId));
    console.log("Article unsaved (deleted) with ID:", firestoreId);
    
    return true;
  } catch (error) {
    console.error("Error unsaving news item from Firebase:", error);
    throw error;
  }
};

// Add a function to unsave multiple news items
export const unsaveMultipleNewsItems = async (articleIds) => {
  try {
    // Get all currently saved articles first
    const savedNewsMap = await getSavedNewsFromFirebase();
    
    // Create a batch write for deleting
    const batch = writeBatch(db);
    
    // Track articles that were unsaved
    const unsavedArticles = [];
    const notSavedArticles = [];
    
    // Process each article ID
    articleIds.forEach(articleId => {
      // Skip if not saved
      if (!savedNewsMap[articleId]) {
        notSavedArticles.push(articleId);
        return;
      }
      
      // Get the Firestore document ID
      const firestoreId = savedNewsMap[articleId].firestoreId;
      
      // Add delete operation to batch
      batch.delete(doc(db, "saved_news", firestoreId));
      
      // Track unsaved article
      unsavedArticles.push(articleId);
    });
    
    // Only commit if there are articles to unsave
    if (unsavedArticles.length > 0) {
      await batch.commit();
      console.log(`${unsavedArticles.length} articles unsaved from Firebase`);
    } else {
      console.log("No articles to unsave, none were saved");
    }
    
    // Return counts
    return {
      unsaved: unsavedArticles.length,
      notSaved: notSavedArticles.length,
      total: articleIds.length
    };
  } catch (error) {
    console.error("Error unsaving multiple articles from Firebase:", error);
    throw error;
  }
};

// Auto-save all news articles to database
export const autoSaveNewsToDatabase = async (newsData) => {
  try {
    console.log('Auto-saving news articles to database...');
    
    // Get existing articles from database to check for duplicates
    const existingArticlesRef = collection(db, "news_articles");
    const existingSnapshot = await getDocs(existingArticlesRef);
    
    const existingArticleIds = new Set();
    existingSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.id) {
        existingArticleIds.add(data.id);
      }
    });

    const batch = writeBatch(db);
    let newArticlesCount = 0;
    
    // Process all articles from all sources
    Object.entries(newsData.articlesBySource).forEach(([source, articles]) => {
      articles.forEach(article => {
        // Skip if article already exists
        if (existingArticleIds.has(article.id)) {
          return;
        }

        // Prepare article for database
        const articleToSave = {
          id: article.id,
          title: article.title || '',
          source: article.source || source,
          date: article.date || new Date().toISOString(),
          category: article.fullContent?.category || '',
          imageUrl: getCorrectImageUrl(article),
          summary: extractSummary(article),
          link: article.link || article.fullContent?.link || '',
          fullContent: article.fullContent || {},
          processedContent: article.processedContent || '',
          processedImageUrl: article.processedImageUrl || '',
          isFavorited: false, // Default to not favorited
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Add to batch
        const newDocRef = doc(collection(db, "news_articles"));
        batch.set(newDocRef, articleToSave);
        newArticlesCount++;
      });
    });

    // Commit batch if there are new articles
    if (newArticlesCount > 0) {
      await batch.commit();
      console.log(`Auto-saved ${newArticlesCount} new articles to database`);
    } else {
      console.log('No new articles to save');
    }

    return {
      newArticles: newArticlesCount,
      totalProcessed: Object.values(newsData.articlesBySource).flat().length
    };

  } catch (error) {
    console.error('Error auto-saving news to database:', error);
    throw error;
  }
};

// Helper function to extract summary from article
const extractSummary = (article) => {
  if (article.processedContent) {
    return article.processedContent.substring(0, 300);
  }
  
  if (article.source === "almayadeen.net/politics" || 
      (article.source && article.source.includes("almayadeen.net"))) {
    if (article.fullContent?.fullArticle?.content) {
      const paragraphContent = article.fullContent.fullArticle.content
        .filter(item => item.type === "paragraph")
        .map(item => item.content)
        .join(" ");
      return paragraphContent.substring(0, 300);
    }
  }
  
  if (article.fullContent?.plainTextContent) {
    return article.fullContent.plainTextContent.substring(0, 300);
  }
  
  return '';
};

// Helper function to get correct image URL
const getCorrectImageUrl = (article) => {
  if (article.processedImageUrl) {
    return article.processedImageUrl;
  }
  
  if (article.source === "almayadeen.net/politics" || 
      (article.source && article.source.includes("almayadeen.net"))) {
    if (article.fullContent?.fullArticle?.mainImage?.url) {
      return article.fullContent.fullArticle.mainImage.url;
    }
  }
  
  if (article.fullContent?.mainImage || article.imageUrl) {
    return article.fullContent?.mainImage || article.imageUrl;
  }
  
  return 'https://via.placeholder.com/300x180?text=No+Image';
};

// Updated fetchNewsFromDatabase to ensure proper sorting by createdAt
export const fetchNewsFromDatabase = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('User not authenticated, cannot fetch news from database');
      return [];
    }

    // Query with orderBy createdAt descending (newest first) - ALWAYS
    const newsQuery = query(
      collection(db, 'news_articles'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc') // NEWEST ARTICLES ALWAYS AT TOP
    );
    
    const querySnapshot = await getDocs(newsQuery);
    const articles = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      articles.push({
        firestoreId: doc.id,
        ...data
      });
    });
    
    console.log(`📖 Fetched ${articles.length} articles from database, sorted by createdAt (newest first)`);
    return articles;
    
  } catch (error) {
    console.error('❌ Error fetching news from database:', error);
    return [];
  }
};

// Enhanced saveArticlesToDatabase - ensure new articles get CURRENT timestamp
const saveArticlesToDatabase = async (articles) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log(`💾 Saving ${articles.length} articles to database...`);
    
    // Double-check for duplicates at the database level before saving
    const existingArticles = await fetchNewsFromDatabase();
    const existingIds = new Set(existingArticles.map(article => article.id));
    
    // Filter out any articles that somehow made it here but already exist
    const trulyNewArticles = articles.filter(article => {
      if (existingIds.has(article.id)) {
        console.log(`🚫 BLOCKING duplicate save attempt for article: ${article.id}`);
        return false;
      }
      return true;
    });
    
    if (trulyNewArticles.length === 0) {
      console.log('✅ No articles to save - all were duplicates');
      return;
    }
    
    console.log(`💾 Actually saving ${trulyNewArticles.length} articles (${articles.length - trulyNewArticles.length} duplicates blocked)`);

    const batch = writeBatch(db);
    const currentTime = new Date().toISOString(); // CURRENT timestamp for NEW articles
    
    trulyNewArticles.forEach(article => {
      const articleRef = doc(collection(db, 'news_articles'));
      const articleData = {
        id: article.id,
        title: article.title || '',
        source: article.source || '',
        date: article.date || currentTime,
        url: article.url || '',
        imageUrl: getCorrectImageUrl(article),
        summary: extractSummary(article),
        fullContent: article.fullContent || null,
        processedContent: article.processedContent || '',
        category: article.category || article.fullContent?.category || '',
        userId: user.uid,
        createdAt: currentTime, // NEW articles get CURRENT timestamp = TOP position
        updatedAt: currentTime,
        isFavorited: false
      };
      
      batch.set(articleRef, articleData);
    });
    
    await batch.commit();
    console.log(`✅ Successfully saved ${trulyNewArticles.length} NEW articles to database with current timestamp: ${currentTime}`);
    console.log(`🔝 These new articles will appear at the TOP of the news feed!`);
  } catch (error) {
    console.error('❌ Error saving articles to database:', error);
    throw error;
  }
};

// Toggle favorite status of an article
export const toggleArticleFavorite = async (articleId, isFavorited) => {
  try {
    const newsRef = collection(db, "news_articles");
    const q = query(newsRef, where("id", "==", articleId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      await updateDoc(docRef, {
        isFavorited: isFavorited,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`Article ${articleId} ${isFavorited ? 'favorited' : 'unfavorited'}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error toggling article favorite:', error);
    throw error;
  }
};

// Get all favorited articles
export const getFavoritedArticles = async () => {
  try {
    const newsRef = collection(db, "news_articles");
    const q = query(newsRef, where("isFavorited", "==", true), orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const favoritedArticles = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      favoritedArticles.push({
        ...data,
        firestoreId: doc.id
      });
    });
    
    return favoritedArticles;
  } catch (error) {
    console.error('Error fetching favorited articles:', error);
    throw error;
  }
};

// Core function: Fetch from API, check DB for duplicates, return only new articles
export const fetchAndProcessNewArticles = async () => {
  try {
    console.log('🔄 Fetching fresh news from API...');
    
    // Step 1: Fetch fresh data from API
    const response = await axios.get(`${API_URL}/scraper/all-news/`);
    const apiArticles = [];
    
    // Flatten all articles from all sources
    Object.keys(response.data.articlesBySource).forEach(source => {
      response.data.articlesBySource[source].forEach(article => {
        apiArticles.push({
          ...article,
          source: source,
          fetchedAt: new Date().toISOString()
        });
      });
    });
    
    console.log(`📥 Fetched ${apiArticles.length} articles from API`);
    
    // CRITICAL FIX: Remove duplicates from API data BEFORE processing
    const uniqueApiArticles = removeDuplicatesFromArray(apiArticles);
    console.log(`🔧 Removed ${apiArticles.length - uniqueApiArticles.length} duplicate articles from API data`);
    
    // Step 2: Get existing articles from database
    const existingArticles = await fetchNewsFromDatabase();
    const existingIds = new Set(existingArticles.map(article => article.id));
    
    console.log(`💾 Found ${existingArticles.length} existing articles in database`);
    
    // Step 3: Filter out duplicates - only keep new articles
    const newArticles = uniqueApiArticles.filter(article => {
      const isNew = !existingIds.has(article.id);
      if (!isNew) {
        console.log(`⏭️ Skipping duplicate article: ${article.id} - ${article.title?.substring(0, 50)}...`);
      }
      return isNew;
    });
    
    console.log(`✨ Found ${newArticles.length} NEW articles to save (${uniqueApiArticles.length - newArticles.length} duplicates skipped)`);
    
    // Step 4: Save new articles to database
    let savedCount = 0;
    if (newArticles.length > 0) {
      try {
        const user = await getCurrentUser();
        if (user) {
          console.log(`💾 About to save ${newArticles.length} new articles to database...`);
          
          // Save in batches to avoid Firestore limits
          const batchSize = 10;
          for (let i = 0; i < newArticles.length; i += batchSize) {
            const batch = newArticles.slice(i, i + batchSize);
            await saveArticlesToDatabase(batch);
            savedCount += batch.length;
            console.log(`💾 Saved batch ${Math.floor(i/batchSize) + 1}: ${batch.length} articles`);
          }
          console.log(`✅ Successfully saved ${savedCount} NEW articles to database`);
        } else {
          console.log('⚠️ User not authenticated, articles not saved to database');
        }
      } catch (saveError) {
        console.error('❌ Error saving articles to database:', saveError);
      }
    } else {
      console.log('✅ No new articles to save - all articles already exist in database');
    }
    
    // Step 5: Get fresh data from database and ensure no duplicates
    const allArticlesFromDB = await fetchNewsFromDatabase();
    const uniqueArticlesFromDB = removeDuplicatesFromArray(allArticlesFromDB);
    
    console.log(`📊 Final result: ${uniqueArticlesFromDB.length} unique articles, ${newArticles.length} were new`);
    
    // Get all available sources from API
    const allAvailableSources = Object.keys(response.data.articlesBySource);
    console.log(`📋 All available sources:`, allAvailableSources);
    
    return {
      articles: uniqueArticlesFromDB, // Return unique articles only
      newArticlesCount: newArticles.length,
      totalArticlesCount: uniqueArticlesFromDB.length,
      lastFetched: new Date().toISOString(),
      availableSources: allAvailableSources,
      apiData: response.data
    };
    
  } catch (error) {
    console.error('❌ Error in fetchAndProcessNewArticles:', error);
    
    // Fallback: return existing articles from database
    try {
      const existingArticles = await fetchNewsFromDatabase();
      const uniqueExistingArticles = removeDuplicatesFromArray(existingArticles);
      console.log('🔄 Using fallback: returning unique existing articles from database');
      return {
        articles: uniqueExistingArticles,
        newArticlesCount: 0,
        totalArticlesCount: uniqueExistingArticles.length,
        lastFetched: new Date().toISOString(),
        availableSources: [...new Set(uniqueExistingArticles.map(a => a.source))],
        error: error.message
      };
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      throw error;
    }
  }
};

// NEW HELPER FUNCTION: Remove duplicates from array by ID
const removeDuplicatesFromArray = (articles) => {
  const seen = new Set();
  const uniqueArticles = [];
  
  articles.forEach(article => {
    if (article.id && !seen.has(article.id)) {
      seen.add(article.id);
      uniqueArticles.push(article);
    }
  });
  
  return uniqueArticles;
};

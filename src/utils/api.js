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
const ARTICLES_STORAGE_KEY = 'rased_articles_cache';

// Export cache duration constant
export const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Add error handling state
let isFirebaseUnavailable = false;
let lastFirebaseError = null;

// SMART CACHE FUNCTION: Check if cache is expired
const isCacheExpired = () => {
  const lastFetched = getFromLocalStorage(LAST_FETCHED_KEY);
  if (!lastFetched) return true;
  
  const lastFetchedTime = new Date(lastFetched).getTime();
  const now = new Date().getTime();
  const timeDiff = now - lastFetchedTime;
  
  console.log(`⏰ Cache age: ${Math.round(timeDiff / (1000 * 60))} minutes`);
  return timeDiff > CACHE_DURATION;
};

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

// NEW: Save articles to localStorage
export const saveArticlesToLocalStorage = (articles) => {
  try {
    saveToLocalStorage(ARTICLES_STORAGE_KEY, {
      articles: articles,
      timestamp: new Date().toISOString()
    });
    console.log(`💾 Saved ${articles.length} articles to localStorage`);
  } catch (error) {
    console.error('Error saving articles to localStorage:', error);
  }
};

// NEW: Load articles from localStorage
export const loadArticlesFromLocalStorage = () => {
  try {
    const cached = getFromLocalStorage(ARTICLES_STORAGE_KEY);
    if (cached && cached.articles) {
      console.log(`📖 Loaded ${cached.articles.length} articles from localStorage`);
      return cached.articles;
    }
    return [];
  } catch (error) {
    console.error('Error loading articles from localStorage:', error);
    return [];
  }
};

// FIXED: Fetch and process with localStorage caching
export const fetchAndProcessNewArticles = async (isRefresh = false) => {
  try {
    console.log(`🔄 ${isRefresh ? 'Refreshing' : 'Loading'} articles...`);
    
    // Step 1: Load existing articles from localStorage (instant)
    const existingArticlesFromCache = loadArticlesFromLocalStorage();
    
    // Step 2: If not refresh and we have cached articles, return them immediately
    if (!isRefresh && existingArticlesFromCache.length > 0) {
      console.log(`⚡ Using ${existingArticlesFromCache.length} cached articles (instant load)`);
      return {
        articles: existingArticlesFromCache,
        newArticlesCount: 0,
        totalArticlesCount: existingArticlesFromCache.length,
        lastFetched: new Date().toISOString(),
        availableSources: [...new Set(existingArticlesFromCache.map(a => a.source))],
        fromCache: true
      };
    }
    
    // Step 3: Fetch fresh API data
    const apiResult = await fetchAllNews(true); // Always force refresh for new data
    const apiArticles = [];
    
    // Flatten all articles from all sources
    Object.keys(apiResult.articlesBySource).forEach(source => {
      apiResult.articlesBySource[source].forEach(article => {
        apiArticles.push({
          ...article,
          source: source,
          fetchedAt: new Date().toISOString(),
          isFavorited: false,
          isSaved: false
        });
      });
    });
    
    console.log(`📥 Fetched ${apiArticles.length} articles from API`);
    
    // Step 4: Get existing articles from database
    const existingArticlesFromDB = await fetchNewsFromDatabase();
    console.log(`💾 Found ${existingArticlesFromDB.length} articles in database`);
    
    // Step 5: FIXED LOGIC - Combine ALL articles properly
    let allArticles = [];
    
    if (isRefresh) {
      // For refresh: start with cached articles, add new API articles
      const allExistingIds = new Set([
        ...existingArticlesFromCache.map(a => a.id),
        ...existingArticlesFromDB.map(a => a.id)
      ]);
      
      const newArticles = apiArticles.filter(article => !allExistingIds.has(article.id));
      console.log(`✨ Found ${newArticles.length} NEW articles for refresh`);
      
      // Save new articles to database
      if (newArticles.length > 0) {
        try {
          const user = await getCurrentUser();
          if (user) {
            console.log(`💾 Saving ${newArticles.length} new articles to database...`);
            const batchSize = 5;
            for (let i = 0; i < newArticles.length; i += batchSize) {
              const batch = newArticles.slice(i, i + batchSize);
              await saveArticlesToDatabase(batch);
            }
            console.log(`✅ Saved ${newArticles.length} new articles to database`);
          }
        } catch (saveError) {
          console.error('❌ Error saving new articles:', saveError);
        }
      }
      
      // Combine: existing cached + new articles
      allArticles = [...existingArticlesFromCache, ...newArticles];
      
    } else {
      // For initial load: prioritize DB articles (with user data), then add API articles
      const dbIds = new Set(existingArticlesFromDB.map(a => a.id));
      const apiOnlyArticles = apiArticles.filter(a => !dbIds.has(a.id));
      
      console.log(`🔗 Combining ${existingArticlesFromDB.length} DB articles + ${apiOnlyArticles.length} API-only articles`);
      
      // Combine: DB articles (with user data) + API-only articles
      allArticles = [...existingArticlesFromDB, ...apiOnlyArticles];
    }
    
    // Remove duplicates
    const uniqueArticles = removeDuplicatesFromArray(allArticles);
    
    // Step 6: Save ALL articles to localStorage
    saveArticlesToLocalStorage(uniqueArticles);
    
    const newCount = isRefresh ? 
      apiArticles.filter(a => !existingArticlesFromCache.some(cached => cached.id === a.id)).length :
      apiArticles.filter(a => !existingArticlesFromDB.some(db => db.id === a.id)).length;
    
    console.log(`📊 Total articles: ${uniqueArticles.length} (${existingArticlesFromCache.length} cached + ${newCount} new)`);
    
    return {
      articles: uniqueArticles,
      newArticlesCount: newCount,
      totalArticlesCount: uniqueArticles.length,
      lastFetched: new Date().toISOString(),
      availableSources: Object.keys(apiResult.articlesBySource),
      fromCache: false
    };
    
  } catch (error) {
    console.error('❌ Error in fetchAndProcessNewArticles:', error);
    
    // Fallback: return cached articles if available
    const cachedArticles = loadArticlesFromLocalStorage();
    if (cachedArticles.length > 0) {
      console.log('🔄 Using cached articles as fallback');
      return {
        articles: cachedArticles,
        newArticlesCount: 0,
        totalArticlesCount: cachedArticles.length,
        lastFetched: new Date().toISOString(),
        availableSources: [...new Set(cachedArticles.map(a => a.source))],
        error: error.message,
        fromCache: true
      };
    }
    
    throw error;
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

// ENHANCED: Smart refresh function
export const forceRefreshNews = async () => {
  console.log('🔄 Force refreshing news data...');
  
  // Clear cache first
  localStorage.removeItem(NEWS_STORAGE_KEY);
  localStorage.removeItem(LAST_FETCHED_KEY);
  
  // Fetch fresh data
  return await fetchAllNews(true);
};

// UTILITY: Check cache status
export const getCacheStatus = () => {
  const lastFetched = getFromLocalStorage(LAST_FETCHED_KEY);
  const isExpired = isCacheExpired();
  
  return {
    lastFetched,
    isExpired,
    ageInMinutes: lastFetched ? Math.round((new Date().getTime() - new Date(lastFetched).getTime()) / (1000 * 60)) : null,
    nextRefreshIn: lastFetched && !isExpired ? 
      Math.round((CACHE_DURATION - (new Date().getTime() - new Date(lastFetched).getTime())) / (1000 * 60)) : 0
  };
};

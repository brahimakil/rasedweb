import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { 
  fetchAllNews,
  fetchAllNewsWithAutoSave, 
  toggleArticleFavorite,
  fetchNewsFromDatabase,
  getAllNewsSources,
  getAllNewsCategories,
  saveNewsItem,
  saveMultipleNewsItems,
  fetchAndProcessNewArticles,
  forceRefreshNews,
  getCacheStatus,
  CACHE_DURATION
} from '../../utils/api';
import NewsCard from '../../components/NewsCard';
import { getCorrectImageUrl } from '../../utils/helpers';
import { saveToLocalStorage, getFromLocalStorage } from '../../utils/storage';
import { callGeminiApi } from '../../utils/gemini';
import { parseMultilingualDatesWithDeepSeek } from '../../utils/deepseek';

const NewsContainer = styled.div`
  padding-bottom: 2rem;
`;

const NewsHeader = styled.div`
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

const NewsTitle = styled.h1`
  font-size: 2rem;
  color: ${props => props.theme.text};
`;

const FiltersContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
`;

const FilterLabel = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.secondary};
  font-weight: 500;
`;

const Filter = styled.select`
  padding: 0.75rem 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text};
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
  }
`;

const NewsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
`;

const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  width: 100%;
  
  span {
    width: 3rem;
    height: 3rem;
    border: 4px solid ${props => props.theme.primary};
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

const NoResults = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${props => props.theme.secondary};
  font-size: 1.2rem;
`;

const ArticleModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background-color: ${props => props.theme.error};
  color: white;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  
  &:hover {
    opacity: 0.9;
  }
`;

const ArticleHeader = styled.div`
  padding: 2rem;
  border-bottom: 1px solid ${props => props.theme.border};
`;

const ArticleTitle = styled.h2`
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: ${props => props.theme.text};
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: ${props => props.theme.secondary};
`;

const ArticleBody = styled.div`
  padding: 2rem;
  
  img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }
`;

const ArticleText = styled.p`
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  color: ${props => props.theme.text};
  white-space: pre-line;
`;

const RefreshButton = styled.button`
  background-color: ${props => props.theme.primary};
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: ${props => props.theme.secondary};
    cursor: not-allowed;
  }
`;

const RefreshSpinner = styled.div`
  width: 1rem;
  height: 1rem;
  border: 2px solid white;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
`;

const ActionBar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const SelectionButton = styled.button`
  background-color: ${props => props.active ? props.theme.primary : 'transparent'};
  color: ${props => props.active ? 'white' : props.theme.primary};
  border: 1px solid ${props => props.theme.primary};
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease, color 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: ${props => props.theme.secondary};
    cursor: not-allowed;
  }
`;

const SaveAllButton = styled.button`
  background-color: ${props => props.theme.success};
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const UnsaveAllButton = styled.button`
  background-color: transparent;
  color: ${props => props.theme.error};
  border: 1px solid ${props => props.theme.error};
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease, color 0.2s ease;
  
  &:hover {
    background-color: ${props => props.theme.error + '20'};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SelectionInfo = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: ${props => props.theme.secondary};
`;

const KeywordFilterContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 300px;
  
  @media (max-width: 768px) {
    min-width: 100%;
  }
`;

const KeywordInputContainer = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const KeywordInput = styled.input`
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text};
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
  }
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
`;

const AddKeywordButton = styled.button`
  background-color: ${props => props.theme.primary};
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const KeywordTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const KeywordTag = styled.span`
  background-color: ${props => props.theme.primary};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 16px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const RemoveKeywordButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const ClearAllKeywordsButton = styled.button`
  background: none;
  border: 1px solid ${props => props.theme.error};
  color: ${props => props.theme.error};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  
  &:hover {
    background-color: ${props => props.theme.error + '20'};
  }
`;

const FilterSummary = styled.div`
  background-color: ${props => props.theme.surface};
  border: 1px solid ${props => props.theme.border};
  border-radius: 4px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
`;

const FilterSummaryText = styled.p`
  margin: 0;
  font-size: 0.9rem;
  color: ${props => props.theme.secondary};
`;

const ModeToggleButton = styled.button`
  background-color: ${props => props.theme.secondary};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  
  &:hover {
    opacity: 0.9;
  }
`;

// Add new styled components for AI filtering
const AIFilterContainer = styled.div`
  background-color: ${props => props.theme.surface};
  border: 2px solid ${props => props.theme.primary};
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const AIFilterHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  
  h3 {
    margin: 0;
    color: ${props => props.theme.primary};
    font-size: 1.2rem;
  }
`;

const AIFilterInputContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const AIFilterInput = styled.textarea`
  flex: 1;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text};
  font-size: 1rem;
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 2px ${props => props.theme.primary}20;
  }
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
`;

const AIFilterButton = styled.button`
  background: linear-gradient(135deg, ${props => props.theme.primary}, ${props => props.theme.success});
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  transition: opacity 0.2s ease;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ClearAIFilterButton = styled.button`
  background-color: transparent;
  color: ${props => props.theme.secondary};
  border: 1px solid ${props => props.theme.secondary};
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    background-color: ${props => props.theme.secondary}20;
  }
`;

const AIFilterStatus = styled.div`
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  
  &.processing {
    background-color: ${props => props.theme.primary}20;
    color: ${props => props.theme.primary};
    border: 1px solid ${props => props.theme.primary}40;
  }
  
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
`;

const AIFilterExamples = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background-color: ${props => props.theme.background};
  border-radius: 4px;
  border: 1px solid ${props => props.theme.border};
`;

const ExampleQuery = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.primary};
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.9rem;
  margin: 0.25rem 0;
  padding: 0;
  text-align: left;
  
  &:hover {
    opacity: 0.8;
  }
`;

// Add the LoadingSpinner styled component with the other styled components
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

// Add new styled component for Save All Results button
const AddAllToFavoritesButton = styled.button`
  background: linear-gradient(135deg, ${props => props.theme.success}, ${props => props.theme.primary});
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const FilterResultsActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: ${props => props.theme.surface};
  border: 1px solid ${props => props.theme.primary}40;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
`;

const FilterResultsInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const FilterResultsTitle = styled.h3`
  margin: 0;
  color: ${props => props.theme.primary};
  font-size: 1.1rem;
`;

const FilterResultsDescription = styled.p`
  margin: 0;
  color: ${props => props.theme.secondary};
  font-size: 0.9rem;
`;

// Update the styled component name and styling
const AddToFavoritesButton = styled.button`
  background: linear-gradient(135deg, ${props => props.theme.success}, ${props => props.theme.primary});
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: ${props => props.theme.secondary};
    cursor: not-allowed;
  }
`;

// Add the missing AutoRefreshToggle styled component
const AutoRefreshToggle = styled.button`
  background-color: ${props => props.active ? props.theme.success : props.theme.surface};
  color: ${props => props.active ? 'white' : props.theme.text};
  border: 1px solid ${props => props.active ? props.theme.success : props.theme.border};
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const News = () => {
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [lastAutoRefresh, setLastAutoRefresh] = useState(null);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [unsavingAll, setUnsavingAll] = useState(false);

  // Add keyword filter state
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [keywordMode, setKeywordMode] = useState('OR'); // 'OR' or 'AND'

  // Add AI filtering state
  const [aiFilterQuery, setAiFilterQuery] = useState('');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [aiFilteredArticles, setAiFilteredArticles] = useState([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiFilterStatus, setAiFilterStatus] = useState({ type: '', message: '' });

  // Add state for saving all results
  const [savingAllResults, setSavingAllResults] = useState(false);

  // Auto-refresh every minute
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60000); // 1 minute
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  // Add missing state
  const [availableSources, setAvailableSources] = useState([]);

  // Update state variable names
  const [addingToFavorites, setAddingToFavorites] = useState(false);
  const [addingAllToFavorites, setAddingAllToFavorites] = useState(false);

  // Add the missing state variables
  const [removingFromFavorites, setRemovingFromFavorites] = useState(false);

  // Add cache status state
  const [cacheStatus, setCacheStatus] = useState(null);

  // Auto-refresh every minute
  useEffect(() => {
    let interval;
    
    if (autoRefreshEnabled) {
      interval = setInterval(() => {
        console.log('🔄 Auto-refresh triggered');
        loadNewsData(false, true); // forceRefresh=false, isAutoRefresh=true
      }, autoRefreshInterval);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefreshEnabled, autoRefreshInterval]);

  // Initial load
  useEffect(() => {
    loadNewsData(false, false);
  }, []);

  // Auto-refresh every 2 hours
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh triggered (2 hours passed)');
      loadNewsData(true, true); // Refresh = true for auto-refresh
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, []);

  // Enhanced loadNewsData - minimal changes
  const loadNewsData = useCallback(async (isRefresh = false, isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      console.log(`📡 ${isRefresh ? 'Refreshing' : 'Loading'} news data...`);
      
      // Use enhanced fetchAndProcessNewArticles with refresh flag
      const result = await fetchAndProcessNewArticles(isRefresh);
      
      // Remove duplicates and set articles
      const uniqueArticles = removeDuplicateArticles(result.articles);
      setArticles(uniqueArticles);
      setNewArticlesCount(result.newArticlesCount || 0);
      setLastRefreshTime(new Date());
      
      // Set sources and categories
      if (result.availableSources) {
        setAvailableSources(result.availableSources);
        setSources(result.availableSources);
      }
      
      const allCategories = [...new Set(uniqueArticles.map(article => 
        article.category || article.fullContent?.category
      ).filter(Boolean))];
      setCategories(allCategories);
      
      if (result.fromCache) {
        console.log(`⚡ Instant load: ${uniqueArticles.length} articles from cache`);
      } else {
        console.log(`📊 Updated: ${uniqueArticles.length} total articles (${result.newArticlesCount} new)`);
      }
      
    } catch (error) {
      console.error('❌ Error loading news data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // NEW FUNCTION: Remove duplicate articles by ID
  const removeDuplicateArticles = (articles) => {
    const seen = new Set();
    const uniqueArticles = [];
    
    articles.forEach(article => {
      if (!seen.has(article.id)) {
        seen.add(article.id);
        uniqueArticles.push(article);
      } else {
        console.log(`🚫 Skipping duplicate article: ${article.id} - ${article.title?.substring(0, 50)}...`);
      }
    });
    
    return uniqueArticles;
  };

  const handleToggleFavorite = async (article) => {
    try {
      const newFavoritedState = !article.isFavorited;
      
      // Optimistically update UI
      setArticles(prevArticles => 
        prevArticles.map(a => 
          a.id === article.id 
            ? { ...a, isFavorited: newFavoritedState }
            : a
        )
      );
      
      // Update in database
      await toggleArticleFavorite(article.id, newFavoritedState);
      
    } catch (error) {
      console.error('Error toggling favorite:', error);
      
      // Revert optimistic update on error
      setArticles(prevArticles => 
        prevArticles.map(a => 
          a.id === article.id 
            ? { ...a, isFavorited: article.isFavorited }
            : a
        )
      );
      
      alert('Failed to update favorite status. Please try again.');
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  // Add the missing handleForceRefresh function
  const handleForceRefresh = async () => {
    try {
      setLoading(true);
      console.log('🔄 Force refresh: keeping existing data, adding new articles...');
      await loadNewsData(true, false); // isRefresh = true, keeps old data + adds new
    } catch (error) {
      console.error('Error force refreshing:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced filtering function that includes AI filtering
  const getDisplayArticles = () => {
    // If AI filter is active, use AI filtered results
    if (aiFilterActive && aiFilteredArticles.length > 0) {
      return aiFilteredArticles.filter(article => {
    const sourceMatch = selectedSource === 'all' || article.source === selectedSource;
    const categoryMatch = selectedCategory === 'all' || 
                       (article.fullContent && 
                        article.fullContent.category && 
                        article.fullContent.category.includes(selectedCategory));
    
        // Apply keyword filter if active
        let keywordMatch = true;
        if (keywords.length > 0) {
          const searchableTextParts = [];
          
          if (article.title) searchableTextParts.push(article.title);
          if (article.source) searchableTextParts.push(article.source);
          if (article.fullContent?.category) searchableTextParts.push(article.fullContent.category);
          
          if (article.source === "almayadeen.net/politics" || 
              (article.source && article.source.includes("almayadeen.net"))) {
            if (article.fullContent?.fullArticle?.content) {
              const paragraphContent = article.fullContent.fullArticle.content
                .filter(item => item.type === "paragraph")
                .map(item => item.content)
                .join(" ");
              if (paragraphContent) searchableTextParts.push(paragraphContent);
            }
          } else {
            if (article.fullContent?.plainTextContent) {
              searchableTextParts.push(article.fullContent.plainTextContent);
            }
          }
          
          if (article.processedContent) searchableTextParts.push(article.processedContent);
          
          const searchableText = searchableTextParts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
          
          if (keywordMode === 'OR') {
            keywordMatch = keywords.some(keyword => 
              searchableText.includes(keyword.toLowerCase().trim())
            );
          } else {
            keywordMatch = keywords.every(keyword => 
              searchableText.includes(keyword.toLowerCase().trim())
            );
          }
        }
        
        return sourceMatch && categoryMatch && keywordMatch;
  });
    }
    
    // Otherwise use regular filtering
    return articles.filter(article => {
      const sourceMatch = selectedSource === 'all' || article.source === selectedSource;
      const categoryMatch = selectedCategory === 'all' || 
                         (article.fullContent && 
                          article.fullContent.category && 
                          article.fullContent.category.includes(selectedCategory));
      
      let keywordMatch = true;
      if (keywords.length > 0) {
        const searchableTextParts = [];
        
        if (article.title) searchableTextParts.push(article.title);
        if (article.source) searchableTextParts.push(article.source);
        if (article.fullContent?.category) searchableTextParts.push(article.fullContent.category);
        
        if (article.source === "almayadeen.net/politics" || 
            (article.source && article.source.includes("almayadeen.net"))) {
          if (article.fullContent?.fullArticle?.content) {
            const paragraphContent = article.fullContent.fullArticle.content
              .filter(item => item.type === "paragraph")
              .map(item => item.content)
              .join(" ");
            if (paragraphContent) searchableTextParts.push(paragraphContent);
          }
        } else {
          if (article.fullContent?.plainTextContent) {
            searchableTextParts.push(article.fullContent.plainTextContent);
          }
        }
        
        if (article.processedContent) searchableTextParts.push(article.processedContent);
        
        const searchableText = searchableTextParts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
        
        if (keywordMode === 'OR') {
          keywordMatch = keywords.some(keyword => 
            searchableText.includes(keyword.toLowerCase().trim())
          );
        } else {
          keywordMatch = keywords.every(keyword => 
            searchableText.includes(keyword.toLowerCase().trim())
          );
        }
      }
      
      return sourceMatch && categoryMatch && keywordMatch;
    });
  };

  const filteredArticles = getDisplayArticles();

  // AI Filtering Functions
  const performAIFiltering = async () => {
    if (!aiFilterQuery.trim()) {
      setAiFilterStatus({
        type: 'error',
        message: 'Please enter a query for AI filtering.'
      });
      return;
    }

    try {
      setAiProcessing(true);
      setAiFilterStatus({
        type: 'processing',
        message: 'AI is analyzing all news articles... This may take a moment.'
      });

      // Prepare articles data for AI analysis
      const articlesForAnalysis = articles.map(article => {
        let content = '';
        
        // Extract content based on source type
        if (article.source === "almayadeen.net/politics" || 
            (article.source && article.source.includes("almayadeen.net"))) {
          if (article.fullContent?.fullArticle?.content) {
            content = article.fullContent.fullArticle.content
              .filter(item => item.type === "paragraph")
              .map(item => item.content)
              .join(" ");
          }
        } else {
          content = article.fullContent?.plainTextContent || article.processedContent || article.summary || '';
        }

        return {
          id: article.id,
          title: article.title || '',
          source: article.source || '',
          category: article.category || article.fullContent?.category || '',
          content: content,
          date: article.date || ''
        };
      });

      // Split articles into chunks to avoid API limits
      const chunkSize = 10; // Process 10 articles at a time
      const chunks = [];
      for (let i = 0; i < articlesForAnalysis.length; i += chunkSize) {
        chunks.push(articlesForAnalysis.slice(i, i + chunkSize));
      }

      const matchingArticleIds = new Set();

      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        setAiFilterStatus({
          type: 'processing',
          message: `AI is analyzing articles ${chunkIndex * chunkSize + 1}-${Math.min((chunkIndex + 1) * chunkSize, articlesForAnalysis.length)} of ${articlesForAnalysis.length}...`
        });

        const prompt = `You are an AI assistant that helps filter news articles based on user queries. 

User Query: "${aiFilterQuery}"

Please analyze the following news articles and determine which ones match the user's query. Consider the title, source, category, and content of each article. Look for semantic meaning, not just exact keyword matches.

Articles to analyze:
${chunk.map((article, index) => `
Article ${index + 1}:
ID: ${article.id}
Title: ${article.title}
Source: ${article.source}
Category: ${article.category}
Content: ${article.content.substring(0, 500)}${article.content.length > 500 ? '...' : ''}
Date: ${article.date}
---`).join('\n')}

Please respond with ONLY a JSON array containing the IDs of articles that match the query. For example: ["id1", "id3", "id5"]

If no articles match, respond with an empty array: []`;

        try {
          const result = await callGeminiApi(prompt, {
            model: 'gemini-2.0-flash',
            temperature: 0.1, // Low temperature for consistent analysis
            maxTokens: 1000
          });

          // Parse the AI response
          const responseText = result.text.trim();
          let matchingIds = [];
          
          try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\[(.*?)\]/);
            if (jsonMatch) {
              matchingIds = JSON.parse(jsonMatch[0]);
            }
          } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            // Fallback: try to extract IDs manually
            const idMatches = responseText.match(/"([^"]+)"/g);
            if (idMatches) {
              matchingIds = idMatches.map(match => match.replace(/"/g, ''));
            }
          }

          // Add matching IDs to our set
          matchingIds.forEach(id => matchingArticleIds.add(id));

        } catch (chunkError) {
          console.error(`Error processing chunk ${chunkIndex}:`, chunkError);
        }

        // Small delay between chunks to avoid rate limiting
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Filter original articles based on AI results
      const aiFiltered = articles.filter(article => matchingArticleIds.has(article.id));

      setAiFilteredArticles(aiFiltered);
      setAiFilterActive(true);

      setAiFilterStatus({
        type: 'success',
        message: `AI filtering complete! Found ${aiFiltered.length} articles matching your query: "${aiFilterQuery}"`
      });

    } catch (error) {
      console.error('Error in AI filtering:', error);
      setAiFilterStatus({
        type: 'error',
        message: `AI filtering failed: ${error.message}`
      });
    } finally {
      setAiProcessing(false);
    }
  };

  const clearAIFilter = () => {
    setAiFilterActive(false);
    setAiFilteredArticles([]);
    setAiFilterQuery('');
    setAiFilterStatus({ type: '', message: '' });
  };

  const handleSourceChange = (e) => {
    setSelectedSource(e.target.value);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const openArticleModal = (article) => {
    setSelectedArticle(article);
  };

  const closeArticleModal = () => {
    setSelectedArticle(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedArticles(new Set());
    }
  };

  const handleArticleSelection = (article, isSelected) => {
    const newSelectedArticles = new Set(selectedArticles);
    
    if (isSelected) {
      newSelectedArticles.add(article.id);
    } else {
      newSelectedArticles.delete(article.id);
    }
    
    setSelectedArticles(newSelectedArticles);
  };

  const handleSaveArticle = async (article) => {
    try {
      const savedArticle = await saveNewsItem(article);
      
      // Update the articles array to reflect saved state
      setArticles(prevArticles => {
        return prevArticles.map(a => {
          if (a.id === article.id) {
            return { ...a, isSaved: true };
          }
          return a;
        });
      });
      
      return true;
    } catch (error) {
      console.error('Error saving article:', error);
      
      // Check if it's an authentication error
      if (error.message.includes('Authentication required') || 
          error.code === 'permission-denied') {
        alert('Please log in to save articles.');
        // Optionally redirect to login page
      } else {
        alert('Failed to save the article. Please try again.');
      }
    }
  };

  const handleSaveSelected = async () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article to save.');
      return;
    }
    
    setSavingAll(true);
    try {
      // Get the selected articles data
      const articlesToSave = filteredArticles.filter(article => 
        selectedArticles.has(article.id)
      );
      
      // Process each article - just get the image URL
      const processedArticles = articlesToSave.map(article => {
        // Get the image URL
        let imageUrl;
        if (article.source === "almayadeen.net/politics" || 
            (article.source && article.source.includes("almayadeen.net"))) {
          if (article.fullContent?.fullArticle?.mainImage?.url) {
            imageUrl = article.fullContent.fullArticle.mainImage.url;
          }
        } else {
          imageUrl = article.fullContent?.mainImage || article.imageUrl;
        }
        
        if (!imageUrl) {
          imageUrl = 'https://via.placeholder.com/300x180?text=No+Image';
        }
        
        return {
          ...article,
          imageUrl: imageUrl,
          isSaved: true
        };
      });
      
      // Save all processed articles to Firebase - with duplicate checking
      console.log("Saving multiple articles:", processedArticles.length);
      const saveResult = await saveMultipleNewsItems(processedArticles);
      
      // Update UI to show save results
      alert(`Save results: ${saveResult.newlySaved} new articles saved, ${saveResult.alreadySaved} were already saved.`);
      
      // Update the UI to reflect saved state
      setArticles(prevArticles => {
        return prevArticles.map(article => {
          if (selectedArticles.has(article.id)) {
            return { ...article, isSaved: true };
          }
          return article;
        });
      });
      
      // Clear selections
      setSelectedArticles(new Set());
      setSelectionMode(false);
      
    } catch (error) {
      console.error('Error saving multiple articles:', error);
      alert('Some articles could not be saved. Please try again.');
    } finally {
      setSavingAll(false);
    }
  };

  // Add keyword functions
  const handleKeywordInputChange = (e) => {
    setKeywordInput(e.target.value);
  };

  const handleKeywordInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const addKeyword = () => {
    const trimmedKeyword = keywordInput.trim();
    if (trimmedKeyword && !keywords.some(k => k.toLowerCase() === trimmedKeyword.toLowerCase())) {
      setKeywords(prev => [...prev, trimmedKeyword]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keywordToRemove) => {
    setKeywords(prev => prev.filter(keyword => keyword !== keywordToRemove));
  };

  const clearAllKeywords = () => {
    setKeywords([]);
  };

  const toggleKeywordMode = () => {
    setKeywordMode(prev => prev === 'OR' ? 'AND' : 'OR');
  };

  // Function to get active filters description
  const getActiveFiltersDescription = () => {
    const filters = [];
    
    if (selectedSource !== 'all') filters.push(`Source: ${selectedSource}`);
    if (selectedCategory !== 'all') filters.push(`Category: ${selectedCategory}`);
    if (keywords.length > 0) filters.push(`Keywords (${keywordMode}): ${keywords.join(', ')}`);
    if (aiFilterActive) filters.push(`AI Query: "${aiFilterQuery}"`);
    
    return filters.join(' • ');
  };

  // Updated function: Add selected articles to favorites with duplicate check
  const handleAddSelectedToFavorites = async () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article to add to favorites.');
      return;
    }
    
    // Filter out already favorited articles
    const articlesToFavorite = filteredArticles.filter(article => 
      selectedArticles.has(article.id) && !article.isFavorited
    );
    
    const alreadyFavorited = filteredArticles.filter(article => 
      selectedArticles.has(article.id) && article.isFavorited
    );
    
    if (articlesToFavorite.length === 0) {
      if (alreadyFavorited.length > 0) {
        alert(`All ${alreadyFavorited.length} selected articles are already in your favorites!`);
      } else {
        alert('No articles selected to add to favorites.');
      }
      return;
    }
    
    if (alreadyFavorited.length > 0) {
      const proceed = window.confirm(
        `${alreadyFavorited.length} articles are already favorited. ` +
        `Do you want to add the remaining ${articlesToFavorite.length} articles to favorites?`
      );
      if (!proceed) return;
    }
    
    setAddingToFavorites(true);
    try {
      console.log("Adding articles to favorites:", articlesToFavorite.length);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Add each article to favorites
      for (const article of articlesToFavorite) {
        try {
          await toggleArticleFavorite(article.id, true);
          successCount++;
        } catch (error) {
          console.error(`Error adding article ${article.id} to favorites:`, error);
          errorCount++;
        }
      }
      
      // Update UI to show results
      let message = '';
      if (errorCount === 0) {
        message = `✅ Successfully added ${successCount} articles to favorites!`;
        if (alreadyFavorited.length > 0) {
          message += ` (${alreadyFavorited.length} were already favorited)`;
        }
      } else {
        message = `Added ${successCount} articles to favorites. ${errorCount} failed.`;
        if (alreadyFavorited.length > 0) {
          message += ` (${alreadyFavorited.length} were already favorited)`;
        }
      }
      alert(message);
      
      // Update the UI to reflect favorited state
      setArticles(prevArticles => {
        return prevArticles.map(article => {
          if (selectedArticles.has(article.id)) {
            return { ...article, isFavorited: true };
          }
          return article;
        });
      });
      
      // Clear selections
      setSelectedArticles(new Set());
      setSelectionMode(false);
      
    } catch (error) {
      console.error('Error adding multiple articles to favorites:', error);
      alert('Some articles could not be added to favorites. Please try again.');
    } finally {
      setAddingToFavorites(false);
    }
  };

  // Updated function: Add all filtered results to favorites with duplicate check
  const addAllFilteredToFavorites = async () => {
    if (filteredArticles.length === 0) {
      alert('No articles to add to favorites.');
      return;
    }

    // Filter out already favorited articles
    const articlesToFavorite = filteredArticles.filter(article => !article.isFavorited);
    const alreadyFavorited = filteredArticles.filter(article => article.isFavorited);

    if (articlesToFavorite.length === 0) {
      alert(`All ${filteredArticles.length} filtered articles are already in your favorites!`);
      return;
    }

    let confirmMessage = `Are you sure you want to add ${articlesToFavorite.length} articles to favorites?`;
    if (alreadyFavorited.length > 0) {
      confirmMessage = `${alreadyFavorited.length} articles are already favorited. ` +
                      `Do you want to add the remaining ${articlesToFavorite.length} articles to favorites?`;
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    try {
      setAddingAllToFavorites(true);
      
      console.log("Adding filtered results to favorites:", articlesToFavorite.length, "articles");
      
      let successCount = 0;
      let errorCount = 0;
      
      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < articlesToFavorite.length; i += batchSize) {
        const batch = articlesToFavorite.slice(i, i + batchSize);
        
        // Process batch
        for (const article of batch) {
          try {
            await toggleArticleFavorite(article.id, true);
            successCount++;
          } catch (error) {
            console.error(`Error adding article ${article.id} to favorites:`, error);
            errorCount++;
          }
        }
        
        // Small delay between batches
        if (i + batchSize < articlesToFavorite.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Update UI
      let message = '';
      if (errorCount === 0) {
        message = `🎉 Successfully added ${successCount} articles to favorites!`;
        if (alreadyFavorited.length > 0) {
          message += ` (${alreadyFavorited.length} were already favorited)`;
        }
      } else {
        message = `Added ${successCount} articles to favorites. ${errorCount} failed.`;
        if (alreadyFavorited.length > 0) {
          message += ` (${alreadyFavorited.length} were already favorited)`;
        }
      }
      alert(message);
      
      // Update articles state to reflect favorited status
      setArticles(prevArticles => {
        const toFavoriteIds = new Set(articlesToFavorite.map(a => a.id));
        return prevArticles.map(article => {
          if (toFavoriteIds.has(article.id)) {
            return { ...article, isFavorited: true };
          }
          return article;
        });
      });
      
    } catch (error) {
      console.error('Error adding all filtered articles to favorites:', error);
      alert('Failed to add articles to favorites. Please try again.');
    } finally {
      setAddingAllToFavorites(false);
    }
  };

  // Updated function: Remove selected from favorites with check
  const handleRemoveSelectedFromFavorites = async () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article to remove from favorites.');
      return;
    }
    
    // Filter only favorited articles
    const articlesToUnfavorite = filteredArticles.filter(article => 
      selectedArticles.has(article.id) && article.isFavorited
    );
    
    const notFavorited = filteredArticles.filter(article => 
      selectedArticles.has(article.id) && !article.isFavorited
    );
    
    if (articlesToUnfavorite.length === 0) {
      if (notFavorited.length > 0) {
        alert(`None of the ${notFavorited.length} selected articles are in your favorites!`);
      } else {
        alert('No favorited articles selected to remove.');
      }
      return;
    }
    
    if (notFavorited.length > 0) {
      const proceed = window.confirm(
        `${notFavorited.length} articles are not favorited. ` +
        `Do you want to remove the ${articlesToUnfavorite.length} favorited articles?`
      );
      if (!proceed) return;
    }
    
    setRemovingFromFavorites(true);
    try {
      console.log("Removing articles from favorites:", articlesToUnfavorite.length);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Remove each article from favorites
      for (const article of articlesToUnfavorite) {
        try {
          await toggleArticleFavorite(article.id, false);
          successCount++;
        } catch (error) {
          console.error(`Error removing article ${article.id} from favorites:`, error);
          errorCount++;
        }
      }
      
      // Update UI to show results
      let message = '';
      if (errorCount === 0) {
        message = `✅ Successfully removed ${successCount} articles from favorites!`;
        if (notFavorited.length > 0) {
          message += ` (${notFavorited.length} were not favorited)`;
        }
      } else {
        message = `Removed ${successCount} articles from favorites. ${errorCount} failed.`;
        if (notFavorited.length > 0) {
          message += ` (${notFavorited.length} were not favorited)`;
        }
      }
      alert(message);
      
      // Update the UI to reflect unfavorited state
      setArticles(prevArticles => {
        return prevArticles.map(article => {
          if (selectedArticles.has(article.id)) {
            return { ...article, isFavorited: false };
          }
          return article;
        });
      });
      
      // Clear selections
      setSelectedArticles(new Set());
      setSelectionMode(false);
      
    } catch (error) {
      console.error('Error removing multiple articles from favorites:', error);
      alert('Some articles could not be removed from favorites. Please try again.');
    } finally {
      setRemovingFromFavorites(false);
    }
  };

  // Updated function: Check if should show "Add All to Favorites" button
  const shouldShowAddAllToFavoritesButton = () => {
    return (keywords.length > 0 || 
            selectedSource !== 'all' || 
            selectedCategory !== 'all' || 
            aiFilterActive) && 
           filteredArticles.length > 0;
  };

  return (
    <NewsContainer>
      <NewsHeader>
        <NewsTitle>News ({articles.length})</NewsTitle>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <RefreshButton onClick={handleForceRefresh} disabled={loading}>
            {loading ? <span></span> : '🔄'} 
            {loading ? 'Adding new articles...' : 'Refresh & Add New'}
          </RefreshButton>
          {lastRefreshTime && (
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
              Last updated: {lastRefreshTime.toLocaleTimeString()}
              {newArticlesCount > 0 && ` (+${newArticlesCount} new)`}
            </div>
          )}
        </div>
      </NewsHeader>

      {/* AI Filtering Section */}
      <AIFilterContainer>
        <AIFilterHeader>
          <h3>🤖 AI-Powered Content Analysis</h3>
        </AIFilterHeader>
        
        {aiFilterStatus.message && (
          <AIFilterStatus className={aiFilterStatus.type}>
            {aiFilterStatus.message}
          </AIFilterStatus>
        )}

        <AIFilterInputContainer>
          <AIFilterInput
            value={aiFilterQuery}
            onChange={(e) => setAiFilterQuery(e.target.value)}
            placeholder="Ask AI to analyze all news articles... Examples:
• Find all articles about economic issues
• Show articles where Lebanon is mentioned positively  
• List articles about technology or innovation
• Find articles about international relations
• Show news where people are against Lebanon
• Find articles about political developments"
            disabled={aiProcessing}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <AIFilterButton 
              onClick={performAIFiltering} 
              disabled={aiProcessing || !aiFilterQuery.trim()}
            >
              {aiProcessing ? <LoadingSpinner /> : '🧠'} 
              {aiProcessing ? 'Analyzing...' : 'Analyze with AI'}
            </AIFilterButton>
            {aiFilterActive && (
              <ClearAIFilterButton onClick={clearAIFilter}>
                Clear AI Filter
              </ClearAIFilterButton>
            )}
          </div>
        </AIFilterInputContainer>
      </AIFilterContainer>
      
      <FiltersContainer>
        <FilterGroup>
          <FilterLabel>Source</FilterLabel>
          <Filter value={selectedSource} onChange={handleSourceChange}>
            <option value="all">All Sources ({availableSources.length})</option>
            {availableSources.map(source => (
              <option key={source} value={source}>
                {source} ({articles.filter(a => a.source === source).length})
              </option>
            ))}
          </Filter>
        </FilterGroup>
        
        <FilterGroup>
          <FilterLabel>Category</FilterLabel>
          <Filter value={selectedCategory} onChange={handleCategoryChange}>
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Filter>
        </FilterGroup>
        
        <KeywordFilterContainer>
          <FilterLabel>
            Keywords Filter 
            {keywords.length > 0 && (
              <span style={{ fontSize: '0.8em', marginLeft: '0.5rem' }}>
                ({keywordMode} mode)
              </span>
            )}
          </FilterLabel>
          <KeywordInputContainer>
            <KeywordInput
              type="text"
              value={keywordInput}
              onChange={handleKeywordInputChange}
              onKeyPress={handleKeywordInputKeyPress}
              placeholder="Enter keyword (e.g., beirut, car)"
            />
            <AddKeywordButton 
              onClick={addKeyword}
              disabled={!keywordInput.trim()}
            >
              Add
            </AddKeywordButton>
          </KeywordInputContainer>
          
          {keywords.length > 0 && (
            <KeywordTags>
              {keywords.map((keyword, index) => (
                <KeywordTag key={index}>
                  {keyword}
                  <RemoveKeywordButton onClick={() => removeKeyword(keyword)}>
                    ×
                  </RemoveKeywordButton>
                </KeywordTag>
              ))}
              <ModeToggleButton onClick={toggleKeywordMode}>
                {keywordMode} Mode
              </ModeToggleButton>
              <ClearAllKeywordsButton onClick={clearAllKeywords}>
                Clear All
              </ClearAllKeywordsButton>
            </KeywordTags>
          )}
        </KeywordFilterContainer>
      </FiltersContainer>
      
      {/* Show active filter summary - updated to include AI filter */}
      {(keywords.length > 0 || selectedSource !== 'all' || selectedCategory !== 'all' || aiFilterActive) && (
        <FilterSummary>
          <FilterSummaryText>
            Active filters: 
            {selectedSource !== 'all' && ` Source: ${selectedSource}`}
            {selectedCategory !== 'all' && ` Category: ${selectedCategory}`}
            {keywords.length > 0 && ` Keywords (${keywordMode}): ${keywords.join(', ')}`}
            {aiFilterActive && ` AI Query: "${aiFilterQuery}"`}
            {' '}({filteredArticles.length} articles found)
          </FilterSummaryText>
        </FilterSummary>
      )}
      
      {/* Filter Results Actions - Add All to Favorites Button */}
      {shouldShowAddAllToFavoritesButton() && (
        <FilterResultsActions>
          <FilterResultsInfo>
            <FilterResultsTitle>
              🎯 {filteredArticles.length} Articles Found
            </FilterResultsTitle>
            <FilterResultsDescription>
              Active filters: {getActiveFiltersDescription()}
            </FilterResultsDescription>
          </FilterResultsInfo>
          
          <AddAllToFavoritesButton 
            onClick={addAllFilteredToFavorites}
            disabled={addingAllToFavorites}
          >
            {addingAllToFavorites ? (
              <>
                <LoadingSpinner />
                Adding {filteredArticles.length} to favorites...
              </>
            ) : (
              <>
                ⭐ Add All {filteredArticles.length} to Favorites
              </>
            )}
          </AddAllToFavoritesButton>
        </FilterResultsActions>
      )}
      
      <ActionBar>
        <SelectionButton 
          active={selectionMode} 
          onClick={toggleSelectionMode}
        >
          {selectionMode ? 'Cancel Selection' : 'Select Articles'}
        </SelectionButton>
        
        {selectionMode && (
          <>
            <AddToFavoritesButton 
              onClick={handleAddSelectedToFavorites} 
              disabled={addingToFavorites || removingFromFavorites || selectedArticles.size === 0}
            >
              {addingToFavorites ? 'Adding...' : `⭐ Add Selected to Favorites (${selectedArticles.size})`}
            </AddToFavoritesButton>
            
            <UnsaveAllButton 
              onClick={handleRemoveSelectedFromFavorites}
              disabled={addingToFavorites || removingFromFavorites || selectedArticles.size === 0}
            >
              {removingFromFavorites ? 'Removing...' : `💔 Remove Selected from Favorites (${selectedArticles.size})`}
            </UnsaveAllButton>
            
            <SelectionInfo>
              {selectedArticles.size} of {filteredArticles.length} selected
            </SelectionInfo>
          </>
        )}
      </ActionBar>
      
      {loading ? (
        <LoadingIndicator>
          <span></span>
        </LoadingIndicator>
      ) : filteredArticles.length === 0 ? (
        <NoResults>
          No articles found. Try changing your filters.
        </NoResults>
      ) : (
        <NewsGrid>
          {filteredArticles.map((article, index) => (
            <NewsCard 
              key={`${article.id}-${index}`}
              article={article} 
              onReadMore={openArticleModal}
              onToggleFavorite={handleToggleFavorite}
              showFavoriteButton={true}
            />
          ))}
        </NewsGrid>
      )}
      
      {selectedArticle && (
        <ArticleModal onClick={closeArticleModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={closeArticleModal}>×</CloseButton>
            <ArticleHeader>
              <ArticleTitle>{selectedArticle.title}</ArticleTitle>
              <ArticleMeta>
                <span>Source: {selectedArticle.source}</span>
                <span>Date: {selectedArticle.date}</span>
                {selectedArticle.fullContent?.category && (
                  <span>Category: {selectedArticle.fullContent.category}</span>
                )}
              </ArticleMeta>
            </ArticleHeader>
            <ArticleBody>
              {(() => {
                // Use preprocessed image URL if available
                let modalImageUrl = selectedArticle.processedImageUrl;
                
                if (!modalImageUrl) {
                  // Fall back to original logic if preprocessing didn't happen
                  if (selectedArticle.source === "almayadeen.net/politics" || 
                      (selectedArticle.source && selectedArticle.source.includes("almayadeen.net"))) {
                    if (selectedArticle.fullContent?.fullArticle?.mainImage?.url) {
                      modalImageUrl = selectedArticle.fullContent.fullArticle.mainImage.url;
                    }
                  } else {
                    modalImageUrl = selectedArticle.fullContent?.mainImage || selectedArticle.imageUrl;
                  }
                }
                
                // If no image found, use placeholder
                if (!modalImageUrl) {
                  modalImageUrl = 'https://via.placeholder.com/800x450?text=No+Image';
                }
                
                return <img src={modalImageUrl} alt={selectedArticle.title} />;
              })()}
              
              <ArticleText>
                {selectedArticle.processedContent || 
                  (selectedArticle.source === "almayadeen.net/politics" || 
                   (selectedArticle.source && selectedArticle.source.includes("almayadeen.net"))
                    ? selectedArticle.fullContent?.fullArticle?.content
                        ?.filter(item => item.type === "paragraph")
                        .map(item => item.content)
                        .join("\n\n")
                    : selectedArticle.fullContent?.plainTextContent || 'No content available.'
                  )
                }
              </ArticleText>
            </ArticleBody>
          </ModalContent>
        </ArticleModal>
      )}
    </NewsContainer>
  );
};

export default News;

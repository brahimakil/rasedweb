import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getFavoritedArticles, toggleArticleFavorite } from '../../utils/api';
import { callGeminiApi } from '../../utils/gemini';
import NewsCard from '../../components/NewsCard';
import { saveToLocalStorage } from '../../utils/storage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Reuse the same styled components from News.js for consistency
const FavoritesContainer = styled.div`
  padding-bottom: 2rem;
`;

const FavoritesHeader = styled.div`
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

const FavoritesTitle = styled.h1`
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

const SearchInput = styled.input`
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
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
`;

const FavoritesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
`;

const NoResults = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${props => props.theme.secondary};
  font-size: 1.2rem;
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

const SelectionButton = styled.button.attrs(props => ({
  active: undefined,
  className: props.active ? 'active-button' : '',
}))`
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
  
  &.active-button {
    background-color: ${props => props.theme.primary};
    color: white;
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

const ExportButton = styled.button`
  background-color: ${props => props.theme.primary};
  color: white;
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

const SelectionInfo = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: ${props => props.theme.secondary};
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
  overflow-y: auto;
`;

const ModalContent = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: ${props => props.theme.secondary};
  
  &:hover {
    color: ${props => props.theme.text};
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
  gap: 1.5rem;
  flex-wrap: wrap;
  color: ${props => props.theme.secondary};
  font-size: 0.9rem;
  
  span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const ArticleBody = styled.div`
  padding: 2rem;
  
  img {
    width: 100%;
    border-radius: 8px;
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

// Add new styled components for keyword filter (same as News.js)
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

// Add the exact same AI filtering styled components from News.js
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

const Favorites = () => {
  const [favoritedArticles, setFavoritedArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [removingAll, setRemovingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  
  // Add keyword filter state
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [keywordMode, setKeywordMode] = useState('OR');
  
  // Add AI filtering state
  const [aiFilterQuery, setAiFilterQuery] = useState('');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [aiFilteredArticles, setAiFilteredArticles] = useState([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiFilterStatus, setAiFilterStatus] = useState({ type: '', message: '' });

  // Load favorited articles on component mount
  useEffect(() => {
    loadFavoritedArticles();
  }, []);

  // Apply filters when any filter changes
  useEffect(() => {
    applyFilters();
  }, [favoritedArticles, searchTerm, selectedSource, selectedCategory, keywords, keywordMode, aiFilterActive, aiFilteredArticles]);

  const loadFavoritedArticles = async () => {
    try {
      setLoading(true);
      
      // Get favorited articles from database
      const articles = await getFavoritedArticles();
      
      // Set articles
      setFavoritedArticles(articles);
      
      // Extract unique sources and categories
      const uniqueSources = [...new Set(articles.map(article => article.source))];
      const uniqueCategories = [...new Set(articles.map(article => article.category).filter(Boolean))];
      
      setSources(uniqueSources);
      setCategories(uniqueCategories);
      
    } catch (error) {
      console.error('Error loading favorited articles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced filtering function that includes AI filtering
  const applyFilters = () => {
    let filtered = [...favoritedArticles];
    
    // If AI filter is active, start with AI filtered results
    if (aiFilterActive && aiFilteredArticles.length > 0) {
      filtered = [...aiFilteredArticles];
    }
    
    // Apply search term filter (existing functionality)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(term) || 
        (article.summary && article.summary.toLowerCase().includes(term))
      );
    }
    
    // Apply source filter
    if (selectedSource !== 'all') {
      filtered = filtered.filter(article => article.source === selectedSource);
    }
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(article => article.category === selectedCategory);
    }
    
    // Apply keyword filter
    if (keywords.length > 0) {
      filtered = filtered.filter(article => {
        // Build comprehensive searchable text for favorited articles
        const searchableTextParts = [];
        
        // Add title
        if (article.title) {
          searchableTextParts.push(article.title);
        }
        
        // Add source
        if (article.source) {
          searchableTextParts.push(article.source);
        }
        
        // Add category
        if (article.category) {
          searchableTextParts.push(article.category);
        }
        
        // Add summary (favorited articles have summary instead of full content)
        if (article.summary) {
          searchableTextParts.push(article.summary);
        }
        
        // Add link text if available
        if (article.link) {
          searchableTextParts.push(article.link);
        }
        
        // Join all parts and normalize
        const searchableText = searchableTextParts
          .join(' ')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        
        // Apply keyword matching based on mode
        if (keywordMode === 'OR') {
          // OR logic: at least one keyword must match
          return keywords.some(keyword => 
            searchableText.includes(keyword.toLowerCase().trim())
          );
        } else {
          // AND logic: all keywords must match
          return keywords.every(keyword => 
            searchableText.includes(keyword.toLowerCase().trim())
          );
        }
      });
    }
    
    setFilteredArticles(filtered);
  };

  // AI Filtering Functions (exact same as News.js)
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
        message: 'AI is analyzing all favorited articles... This may take a moment.'
      });

      // Prepare favorited articles data for AI analysis
      const articlesForAnalysis = favoritedArticles.map(article => {
        return {
          id: article.id,
          title: article.title || '',
          source: article.source || '',
          category: article.category || '',
          content: article.summary || '',
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
          message: `AI is analyzing favorited articles ${chunkIndex * chunkSize + 1}-${Math.min((chunkIndex + 1) * chunkSize, articlesForAnalysis.length)} of ${articlesForAnalysis.length}...`
        });

        const prompt = `You are an AI assistant that helps filter news articles based on user queries. 

User Query: "${aiFilterQuery}"

Please analyze the following favorited news articles and determine which ones match the user's query. Consider the title, source, category, and content of each article. Look for semantic meaning, not just exact keyword matches.

Articles to analyze:
${chunk.map((article, index) => `
Article ${index + 1}:
ID: ${article.id}
Title: ${article.title}
Source: ${article.source}
Category: ${article.category}
Content: ${article.content}
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

      // Filter original favorited articles based on AI results
      const aiFiltered = favoritedArticles.filter(article => matchingArticleIds.has(article.id));

      setAiFilteredArticles(aiFiltered);
      setAiFilterActive(true);

      setAiFilterStatus({
        type: 'success',
        message: `AI filtering complete! Found ${aiFiltered.length} favorited articles matching your query: "${aiFilterQuery}"`
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

  const handleExampleQuery = (query) => {
    setAiFilterQuery(query);
  };

  // Keyword handling functions
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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSourceChange = (e) => {
    setSelectedSource(e.target.value);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
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

  const handleExportToPDF = async () => {
    try {
      setExporting(true);
      
      // Instead of generating a PDF with jsPDF directly, create a printable view
      // and use the browser's print functionality
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      
      // Filter articles based on current filters
      const articlesToExport = [...filteredArticles];
      
      if (articlesToExport.length === 0) {
        alert('No articles to export. Please adjust your filters.');
        printWindow.close();
        return;
      }
      
      // Generate HTML content for printing
      let printContent = `
        <html>
        <head>
          <title>Favorite Articles</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .article { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .meta { font-size: 12px; color: #666; margin-bottom: 10px; }
            .summary { font-size: 14px; }
            @media print {
              .no-print { display: none; }
              .page-break { page-break-after: always; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Favorite Articles</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>Total articles: ${articlesToExport.length}</p>
            <button class="no-print" onclick="window.print()">Print PDF</button>
            <hr>
          </div>
      `;
      
      // Add each article
      articlesToExport.forEach((article, index) => {
        printContent += `
          <div class="article">
            <div class="title">${article.title || 'No Title'}</div>
            <div class="meta">
              Source: ${article.source || 'Unknown'} | 
              Date: ${article.date || 'Unknown'} | 
              Category: ${article.category || 'Uncategorized'}
            </div>
            ${article.summary ? `<div class="summary">${article.summary}</div>` : ''}
            ${article.url ? `<div class="url"><a href="${article.url}" target="_blank">${article.url}</a></div>` : ''}
          </div>
          ${(index + 1) % 3 === 0 ? '<div class="page-break"></div>' : ''}
        `;
      });
      
      printContent += `
          <script>
            // Auto print when loaded
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
      `;
      
      // Write content to the new window
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
    } catch (error) {
      console.error('Error preparing print view:', error);
      alert('Failed to prepare print view: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const openArticleModal = (article) => {
    setSelectedArticle(article);
  };

  const closeArticleModal = () => {
    setSelectedArticle(null);
  };

  // Fixed function name: handleRemoveFavorite (instead of handleUnsaveArticle)
  const handleRemoveFavorite = async (articleId) => {
    try {
      // Toggle favorite status to false (remove from favorites)
      await toggleArticleFavorite(articleId, false);
      
      // Remove the article from the state
      setFavoritedArticles(prevArticles => 
        prevArticles.filter(article => article.id !== articleId)
      );
      
      return true;
    } catch (error) {
      console.error("Error removing favorite:", error);
      return false;
    }
  };

  // Fixed function name: handleRemoveSelectedFavorites (instead of handleUnsaveSelected)
  const handleRemoveSelectedFavorites = async () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article to remove from favorites.');
      return;
    }
    
    setRemovingAll(true);
    try {
      // Get IDs of selected articles
      const articleIds = Array.from(selectedArticles);
      
      // Remove all selected articles from favorites
      console.log("Removing articles from favorites:", articleIds.length);
      
      for (const articleId of articleIds) {
        await toggleArticleFavorite(articleId, false);
      }
      
      // Update UI
      alert(`Removed ${articleIds.length} articles from favorites.`);
      
      // Remove articles from the state
      setFavoritedArticles(prevArticles => 
        prevArticles.filter(article => !selectedArticles.has(article.id))
      );
      
      // Clear selections
      setSelectedArticles(new Set());
      setSelectionMode(false);
      
    } catch (error) {
      console.error('Error removing multiple favorites:', error);
      alert('Some articles could not be removed from favorites. Please try again.');
    } finally {
      setRemovingAll(false);
    }
  };

  return (
    <FavoritesContainer>
      <FavoritesHeader>
        <FavoritesTitle>Favorite Articles</FavoritesTitle>
        <ExportButton 
          onClick={handleExportToPDF} 
          disabled={exporting || filteredArticles.length === 0}
        >
          {exporting ? 'Exporting...' : '📋 Export to PDF'}
        </ExportButton>
      </FavoritesHeader>
      
      {/* AI Filtering Section - exact same as News.js */}
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
            placeholder="Ask AI to analyze all favorited articles... Examples:
• Find all favorited articles about economic issues
• Show articles where Lebanon is mentioned positively
• List articles about technology or innovation
• Find articles about international relations"
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
          <FilterLabel>Search</FilterLabel>
          <SearchInput 
            type="text" 
            value={searchTerm} 
            onChange={handleSearchChange} 
            placeholder="Search by title or content..."
          />
        </FilterGroup>
        
        <FilterGroup>
          <FilterLabel>Source</FilterLabel>
          <Filter value={selectedSource} onChange={handleSourceChange}>
            <option value="all">All Sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>{source}</option>
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
      {(keywords.length > 0 || searchTerm || selectedSource !== 'all' || selectedCategory !== 'all' || aiFilterActive) && (
        <FilterSummary>
          <FilterSummaryText>
            Active filters: 
            {searchTerm && ` Search: "${searchTerm}"`}
            {selectedSource !== 'all' && ` Source: ${selectedSource}`}
            {selectedCategory !== 'all' && ` Category: ${selectedCategory}`}
            {keywords.length > 0 && ` Keywords (${keywordMode}): ${keywords.join(', ')}`}
            {aiFilterActive && ` AI Query: "${aiFilterQuery}"`}
            {' '}({filteredArticles.length} articles found)
          </FilterSummaryText>
        </FilterSummary>
      )}
      
      <ActionBar>
        <SelectionButton 
          onClick={toggleSelectionMode}
          className={selectionMode ? 'active' : ''}
        >
          {selectionMode ? 'Cancel Selection' : 'Select Articles'}
        </SelectionButton>
        
        {selectionMode && (
          <>
            <UnsaveAllButton 
              onClick={handleRemoveSelectedFavorites}
              disabled={removingAll || selectedArticles.size === 0}
            >
              {removingAll ? 'Removing...' : `Remove Selected (${selectedArticles.size})`}
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
          {favoritedArticles.length === 0 ? 
            'No favorite articles found. Favorite some articles from the News section!' : 
            'No articles match your search filters.'}
        </NoResults>
      ) : (
        <FavoritesGrid>
          {filteredArticles.map((article) => (
            <NewsCard 
              key={article.id} 
              article={{...article, isFavorited: true}} 
              onReadMore={openArticleModal}
              onToggleFavorite={() => handleRemoveFavorite(article.id)}
              onSelect={handleArticleSelection}
              isSelected={selectedArticles.has(article.id)}
              showSelection={selectionMode}
              showFavoriteButton={true}
            />
          ))}
        </FavoritesGrid>
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
                {selectedArticle.category && (
                  <span>Category: {selectedArticle.category}</span>
                )}
              </ArticleMeta>
            </ArticleHeader>
            <ArticleBody>
              <img 
                src={selectedArticle.imageUrl || 'https://via.placeholder.com/800x450?text=No+Image'} 
                alt={selectedArticle.title} 
              />
              <ArticleText>
                {selectedArticle.summary || 'No content available.'}
              </ArticleText>
              {selectedArticle.link && (
                <a 
                  href={selectedArticle.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: 'var(--theme-primary)', 
                    textDecoration: 'none',
                    fontWeight: 'bold'
                  }}
                >
                  Read original article
                </a>
              )}
            </ArticleBody>
          </ModalContent>
        </ArticleModal>
      )}
    </FavoritesContainer>
  );
};

export default Favorites;
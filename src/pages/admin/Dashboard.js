import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { fetchAllNews, getAllNewsSources, getAllNewsCategories } from '../../utils/api';
import { getFromLocalStorage } from '../../utils/storage';
import { fetchAndProcessNewArticles, toggleArticleFavorite } from '../../utils/api';
import { callGeminiApi } from '../../utils/gemini';
import { getCurrentUser } from '../../utils/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import NewsCard from '../../components/NewsCard';

const DashboardContainer = styled.div`
  padding-bottom: 2rem;
`;

const DashboardTitle = styled.h1`
  margin-bottom: 2rem;
  font-size: 2rem;
  color: ${props => props.theme.text};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background-color: ${props => props.theme.surface};
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StatValue = styled.div`
  font-size: 2.5rem;
  font-weight: bold;
  color: ${props => props.theme.primary};
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  font-size: 1rem;
  color: ${props => props.theme.secondary};
  text-align: center;
`;

const DetailedStatsSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
`;

const DetailedStatCard = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const DetailedStatHeader = styled.div`
  background-color: ${props => props.theme.primary};
  color: white;
  padding: 1rem 1.5rem;
  font-size: 1.2rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DetailedStatContent = styled.div`
  padding: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
`;

const StatItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid ${props => props.theme.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const StatItemName = styled.div`
  font-size: 0.9rem;
  color: ${props => props.theme.text};
  flex: 1;
  margin-right: 1rem;
  word-break: break-word;
`;

const StatItemCount = styled.div`
  font-size: 1rem;
  font-weight: bold;
  color: ${props => props.theme.primary};
  background-color: ${props => props.theme.primary}20;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  min-width: 40px;
  text-align: center;
`;

const WelcomeMessage = styled.div`
  background-color: ${props => props.theme.surface};
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
`;

const RefreshSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
`;

const RefreshButton = styled.button`
  background-color: ${props => props.theme.primary};
  color: white;
  padding: 0.75rem 1.5rem;
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

const LoadingIndicator = styled.div`
  width: 1.25rem;
  height: 1.25rem;
  border: 3px solid ${props => props.theme.primary};
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ApiUpdateInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
`;

const ApiUpdateItem = styled.div`
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: ${props => props.theme.secondary};
  
  &::before {
    content: "•";
    margin-right: 0.5rem;
  }
  
  strong {
    margin-right: 0.5rem;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${props => props.theme.secondary};
  font-style: italic;
`;

const AIInsightsSection = styled.div`
  background: linear-gradient(135deg, ${props => props.theme.primary}15, ${props => props.theme.success}10);
  border: 2px solid ${props => props.theme.primary};
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, ${props => props.theme.primary}, ${props => props.theme.success});
  }
`;

const AIInsightsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  
  h2 {
    margin: 0;
    color: ${props => props.theme.primary};
    font-size: 1.5rem;
  }
  
  .ai-icon {
    font-size: 2rem;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`;

const AINoteContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const AINoteInput = styled.textarea`
  flex: 1;
  padding: 1rem;
  border-radius: 8px;
  border: 2px solid ${props => props.theme.border};
  background-color: ${props => props.theme.surface};
  color: ${props => props.theme.text};
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.primary}20;
  }
  
  &::placeholder {
    color: ${props => props.theme.secondary};
  }
`;

const AIActionButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AIButton = styled.button`
  background: linear-gradient(135deg, ${props => props.theme.primary}, ${props => props.theme.success});
  color: white;
  border: none;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  white-space: nowrap;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ClearButton = styled.button`
  background-color: transparent;
  color: ${props => props.theme.error};
  border: 2px solid ${props => props.theme.error};
  padding: 1rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${props => props.theme.error};
    color: white;
  }
`;

const InsightsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const InsightCard = styled.div`
  background-color: ${props => props.theme.surface};
  border: 1px solid ${props => props.theme.border};
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }
`;

const InsightTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: ${props => props.theme.primary};
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const InsightContent = styled.div`
  color: ${props => props.theme.text};
  line-height: 1.6;
  
  .percentage {
    font-size: 2rem;
    font-weight: bold;
    color: ${props => props.theme.primary};
    display: block;
    margin: 0.5rem 0;
  }
  
  .description {
    font-size: 0.9rem;
    color: ${props => props.theme.secondary};
    margin-top: 0.5rem;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 12px;
  background-color: ${props => props.theme.border};
  border-radius: 6px;
  overflow: hidden;
  margin: 1rem 0;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, ${props => props.theme.success}, ${props => props.theme.primary});
  border-radius: 6px;
  transition: width 0.3s ease;
  width: ${props => props.percentage}%;
`;

const RelatedNewsSection = styled.div`
  margin-top: 2rem;
`;

const RelatedNewsHeader = styled.h3`
  color: ${props => props.theme.text};
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NewsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const LoadingSpinner = styled.div`
  width: 24px;
  height: 24px;
  border: 3px solid transparent;
  border-top: 3px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const StatusMessage = styled.div`
  padding: 1rem;
  border-radius: 8px;
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

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalArticles: 0,
    sources: 0,
    categories: 0
  });
  const [detailedStats, setDetailedStats] = useState({
    sourceStats: [],
    categoryStats: []
  });
  const [loading, setLoading] = useState(false);
  const [apiUpdates, setApiUpdates] = useState({
    news: null,
  });
  const [aiNote, setAiNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [allArticles, setAllArticles] = useState([]);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      const allNews = await fetchAllNews(forceRefresh);
      const sources = await getAllNewsSources(forceRefresh);
      const categories = await getAllNewsCategories(forceRefresh);
      
      // Calculate basic stats
      let totalArticles = 0;
      const sourceStats = {};
      const categoryStats = {};
      
      // Process articles by source to get detailed statistics
      if (allNews.articlesBySource) {
        Object.entries(allNews.articlesBySource).forEach(([source, articles]) => {
          const articleCount = articles.length;
          totalArticles += articleCount;
          sourceStats[source] = articleCount;
          
          // Process categories for each article
          articles.forEach(article => {
            if (article.fullContent?.category) {
              const category = article.fullContent.category;
              categoryStats[category] = (categoryStats[category] || 0) + 1;
            }
          });
        });
      }
      
      // Convert to sorted arrays for display
      const sortedSourceStats = Object.entries(sourceStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      
      const sortedCategoryStats = Object.entries(categoryStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      
      setStats({
        totalArticles: totalArticles,
        sources: sources.length || 0,
        categories: categories.length || 0
      });
      
      setDetailedStats({
        sourceStats: sortedSourceStats,
        categoryStats: sortedCategoryStats
      });
      
      const lastNewsUpdate = getFromLocalStorage('rased_last_fetched');
      
      setApiUpdates({
        news: lastNewsUpdate,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadUserAINote();
    loadArticles();
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  const formatUpdateTime = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const loadUserAINote = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const userDocRef = doc(db, 'user_ai_notes', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setSavedNote(data.note || '');
        setAiNote(data.note || '');
      }
    } catch (error) {
      console.error('Error loading AI note:', error);
    }
  };

  const loadArticles = async () => {
    try {
      const result = await fetchAndProcessNewArticles();
      setAllArticles(result.articles || []);
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const generateInsights = useCallback(async () => {
    if (!savedNote || allArticles.length === 0) return;

    try {
      setProcessing(true);
      setStatus({ type: 'processing', message: 'AI is analyzing news articles and generating insights...' });

      // Analyze articles in batches
      const batchSize = 15; // Smaller batches for better analysis
      const analysisResults = [];
      
      for (let i = 0; i < allArticles.length; i += batchSize) {
        const batch = allArticles.slice(i, i + batchSize);
        
        const prompt = `You are a REALISTIC political analyst. Analyze these articles about "${savedNote}".

IMPORTANT INSTRUCTIONS:
- BE REALISTIC - avoid extreme percentages like 100% or 0%
- Most real political topics have mixed coverage
- Look for SUBTLE differences in tone, emphasis, and framing
- Consider that articles can be PARTIALLY supportive or have MIXED messages
- Use the full range: 20%, 35%, 60%, 75%, etc.
- Even similar articles can have different levels of support/opposition

User Interest: "${savedNote}"

Articles to analyze:
${batch.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Source: ${article.source}
Content: ${article.summary || article.processedContent || article.title}
---`).join('\n')}

For each article, determine:
1. RELEVANCE: How relevant is this to "${savedNote}"? (Use realistic range: 15-85%)
2. SENTIMENT: Consider these options:
   - STRONGLY_SUPPORTING (clear strong support)
   - MODERATELY_SUPPORTING (some support but with reservations)
   - SLIGHTLY_SUPPORTING (mild support or positive framing)
   - NEUTRAL (balanced or no clear stance)
   - SLIGHTLY_OPPOSING (mild criticism or negative framing)
   - MODERATELY_OPPOSING (some opposition but not extreme)
   - STRONGLY_OPPOSING (clear strong opposition)
3. CONFIDENCE: How sure are you? (realistic range: 40-90%)

Look for nuances like:
- Articles that support the concept but criticize implementation
- Articles that oppose some aspects but not others
- Articles with balanced reporting that lean slightly one way
- Different emphasis or framing even with similar facts

Return JSON:
[
  {
    "articleIndex": 0,
    "relevance": 65,
    "sentiment": "MODERATELY_SUPPORTING",
    "confidence": 75,
    "reasoning": "Article shows support but mentions some concerns"
  }
]`;

        try {
          const result = await callGeminiApi(prompt, { maxTokens: 3000 });
          const resultText = typeof result === 'object' ? result.text : result;
          const jsonMatch = resultText.match(/\[(.*?)\]/s);
          if (jsonMatch) {
            const batchResults = JSON.parse(jsonMatch[0]);
            batchResults.forEach((analysis, index) => {
              if (batch[index]) {
                analysisResults.push({
                  ...analysis,
                  article: batch[index],
                  globalIndex: i + index
                });
              }
            });
          }
        } catch (batchError) {
          console.error(`Error analyzing batch ${i}:`, batchError);
        }

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // More nuanced categorization
      const stronglySupporting = analysisResults.filter(a => a.sentiment === 'STRONGLY_SUPPORTING' && a.relevance > 40);
      const moderatelySupporting = analysisResults.filter(a => a.sentiment === 'MODERATELY_SUPPORTING' && a.relevance > 40);
      const slightlySupporting = analysisResults.filter(a => a.sentiment === 'SLIGHTLY_SUPPORTING' && a.relevance > 40);
      
      const stronglyOpposing = analysisResults.filter(a => a.sentiment === 'STRONGLY_OPPOSING' && a.relevance > 40);
      const moderatelyOpposing = analysisResults.filter(a => a.sentiment === 'MODERATELY_OPPOSING' && a.relevance > 40);
      const slightlyOpposing = analysisResults.filter(a => a.sentiment === 'SLIGHTLY_OPPOSING' && a.relevance > 40);
      
      const neutralArticles = analysisResults.filter(a => a.sentiment === 'NEUTRAL' && a.relevance > 40);
      const relevantArticles = analysisResults.filter(a => a.relevance > 40);

      // Calculate more realistic percentages
      const allSupporting = stronglySupporting.length + moderatelySupporting.length + slightlySupporting.length;
      const allOpposing = stronglyOpposing.length + moderatelyOpposing.length + slightlyOpposing.length;
      
      const supportingPercentage = relevantArticles.length > 0 ? Math.round((allSupporting / relevantArticles.length) * 100) : 0;
      const opposingPercentage = relevantArticles.length > 0 ? Math.round((allOpposing / relevantArticles.length) * 100) : 0;
      const neutralPercentage = relevantArticles.length > 0 ? Math.round((neutralArticles.length / relevantArticles.length) * 100) : 0;

      // Get unique sources from relevant articles
      const relevantSources = [...new Set(relevantArticles.map(a => a.article.source))];
      
      // Generate professional political analysis
      const studyPrompt = `You are a SENIOR POLITICAL ANALYST with 20+ years experience. Provide a REALISTIC, NUANCED analysis.

CRITICAL INSTRUCTIONS:
- Write in BOTH English and Arabic
- Be realistic - politics is never black and white
- Acknowledge complexity and mixed signals
- Use diplomatic but honest language
- Mention limitations of the data
- Avoid extreme statements
- Show professional skepticism where appropriate
- DO NOT use *** or ** formatting - use plain text only
- Use simple but professional language

DATABASE ANALYSIS RESULTS for "${savedNote}":
- Total database articles: ${allArticles.length}
- Relevant articles: ${relevantArticles.length}
- Strongly supporting: ${stronglySupporting.length}
- Moderately supporting: ${moderatelySupporting.length}
- Slightly supporting: ${slightlySupporting.length}
- Neutral coverage: ${neutralArticles.length}
- Slightly opposing: ${slightlyOpposing.length}
- Moderately opposing: ${moderatelyOpposing.length}
- Strongly opposing: ${stronglyOpposing.length}
- Coverage sources: ${relevantSources.join(', ')}

TOP RELEVANT ARTICLES:
${relevantArticles.slice(0, 8).map((result, index) => `
${index + 1}. ${result.article.title}
   Source: ${result.article.source}
   Sentiment: ${result.sentiment}
   Relevance: ${result.relevance}%
   Reasoning: ${result.reasoning}
---`).join('\n')}

Provide professional analysis in both languages:

🏛️ POLITICAL LANDSCAPE / المشهد السياسي:

English: What does this mixed coverage tell us about the current situation?

Arabic: ماذا تخبرنا هذه التغطية المختلطة عن الوضع الحالي؟

📊 MEDIA ANALYSIS / تحليل الإعلام:

English: How are different sources framing this issue? What patterns emerge?

Arabic: كيف تؤطر المصادر المختلفة هذه القضية؟ ما هي الأنماط التي تظهر؟

⚖️ BALANCED ASSESSMENT / تقييم متوازن:

English: What are the strengths and weaknesses in current coverage?

Arabic: ما هي نقاط القوة والضعف في التغطية الحالية؟

🔍 PROFESSIONAL INSIGHTS / رؤى مهنية:

English: What should decision-makers know about this topic based on available data?

Arabic: ما الذي يجب أن يعرفه صناع القرار حول هذا الموضوع بناءً على البيانات المتاحة؟

⚠️ LIMITATIONS / القيود:

English: What are the limitations of this analysis based on available database articles?

Arabic: ما هي قيود هذا التحليل بناءً على مقالات قاعدة البيانات المتاحة؟

IMPORTANT: 
- Write naturally in both languages
- Do not use bold, italic, or asterisk formatting
- Keep language professional but accessible
- Be honest about uncertainties
- Provide practical insights`;

      const studyResult = await callGeminiApi(studyPrompt, { maxTokens: 2000 });
      const studyText = typeof studyResult === 'object' ? studyResult.text : studyResult;

      setInsights({
        totalArticles: allArticles.length,
        relevantArticles: relevantArticles.length,
        supportingCount: allSupporting,
        opposingCount: allOpposing,
        neutralCount: neutralArticles.length,
        supportingPercentage,
        opposingPercentage,
        neutralPercentage,
        // Detailed breakdown
        stronglySupporting: stronglySupporting.length,
        moderatelySupporting: moderatelySupporting.length,
        slightlySupporting: slightlySupporting.length,
        stronglyOpposing: stronglyOpposing.length,
        moderatelyOpposing: moderatelyOpposing.length,
        slightlyOpposing: slightlyOpposing.length,
        study: studyText,
        sources: relevantSources,
        lastUpdated: new Date().toISOString()
      });

      // Set related news (top 12 most relevant with variety)
      const topRelevant = analysisResults
        .filter(a => a.relevance > 25)
        .sort((a, b) => {
          // Sort by relevance but also ensure variety in sentiment
          if (Math.abs(a.relevance - b.relevance) < 10) {
            // If relevance is similar, prefer variety
            return a.sentiment.localeCompare(b.sentiment);
          }
          return b.relevance - a.relevance;
        })
        .slice(0, 12)
        .map(a => a.article);

      setRelatedNews(topRelevant);

      setStatus({ 
        type: 'success', 
        message: `Realistic analysis complete: ${supportingPercentage}% supporting, ${opposingPercentage}% opposing, ${neutralPercentage}% neutral / تم التحليل الواقعي: ${supportingPercentage}% مؤيد، ${opposingPercentage}% معارض، ${neutralPercentage}% محايد` 
      });

    } catch (error) {
      console.error('Error generating insights:', error);
      setStatus({ 
        type: 'error', 
        message: 'Analysis failed. Please try again. / فشل التحليل، يرجى المحاولة مرة أخرى' 
      });
    } finally {
      setProcessing(false);
    }
  }, [savedNote, allArticles]);

  useEffect(() => {
    if (savedNote && allArticles.length > 0) {
      generateInsights();
    }
  }, [savedNote, allArticles, generateInsights]);

  const saveAINote = async () => {
    if (!aiNote.trim()) {
      setStatus({ type: 'error', message: 'Please enter an AI note before saving.' });
      return;
    }

    try {
      setProcessing(true);
      setStatus({ type: 'processing', message: 'Saving AI note and generating insights...' });

      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const userDocRef = doc(db, 'user_ai_notes', user.uid);
      await setDoc(userDocRef, {
        note: aiNote.trim(),
        updatedAt: new Date().toISOString(),
        userId: user.uid
      }, { merge: true });

      setSavedNote(aiNote.trim());
      setStatus({ type: 'success', message: 'AI note saved successfully! Generating insights...' });

      // Generate insights after saving
      await generateInsights();

    } catch (error) {
      console.error('Error saving AI note:', error);
      setStatus({ type: 'error', message: 'Failed to save AI note. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const clearAINote = async () => {
    const confirmed = window.confirm('Are you sure you want to clear your AI note and insights?');
    if (!confirmed) return;

    try {
      const user = await getCurrentUser();
      if (!user) return;

      const userDocRef = doc(db, 'user_ai_notes', user.uid);
      await updateDoc(userDocRef, {
        note: '',
        updatedAt: new Date().toISOString()
      });

      setAiNote('');
      setSavedNote('');
      setInsights(null);
      setRelatedNews([]);
      setStatus({ type: 'success', message: 'AI note cleared successfully!' });

    } catch (error) {
      console.error('Error clearing AI note:', error);
      setStatus({ type: 'error', message: 'Failed to clear AI note.' });
    }
  };

  const handleToggleFavorite = async (article) => {
    try {
      const newFavoritedState = !article.isFavorited;
      await toggleArticleFavorite(article.id, newFavoritedState);
      
      setRelatedNews(prevNews => 
        prevNews.map(a => 
          a.id === article.id 
            ? { ...a, isFavorited: newFavoritedState }
            : a
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  return (
    <DashboardContainer>
      <RefreshSection>
        <DashboardTitle>Dashboard</DashboardTitle>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <RefreshButton onClick={handleRefresh} disabled={loading}>
            {loading ? <LoadingIndicator /> : '🔄'} {loading ? 'Refreshing...' : 'Refresh Data'}
          </RefreshButton>
          <ApiUpdateInfo>
            <ApiUpdateItem>
              <strong>News API:</strong> {formatUpdateTime(apiUpdates.news)}
            </ApiUpdateItem>
          </ApiUpdateInfo>
        </div>
      </RefreshSection>
      
      <WelcomeMessage>
        <h2>Welcome to RASED Admin Panel</h2>
        <p>This dashboard provides an overview of all the news articles collected from various sources.</p>
      </WelcomeMessage>
      
      <StatsGrid>
        <StatCard>
          <StatValue>{stats.totalArticles}</StatValue>
          <StatLabel>Total Articles</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.sources}</StatValue>
          <StatLabel>News Sources</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.categories}</StatValue>
          <StatLabel>Categories</StatLabel>
        </StatCard>
      </StatsGrid>
      
      <DetailedStatsSection>
        <DetailedStatCard>
          <DetailedStatHeader>
            📰 Sources Statistics
          </DetailedStatHeader>
          <DetailedStatContent>
            {detailedStats.sourceStats.length > 0 ? (
              detailedStats.sourceStats.map((source, index) => (
                <StatItem key={index}>
                  <StatItemName>{source.name}</StatItemName>
                  <StatItemCount>{source.count}</StatItemCount>
                </StatItem>
              ))
            ) : (
              <EmptyState>
                {loading ? 'Loading sources...' : 'No source data available'}
              </EmptyState>
            )}
          </DetailedStatContent>
        </DetailedStatCard>
        
        <DetailedStatCard>
          <DetailedStatHeader>
            🏷️ Categories Statistics
          </DetailedStatHeader>
          <DetailedStatContent>
            {detailedStats.categoryStats.length > 0 ? (
              detailedStats.categoryStats.map((category, index) => (
                <StatItem key={index}>
                  <StatItemName>{category.name}</StatItemName>
                  <StatItemCount>{category.count}</StatItemCount>
                </StatItem>
              ))
            ) : (
              <EmptyState>
                {loading ? 'Loading categories...' : 'No category data available'}
              </EmptyState>
            )}
          </DetailedStatContent>
        </DetailedStatCard>
      </DetailedStatsSection>

      <AIInsightsSection>
        <AIInsightsHeader>
          <span className="ai-icon">🤖</span>
          <h2>AI News Intelligence / ذكاء الأخبار الاصطناعي</h2>
        </AIInsightsHeader>

        {status.message && (
          <StatusMessage className={status.type}>
            {status.message}
          </StatusMessage>
        )}

        <AINoteContainer>
          <AINoteInput
            value={aiNote}
            onChange={(e) => setAiNote(e.target.value)}
            placeholder="Enter your topic here... أدخل موضوعك هنا (e.g., 'Lebanon economy اقتصاد لبنان', 'Technology تكنولوجيا', 'Politics سياسة')"
            disabled={processing}
          />
          <AIActionButtons>
            <AIButton onClick={saveAINote} disabled={processing || !aiNote.trim()}>
              {processing ? <LoadingSpinner /> : '💾'}
              {processing ? 'Analyzing... يحلل' : 'Analyze News تحليل الأخبار'}
            </AIButton>
            {savedNote && (
              <ClearButton onClick={clearAINote} disabled={processing}>
                🗑️ Clear مسح
              </ClearButton>
            )}
          </AIActionButtons>
        </AINoteContainer>

        {processing && (
          <StatusMessage className="processing">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LoadingSpinner />
              <div>
                <div>🤖 AI is reading {allArticles.length} news articles...</div>
                <div>الذكاء الاصطناعي يقرأ {allArticles.length} مقال إخباري...</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  This will take a few minutes / سيستغرق بضع دقائق
                </div>
              </div>
            </div>
          </StatusMessage>
        )}

        {insights && (
          <>
            <InsightsGrid>
              <InsightCard>
                <InsightTitle>
                  📊 Supporting Coverage / التغطية المؤيدة
                </InsightTitle>
                <InsightContent>
                  <span className="percentage">{insights.supportingPercentage}%</span>
                  Articles supporting your topic
                  <br />
                  مقالات تؤيد موضوعك
                  <ProgressBar>
                    <ProgressFill percentage={insights.supportingPercentage} />
                  </ProgressBar>
                  <div className="description">
                    Strong: {insights.stronglySupporting} | Moderate: {insights.moderatelySupporting} | Slight: {insights.slightlySupporting}
                    <br />
                    قوي: {insights.stronglySupporting} | متوسط: {insights.moderatelySupporting} | خفيف: {insights.slightlySupporting}
                  </div>
                </InsightContent>
              </InsightCard>

              <InsightCard>
                <InsightTitle>
                  ⚖️ Opposing Coverage / التغطية المعارضة
                </InsightTitle>
                <InsightContent>
                  <span className="percentage">{insights.opposingPercentage}%</span>
                  Articles opposing your topic
                  <br />
                  مقالات تعارض موضوعك
                  <ProgressBar>
                    <ProgressFill percentage={insights.opposingPercentage} />
                  </ProgressBar>
                  <div className="description">
                    Strong: {insights.stronglyOpposing} | Moderate: {insights.moderatelyOpposing} | Slight: {insights.slightlyOpposing}
                    <br />
                    قوي: {insights.stronglyOpposing} | متوسط: {insights.moderatelyOpposing} | خفيف: {insights.slightlyOpposing}
                  </div>
                </InsightContent>
              </InsightCard>

              <InsightCard>
                <InsightTitle>
                  🎯 Neutral & Coverage / التغطية المحايدة
                </InsightTitle>
                <InsightContent>
                  <span className="percentage">{insights.neutralPercentage}%</span>
                  Balanced or neutral coverage
                  <br />
                  تغطية متوازنة أو محايدة
                  <ProgressBar>
                    <ProgressFill percentage={insights.neutralPercentage} />
                  </ProgressBar>
                  <div className="description">
                    {insights.neutralCount} neutral articles out of {insights.relevantArticles} relevant
                    <br />
                    {insights.neutralCount} مقال محايد من أصل {insights.relevantArticles} ذي صلة
                  </div>
                </InsightContent>
              </InsightCard>
            </InsightsGrid>

            <InsightCard>
              <InsightTitle>
                🏛️ Professional Political Analysis / التحليل السياسي المهني
              </InsightTitle>
              <InsightContent>
                <div style={{ 
                  whiteSpace: 'pre-line', 
                  lineHeight: 1.8,
                  fontSize: '1rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  padding: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}>
                  {typeof insights.study === 'string' ? insights.study : 'Professional analysis not available based on current database articles / التحليل المهني غير متوفر بناءً على مقالات قاعدة البيانات الحالية'}
                </div>
                <div className="description" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  <strong>Analysis based on:</strong> {insights.totalArticles} database articles, {insights.relevantArticles} relevant to your topic
                  <br />
                  <strong>التحليل مبني على:</strong> {insights.totalArticles} مقال في قاعدة البيانات، {insights.relevantArticles} ذات صلة بموضوعك
                  <br />
                  <strong>Last updated:</strong> {new Date(insights.lastUpdated).toLocaleString()}
                </div>
              </InsightContent>
            </InsightCard>
          </>
        )}
      </AIInsightsSection>

      {relatedNews.length > 0 && (
        <RelatedNewsSection>
          <RelatedNewsHeader>
            🎯 Related News ({relatedNews.length}) / أخبار ذات صلة ({relatedNews.length})
          </RelatedNewsHeader>
          <NewsGrid>
            {relatedNews.map((article) => (
              <NewsCard 
                key={article.id} 
                article={article} 
                onToggleFavorite={handleToggleFavorite}
                showFavoriteButton={true}
              />
            ))}
          </NewsGrid>
        </RelatedNewsSection>
      )}
    </DashboardContainer>
  );
};

export default Dashboard;

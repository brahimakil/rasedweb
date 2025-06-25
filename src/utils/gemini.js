import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCurrentUser } from './auth';

/**
 * Get the user's Gemini API key from Firestore
 */
export const getUserGeminiApiKey = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.geminiApiKey || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Gemini API key:', error);
    throw error;
  }
};

/**
 * Call Gemini API with a prompt
 */
export const callGeminiApi = async (prompt, options = {}) => {
  try {
    const apiKey = await getUserGeminiApiKey();
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set it in your profile.');
    }
    
    const {
      model = 'gemini-2.0-flash',
      temperature = 0.7,
      maxTokens = 1000
    } = options;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
    
    if (temperature !== undefined || maxTokens !== undefined) {
      requestBody.generationConfig = {};
      if (temperature !== undefined) {
        requestBody.generationConfig.temperature = temperature;
      }
      if (maxTokens !== undefined) {
        requestBody.generationConfig.maxOutputTokens = maxTokens;
      }
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }
    
    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No response generated from Gemini API');
    }
    
    return {
      text: generatedText,
      usage: data.usageMetadata || {},
      model: model
    };
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
};

/**
 * Generate content with Gemini for news summarization
 */
export const summarizeWithGemini = async (articleText, maxLength = 200) => {
  const prompt = `Please provide a concise summary of the following news article in approximately ${maxLength} characters or less. Focus on the key facts and main points:

${articleText}

Summary:`;

  try {
    const result = await callGeminiApi(prompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxTokens: Math.ceil(maxLength / 3)
    });
    
    return result.text.trim();
  } catch (error) {
    console.error('Error summarizing with Gemini:', error);
    throw error;
  }
};

/**
 * Generate Instagram captions with Gemini
 */
export const generateInstagramCaption = async (newsTitle, newsContent, style = 'engaging') => {
  const stylePrompts = {
    engaging: 'Create an engaging and compelling Instagram caption',
    formal: 'Create a formal and professional Instagram caption',
    casual: 'Create a casual and friendly Instagram caption',
    news: 'Create a news-style Instagram caption'
  };
  
  const prompt = `${stylePrompts[style] || stylePrompts.engaging} based on this news article. Include relevant hashtags and make it suitable for social media:

Title: ${newsTitle}
Content: ${newsContent}

Caption:`;

  try {
    const result = await callGeminiApi(prompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.8,
      maxTokens: 500
    });
    
    return result.text.trim();
  } catch (error) {
    console.error('Error generating Instagram caption with Gemini:', error);
    throw error;
  }
};

/**
 * Test Gemini API connection
 */
export const testGeminiConnection = async (testPrompt = 'Hello, please respond with "API connection successful!"') => {
  try {
    const result = await callGeminiApi(testPrompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.1,
      maxTokens: 100
    });
    
    return {
      success: true,
      response: result.text,
      model: result.model
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * List available Gemini models
 */
export const listGeminiModels = async () => {
  try {
    const apiKey = await getUserGeminiApiKey();
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set it in your profile.');
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.models || [];
    
  } catch (error) {
    console.error('Error listing Gemini models:', error);
    throw error;
  }
};

/**
 * Analyze news articles based on semantic query
 */
export const analyzeNewsWithQuery = async (articles, query, options = {}) => {
  try {
    const {
      chunkSize = 10,
      temperature = 0.1
    } = options;

    // Split articles into chunks
    const chunks = [];
    for (let i = 0; i < articles.length; i += chunkSize) {
      chunks.push(articles.slice(i, i + chunkSize));
    }

    const matchingArticleIds = new Set();

    // Process each chunk
    for (const chunk of chunks) {
      const prompt = `You are an expert news analyst. Analyze the following news articles and determine which ones match the user's semantic query.

User Query: "${query}"

Consider:
- The overall meaning and context, not just keywords
- Sentiment and tone of the articles
- Relationships between entities mentioned
- Implicit meanings and implications
- Cultural and political context

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

Respond with ONLY a JSON array of article IDs that match the query: ["id1", "id2", ...]
If no articles match, respond with: []`;

      const result = await callGeminiApi(prompt, {
        model: 'gemini-2.0-flash',
        temperature: temperature,
        maxTokens: 1000
      });

      // Parse response
      const responseText = result.text.trim();
      try {
        const jsonMatch = responseText.match(/\[(.*?)\]/);
        if (jsonMatch) {
          const matchingIds = JSON.parse(jsonMatch[0]);
          matchingIds.forEach(id => matchingArticleIds.add(id));
        }
      } catch (parseError) {
        console.warn('Could not parse AI response:', responseText);
      }
    }

    return Array.from(matchingArticleIds);
  } catch (error) {
    console.error('Error analyzing news with AI:', error);
    throw error;
  }
}; 
import { callGeminiApi } from './gemini';

/**
 * AI-powered date parsing for multilingual dates
 */
export const parseMultilingualDate = async (dateString, articleTitle = '') => {
  try {
    if (!dateString) {
      return new Date(); // Default to current date if no date provided
    }

    // First try standard parsing for common formats
    const standardDate = tryStandardDateParsing(dateString);
    if (standardDate && !isNaN(standardDate.getTime())) {
      return standardDate;
    }

    // If standard parsing fails, use AI
    const aiParsedDate = await parseWithAI(dateString, articleTitle);
    return aiParsedDate;

  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date(); // Fallback to current date
  }
};

/**
 * Try standard date parsing first (faster)
 */
const tryStandardDateParsing = (dateString) => {
  try {
    // Clean the date string
    const cleaned = dateString.trim();
    
    // Try direct parsing
    let date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats
    const formats = [
      // ISO formats
      /(\d{4}-\d{2}-\d{2})/,
      // DD/MM/YYYY or MM/DD/YYYY
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      // DD-MM-YYYY
      /(\d{1,2}-\d{1,2}-\d{4})/,
      // YYYY.MM.DD
      /(\d{4}\.\d{2}\.\d{2})/
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Use AI to parse complex multilingual dates
 */
const parseWithAI = async (dateString, articleTitle = '') => {
  try {
    const prompt = `You are a date parsing expert. Parse the following date/time string and convert it to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).

The date might be in Arabic, English, or other languages. It might include relative terms like "yesterday", "today", "2 hours ago", etc.

Date string to parse: "${dateString}"
Article title for context: "${articleTitle}"
Current date/time: ${new Date().toISOString()}

Rules:
1. If it's a relative time (like "2 hours ago"), calculate from the current time
2. If it's in Arabic, translate and parse it
3. If it's incomplete (missing year), assume current year
4. If it's just a time, assume today's date
5. If parsing fails, use current date/time

Respond with ONLY the ISO 8601 formatted date string. Example: 2024-01-15T14:30:00Z

Do not include any explanation, just the date string.`;

    const result = await callGeminiApi(prompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.1, // Low temperature for consistent parsing
      maxTokens: 100
    });

    const parsedDateString = result.text.trim();
    
    // Validate the AI response
    const aiDate = new Date(parsedDateString);
    if (!isNaN(aiDate.getTime())) {
      return aiDate;
    } else {
      console.warn('AI returned invalid date:', parsedDateString);
      return new Date(); // Fallback
    }

  } catch (error) {
    console.error('AI date parsing failed:', error);
    return new Date(); // Fallback
  }
};

/**
 * Batch process multiple dates with AI
 */
export const parseMultipleDatesWithAI = async (articles) => {
  try {
    // Group articles for batch processing
    const chunkSize = 20; // Process 20 articles at a time
    const chunks = [];
    for (let i = 0; i < articles.length; i += chunkSize) {
      chunks.push(articles.slice(i, i + chunkSize));
    }

    const processedArticles = [];

    for (const chunk of chunks) {
      const prompt = `You are a date parsing expert. Parse the following date/time strings and convert each to ISO 8601 format.

Current date/time: ${new Date().toISOString()}

Articles with dates to parse:
${chunk.map((article, index) => `
${index + 1}. Date: "${article.date || 'No date'}"
   Title: "${article.title || 'No title'}"
`).join('')}

For each article, parse the date considering:
- Arabic dates and relative times
- English dates and relative times  
- Missing information (assume current year/date)
- Relative terms like "منذ ساعتين" (2 hours ago), "أمس" (yesterday), etc.

Respond with ONLY a JSON array of ISO 8601 date strings in the same order:
["2024-01-15T14:30:00Z", "2024-01-15T12:00:00Z", ...]

No explanation, just the JSON array.`;

      try {
        const result = await callGeminiApi(prompt, {
          model: 'gemini-2.0-flash',
          temperature: 0.1,
          maxTokens: 500
        });

        // Parse AI response
        const responseText = result.text.trim();
        let parsedDates = [];
        
        try {
          // Extract JSON array from response
          const jsonMatch = responseText.match(/\[(.*?)\]/s);
          if (jsonMatch) {
            parsedDates = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Error parsing AI date response:', parseError);
          // Fallback: use current date for all
          parsedDates = chunk.map(() => new Date().toISOString());
        }

        // Process the chunk with parsed dates
        chunk.forEach((article, index) => {
          const parsedDateString = parsedDates[index] || new Date().toISOString();
          const parsedDate = new Date(parsedDateString);
          
          processedArticles.push({
            ...article,
            originalDate: article.date,
            parsedDate: !isNaN(parsedDate.getTime()) ? parsedDate : new Date(),
            date: parsedDateString
          });
        });

      } catch (chunkError) {
        console.error('Error processing date chunk:', chunkError);
        // Fallback: use current date for this chunk
        chunk.forEach(article => {
          processedArticles.push({
            ...article,
            originalDate: article.date,
            parsedDate: new Date(),
            date: new Date().toISOString()
          });
        });
      }

      // Small delay between chunks
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Sort by parsed date (newest first)
    processedArticles.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

    return processedArticles;

  } catch (error) {
    console.error('Error in batch date parsing:', error);
    // Fallback: return articles with current dates
    return articles.map(article => ({
      ...article,
      originalDate: article.date,
      parsedDate: new Date(),
      date: new Date().toISOString()
    }));
  }
}; 
// Helper function to get the correct image URL based on source
export const getCorrectImageUrl = (article) => {
  // For Almayadeen source
  if (article.source && article.source.includes("almayadeen.net")) {
    // Get from fullContent.fullArticle.mainImage.url 
    if (article.fullContent?.fullArticle?.mainImage?.url) {
      return article.fullContent.fullArticle.mainImage.url;
    }
  }
  
  // For other sources, use standard image path hierarchy
  return article.fullContent?.mainImage || 
         article.imageUrl || 
         'https://via.placeholder.com/300x180?text=No+Image';
};

// Helper function to get a valid URL for an article
export const getArticleUrl = (article) => {
  // If there's a direct URL or link, use it
  if (article.url) return article.url;
  if (article.link) return article.link;
  if (article.fullContent?.url) return article.fullContent.url;
  if (article.fullContent?.link) return article.fullContent.link;
  
  // If there's a fullArticleLink, use it
  if (article.fullContent?.fullArticleLink) return article.fullContent.fullArticleLink;
  
  // If we have a source and ID, try to construct a URL
  if (article.source && article.id) {
    // Handle different source formats
    if (article.source.includes("almayadeen.net")) {
      return `https://www.almayadeen.net/news/${article.id}`;
    }
    
    // For other sources, create a generic placeholder with source and ID
    return `https://${article.source}/${article.id}`;
  }
  
  // Default placeholder
  return "#";
}; 
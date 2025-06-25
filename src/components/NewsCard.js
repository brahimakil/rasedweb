import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getCorrectImageUrl, getArticleUrl } from '../utils/helpers';
import { saveNewsItem } from '../utils/api';

const Card = styled.div`
  background-color: ${props => props.theme.surface};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
`;

const CardImage = styled.div`
  height: 180px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
    
    &:hover {
      transform: scale(1.05);
    }
  }
`;

const CardContent = styled.div`
  padding: 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const CardTitle = styled.h3`
  margin-bottom: 0.5rem;
  color: ${props => props.theme.text};
  font-size: 1.2rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardSource = styled.div`
  color: ${props => props.theme.primary};
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  font-weight: bold;
`;

const CardDate = styled.div`
  color: ${props => props.theme.secondary};
  font-size: 0.8rem;
  margin-bottom: 1rem;
`;

const CardCategory = styled.div`
  display: inline-block;
  background-color: ${props => props.theme.primary + '20'};
  color: ${props => props.theme.primary};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-top: auto;
`;

const CardSummary = styled.p`
  color: ${props => props.theme.text};
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ReadMoreButton = styled.button`
  background-color: transparent;
  color: ${props => props.theme.primary};
  border: 1px solid ${props => props.theme.primary};
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  align-self: flex-start;
  margin-top: 1rem;
  transition: background-color 0.2s ease, color 0.2s ease;
  
  &:hover {
    background-color: ${props => props.theme.primary};
    color: white;
  }
`;

const CardActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
`;

const FavoriteButton = styled.button.attrs(props => ({
  favoriting: undefined,
  favorited: undefined,
  className: `favorite-button ${props.favoriting ? 'favoriting' : ''} ${props.favorited ? 'favorited' : ''}`,
}))`
  background-color: ${props => 
    props.favorited 
      ? '#dc3545'
      : props.favoriting 
        ? '#6c757d'
        : 'transparent'
  };
  color: ${props => 
    props.favorited 
      ? 'white'
      : props.favoriting 
        ? 'white'
        : '#dc3545'
  };
  border: 1px solid #dc3545;
  padding: 0.5rem 1rem;
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

const CheckboxWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
`;

const SelectCheckbox = styled.input.attrs({ type: 'checkbox' })`
  margin-right: 0.5rem;
  cursor: pointer;
  width: 18px;
  height: 18px;
`;

const NewsCard = ({ 
  article, 
  onReadMore, 
  onToggleFavorite, 
  showFavoriteButton = true,
  onSelect, 
  isSelected, 
  showSelection 
}) => {
  const [favoriting, setFavoriting] = useState(false);
  
  // Use the preprocessed image URL if available, otherwise fall back to standard logic
  let imageUrl = article.processedImageUrl;
  
  if (!imageUrl) {
    // Fall back to the original logic if preprocessing didn't happen
    if (article.source === "almayadeen.net/politics" || 
        (article.source && article.source.includes("almayadeen.net"))) {
      if (article.fullContent?.fullArticle?.mainImage?.url) {
        imageUrl = article.fullContent.fullArticle.mainImage.url;
      }
    } else {
      imageUrl = article.fullContent?.mainImage || article.imageUrl;
    }
  }
  
  // If no image found, use placeholder
  if (!imageUrl) {
    imageUrl = 'https://via.placeholder.com/300x180?text=No+Image';
  }
  
  // Get a short summary from the plain text content or use preprocessed content
  const getSummary = () => {
    if (article.processedContent) {
      return article.processedContent.length > 150 
        ? article.processedContent.substring(0, 150) + '...' 
        : article.processedContent;
    }
    
    // Fall back to original logic if preprocessing didn't happen
    if (article.source === "almayadeen.net/politics" || 
        (article.source && article.source.includes("almayadeen.net"))) {
      // Original logic for Almayadeen content
      if (article.fullContent?.content && Array.isArray(article.fullContent.content)) {
        const paragraphContent = article.fullContent.content
          .filter(item => item.type === "paragraph")
          .map(item => item.content)
          .join(" ");
        
        if (paragraphContent) {
          return paragraphContent.length > 150 
            ? paragraphContent.substring(0, 150) + '...' 
            : paragraphContent;
        }
      }
    }
    
    // For other sources or fallback
    const content = article.fullContent?.plainTextContent || '';
    return content.length > 150 ? content.substring(0, 150) + '...' : content;
  };

  const handleToggleFavorite = async () => {
    if (favoriting) return;
    
    setFavoriting(true);
    try {
      await onToggleFavorite(article);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriting(false);
    }
  };

  return (
    <Card>
      {showSelection && (
        <CheckboxWrapper>
          <SelectCheckbox 
            checked={isSelected} 
            onChange={(e) => onSelect(article, e.target.checked)}
          />
        </CheckboxWrapper>
      )}
      <CardImage>
        <img src={imageUrl} alt={article.title} />
      </CardImage>
      <CardContent>
        <CardSource>{article.source}</CardSource>
        <CardTitle>{article.title}</CardTitle>
        <CardDate>{article.date}</CardDate>
        <CardSummary>{getSummary()}</CardSummary>
        {article.fullContent?.category && (
          <CardCategory>{article.fullContent.category}</CardCategory>
        )}
        <CardActions>
          <ReadMoreButton onClick={() => onReadMore(article)}>
            Read More
          </ReadMoreButton>
          
          {showFavoriteButton && (
            <FavoriteButton 
              onClick={handleToggleFavorite} 
              disabled={favoriting}
              favoriting={favoriting}
              favorited={article.isFavorited}
            >
              {favoriting ? 'Updating...' : article.isFavorited ? '❤️ Favorited' : '🤍 Favorite'}
            </FavoriteButton>
          )}
        </CardActions>
      </CardContent>
    </Card>
  );
};

export default NewsCard;

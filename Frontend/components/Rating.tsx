import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// import { Star } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

interface RatingProps {
  value: number;
  max?: number;
  size?: number;
  showValue?: boolean;
  reviews?: number;
}

export default function Rating({
  value,
  max = 5,
  size = 16,
  showValue = true,
  reviews,
}: RatingProps) {
  const fullStars = Math.floor(value);
  const halfStar = value - fullStars >= 0.5;
  const emptyStars = max - fullStars - (halfStar ? 1 : 0);
  
  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {[...Array(fullStars)].map((_, i) => (
        //   <Star
        //     key={`full-${i}`}
        //     size={size}
        //     color="#f1c40f"
        //     fill="#f1c40f"
        //   />
          <Icon name="star" key={`full-${i}`}
          size={size}
          color="#f1c40f"
          fill="#f1c40f"  />
        ))}
        
        {halfStar && (
          <View style={styles.halfStarContainer}>
            <Icon name="star" 
          size={size}
          color="#f1c40f"
          fill="#f1c40f" 
          style={styles.halfStar}
          />
            {/* <Star
              size={size}
              color="#f1c40f"
              fill="#f1c40f"
              style={styles.halfStar}
            /> */}
            <Icon name="star" 
              size={size}
              color="#f1c40f"
              style={styles.emptyHalfStar}
            />
          </View>
        )}
        
        {[...Array(emptyStars)].map((_, i) => (
          <Icon name="star" 
            key={`empty-${i}`}
            size={size}
            color="#f1c40f"
          />
        ))}
      </View>
      
      {showValue && (
        <Text style={styles.ratingText}>
          {value.toFixed(1)}
          {reviews !== undefined && (
            <Text style={styles.reviewsText}> ({reviews})</Text>
          )}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  halfStarContainer: {
    position: 'relative',
    width: 16,
    height: 16,
  },
  halfStar: {
    position: 'absolute',
    left: 0,
    width: 8,
    overflow: 'hidden',
  },
  emptyHalfStar: {
    position: 'absolute',
    right: 0,
    width: 8,
    overflow: 'hidden',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  reviewsText: {
    fontWeight: '400',
    color: '#999',
  },
});
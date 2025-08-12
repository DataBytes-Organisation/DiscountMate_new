import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
// import { Minus, Plus } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  minQuantity?: number;
  maxQuantity?: number;
}

export default function QuantitySelector({
  quantity,
  onIncrease,
  onDecrease,
  minQuantity = 1,
  maxQuantity = 99,
}: QuantitySelectorProps) {
  const isDecrementDisabled = quantity <= minQuantity;
  const isIncrementDisabled = quantity >= maxQuantity;
  
  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          isDecrementDisabled && styles.disabledButton,
        ]}
        onPress={onDecrease}
        disabled={isDecrementDisabled}
      >
        {/* <Minus size={16} color={isDecrementDisabled ? '#ccc' : '#333'} /> */}
        <Icon name="minus" size={16} color={isDecrementDisabled ? '#ccc' : '#333'}  />

      </Pressable>
      
      <View style={styles.quantityContainer}>
        <Text style={styles.quantity}>{quantity}</Text>
      </View>
      
      <Pressable
        style={[
          styles.button,
          isIncrementDisabled && styles.disabledButton,
        ]}
        onPress={onIncrease}
        disabled={isIncrementDisabled}
      >
       <Icon name="plus" size={16} color={isDecrementDisabled ? '#ccc' : '#333'}  />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  button: {
    padding: 8,
    backgroundColor: '#f5f5f5',
  },
  disabledButton: {
    backgroundColor: '#f0f0f0',
  },
  quantityContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    minWidth: 40,
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    fontWeight: '500',
  },
});
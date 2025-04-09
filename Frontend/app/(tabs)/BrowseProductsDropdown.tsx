import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const categories = [
  { name: 'Fruit & Veg', icon: 'lemon-o' },
  { name: 'Bakery', icon: 'birthday-cake' },
  { name: 'Poultry, Meat & Seafood', icon: 'cutlery' },
  { name: 'Deli & Chilled Meals', icon: 'snowflake-o' },
  { name: 'Dairy, Eggs & Fridge', icon: 'glass' },
  { name: 'Lunch Box', icon: 'briefcase' },
  { name: 'Pantry', icon: 'archive' },
  { name: 'International Foods', icon: 'globe' },
  { name: 'Snacks & Confectionery', icon: 'cookie' },
  { name: 'Freezer', icon: 'cube' },
];

const BrowseProductsDropdown = ({ onSelectCategory }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={() => setIsOpen(!isOpen)}>
        <Icon name="bars" size={20} color="#000" />
        <Text style={styles.buttonText}>Browse products</Text>
        <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#000" />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdown}>
          {categories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={styles.categoryItem}
              onPress={() => {
                onSelectCategory(category.name);
                setIsOpen(false);
              }}
            >
              <Icon name={category.icon} size={20} color="#000" style={styles.categoryIcon} />
              <Text style={styles.categoryText}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderColor: '#ddd',
    borderWidth: 1,
    marginTop: 5,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  categoryIcon: {
    marginRight: 10,
  },
  categoryText: {
    fontSize: 14,
  },
});

export default BrowseProductsDropdown;
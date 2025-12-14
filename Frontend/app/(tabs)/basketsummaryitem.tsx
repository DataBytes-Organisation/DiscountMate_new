import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import React, { Component } from 'react';
import { ScrollView, View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

interface basketsummaryitemprops {
    basketItemId?: number;
    price: number;
    productId: number;
    image: string;
    name: string;
    shortDescription: string;
    addToBasket: (productId: number) => void;
    removeFromBasket: (productId: number) => void;
    quantity: number;
    deleteItemFromBasket: (productId: number) => void;
  }
 
  interface basketsummaryitemstate {
   
  }
 
class basketsummaryitem extends Component<basketsummaryitemprops, basketsummaryitemstate> {
  constructor(props: basketsummaryitemprops) {
      super(props);
  }

  formattedCurrency(price: number) {
    const formatter = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
    });
    return formatter.format(price);
}

  render() {
    const { name, price, image, shortDescription, basketItemId, productId, addToBasket, removeFromBasket, quantity, deleteItemFromBasket } = this.props;
   
    return (
      <View style={styles.card}>
      <Image source={{ uri: image }} style={styles.image} />
      <View style={styles.details}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.price}>{this.formattedCurrency(price)}</Text>
        <Text style={styles.description}>{shortDescription}</Text>
        <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={() => deleteItemFromBasket(productId)}>
            <TabBarIcon name="trash-bin" color="#000" />
          </TouchableOpacity>
          <TouchableOpacity disabled={quantity == 0} onPress={() => removeFromBasket(productId)}>
          <TabBarIcon name="remove" color="#000" />
          </TouchableOpacity>
          <Text style={styles.amount}>{quantity}</Text>
          <TouchableOpacity onPress={() => addToBasket(productId)}>
          <TabBarIcon name="add" color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 10,
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  imageContainer: {
    flex: 1,
  },
  image: {
    width: 50,
    height: 60,
    borderRadius: 5,
  },
  details: {
    flex: 2,
    marginLeft: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  price: {
    fontSize: 16,
    color: '#888',
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  button: {
    backgroundColor: '#1e90ff',
    padding: 10,
    borderRadius: 5,
  },
  disabledbutton: {
    backgroundColor: '#ddd',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  amount: {
    marginHorizontal: 20,
    fontSize: 18,
  },
});


export default basketsummaryitem;

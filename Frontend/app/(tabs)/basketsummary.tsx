import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import BasketSummaryItem from './basketsummaryitem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSegments } from 'expo-router';

interface Basket {
  basketItemId: number;
  price: number;
  productId: string | number;
  image: string;
  name: string;
  shortDescription: string;
  quantity: number;
}

export default function basketsummary() {
  const [basketData, setBasketData] = useState<Basket[]>([]);
  const segments = useSegments();

  useEffect(() => {
    const fetchAndSetBasket = async () => {
      await getBasketItems();
      console.log('Fetched basket in use effect:', basketData);
    };
    fetchAndSetBasket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  const getBasketItems = async () => {
    console.log('Getting basket items');
    const url = 'http://localhost:3000/api/baskets/getbasket';
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBasketData(data);
    } catch (err) {
      console.error('Failed to fetch basket items:', err);
    }
  };

  const addToBasket = (productId: string | number) => {
    const basketItem = basketData.find((item) => item.productId === productId);
    const quantity =
      basketItem?.quantity === undefined ? 1 : basketItem.quantity + 1;
    updateQuantity(productId, quantity);
  };

  const removeFromBasket = (productId: string | number) => {
    const basketItem = basketData.find((item) => item.productId === productId);
    const current = basketItem?.quantity ?? 1;
    const quantity = Math.max(1, current - 1); // keep >= 1; use delete for removal
    updateQuantity(productId, quantity);
  };

  const deleteItemFromBasket = async (productId: string | number) => {
    const url = 'http://localhost:3000/api/baskets/deleteitemfrombasket';
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    const data = { productId };
    fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((data) => {
        setBasketData(data);
      })
      .catch((err) => console.error(err.message));
  };

  const updateQuantity = async (productId: string | number, quantity: number) => {
    const url = 'http://localhost:3000/api/baskets/updatequantity';
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    const data = { quantity, productId };
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((data) => {
        setBasketData(data);
      })
      .catch((err) => console.error(err.message));
  };

  const getTotal = (basket: Basket[]) => {
    let total = 0;
    for (let i = 0; i < basket.length; i++) {
      total += Number(basket[i].price || 0) * Number(basket[i].quantity || 0);
    }
    return total;
  };

  const formattedCurrency = (price: number) => {
    const formatter = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    });
    return formatter.format(price);
  };

  const total = getTotal(basketData);
  const array = basketData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={[styles.row, styles.my2]}>
        <View style={[styles.col, { alignItems: 'center' }]}>
          <Text style={[styles.h3, styles.textDark, styles.ml3]}>My Basket</Text>
        </View>
      </View>

      <View style={[styles.row, styles.mxAuto]}>
        {total > 0 ? (
          <View style={[styles.col, styles.alignItemsStretch]}>
            {array.map((item, index) => {
              const {
                productId,
                name,
                price,
                image,
                shortDescription,
                basketItemId,
                quantity,
              } = item;
              return (
                <View key={index} style={{ marginBottom: 12 }}>
                  <BasketSummaryItem
                    productId={productId}
                    name={name}
                    price={price}
                    image={image}
                    shortDescription={shortDescription}
                    quantity={quantity}
                    basketItemId={basketItemId}
                    addToBasket={addToBasket}
                    removeFromBasket={removeFromBasket}
                    deleteItemFromBasket={deleteItemFromBasket}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.col, styles.my5]}>
            <Text style={[styles.h3, styles.textCenter]}>
              Your basket is empty!
            </Text>
          </View>
        )}
      </View>

      <View style={styles.hr} />

      <View style={[styles.row, styles.my2]}>
        <View style={[styles.col, styles.textLeft, styles.ml3, styles.myAuto]}>
          <Text style={[styles.h4, styles.textDark, { fontWeight: 'bold' }]}>
            Basket Total: {total > 0 ? formattedCurrency(total) : ''}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F8FAFC' },
  inner: { padding: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  col: { flex: 1 },
  my2: { marginVertical: 10 },
  my5: { marginVertical: 50 },
  ml3: { marginLeft: 10 },
  mr3: { marginRight: 10 },
  mxAuto: { marginHorizontal: 'auto' as any },
  textRight: { alignItems: 'flex-end' },
  textLeft: { alignItems: 'flex-start' },
  textCenter: { textAlign: 'center' },
  textDark: { color: '#000' },
  h3: { fontSize: 20, fontWeight: 'bold' },
  h4: { fontSize: 18 },
  hr: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    marginVertical: 12,
  },
  myAuto: { marginVertical: 'auto' as any },
  alignItemsStretch: { alignItems: 'stretch' },
});

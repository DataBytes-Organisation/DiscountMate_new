import React, { Component } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BasketSummaryItem from './basketsummaryitem';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Basket
{
  basketItemId: number;
  price: number;
  productId: number;
  image: string;
  name: string;
  shortDescription: string;
  quantity: number;
}
interface BasketSummaryItemState
{
  basket: Basket[];
}
interface BasketSummaryItemProps
{
}
class basketsummary extends Component<BasketSummaryItemProps, BasketSummaryItemState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      basket: [],
    };
  }

    componentDidMount() {
        this.getBasketItems();
    }
    async getBasketItems() {
        const url = 'http://localhost:5000/getbasket';
        const token = await AsyncStorage.getItem('authToken');
   
        if (!token) {
          return;
        }
   
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .then(data => {
            this.setState({
              basket: data
            });
          })
          .catch(err => console.error(err.message));
      }
  addToBasket = (productId: number) =>
  {
    console.log("clicked add to basket", productId);
    const basketItem = this.state.basket.find(item => item.productId == productId);
    const quantity = basketItem?.quantity == undefined ? 0 : basketItem.quantity + 1;

    this.updateQuantity(productId, quantity);
  }

  removeFromBasket = (productId: number) =>
  {
    console.log("clicked remove from basket", productId);
    const basketItem = this.state.basket.find(item => item.productId == productId);
    const quantity = basketItem?.quantity == undefined ? 0 : basketItem.quantity - 1;

    this.updateQuantity(productId, quantity);
  }

  deleteItemFromBasket = async(productId: number) =>
  {
    const url = 'http://localhost:5000/deleteitemfrombasket';
    const token = await AsyncStorage.getItem('authToken');
   
    if (!token) {
      return;
    }

    const data = {
      productId: productId
    };

    fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(data => {
        this.setState({
          basket: data
        });
      })
      .catch(err => console.error(err.message));

  }
  private async updateQuantity(productId: number, quantity: number) {
    const url = 'http://localhost:5000/updatequantity';
    const token = await AsyncStorage.getItem('authToken');
    const data = {
      quantity: quantity,
      productId: productId
    };

    console.log("Add to basket for product id=", productId);
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(data => {
        this.setState({
          basket: data
        });
      })
      .catch(err => console.error(err.message));
  }

    getTotal(basket: Basket[]) {
        let total = 0;
        for (var i = 0; i < basket.length; i++) {
            total += basket[i].price * basket[i].quantity;
        }
        return total;
    }

    formattedCurrency(price: number) {
        const formatter = new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD'
        });
        return formatter.format(price);
    }

  render() {
    
    const total = this.getTotal(this.state.basket);

    const array = this.state.basket;

    return (
      <ScrollView>
        <View style={styles.fadeIn}>
          <View style={styles.row}>
            <View style={styles.col}>
            </View>
          </View>
          <View style={[styles.row, styles.my2]}>
            <View style={[styles.col, { alignItems: 'center'}]}>
              <Text style={[styles.h3, styles.textDark]}>My Basket</Text>
            </View>
            {/*<View style={[styles.col, styles.textRight]}>
              <Text style={[styles.h4, styles.textDark, styles.mr3, { fontWeight: 'bold' }]}>
                Basket Total: {total > 0 ? this.formattedCurrency(total) : ''}
              </Text>
            </View>*/}
          </View>
          <View style={[styles.row, styles.basketSummaryCustom, styles.mxAuto]}>
            {total > 0 ? (
              <View style={[styles.col, styles.alignItemsCenter]}>
                {array.map((item, index) => {
                  const { productId, name, price, image, shortDescription, basketItemId, quantity } = item;
                  return (
                    <BasketSummaryItem
                      key={index}
                      productId={productId}
                      //setView={setView}
                      name={name}
                      price={price}
                      image={image}
                      shortDescription={shortDescription}
                      quantity={quantity}
                      basketItemId={basketItemId}
                      addToBasket={this.addToBasket}
                      removeFromBasket={this.removeFromBasket}
                      deleteItemFromBasket={this.deleteItemFromBasket}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={[styles.col, styles.my5]}>
                <Text style={[styles.h3, styles.textCenter]}>Your basket is empty!</Text>
              </View>
            )}
          </View>
          <View style={styles.hr} />
          <View style={[styles.row, styles.my2]}>
            <View style={[styles.col, styles.textLeft, styles.ml3, styles.myAuto]}>
              <Text style={[styles.h4, styles.textDark, { fontWeight: 'bold' }]}>
                Basket Total: {total > 0 ? this.formattedCurrency(total) : ''}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }
}
const styles = StyleSheet.create({
  fadeIn: {
    // Add your fade-in styles here
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  col: {
    flex: 1,
  },
  my2: {
    marginVertical: 10,
  },
  my5: {
    marginVertical: 50,
  },
  ml3: {
    marginLeft: 10,
  },
  mr3: {
    marginRight: 10,
  },
  mxAuto: {
    marginHorizontal: 'auto',
  },
  textRight: {
    alignItems: 'flex-end',
  },
  textLeft: {
    alignItems: 'flex-start',
  },
  textCenter: {
    textAlign: 'center',
  },
  textDark: {
    color: '#000',
  },
  textSecondary: {
    color: '#888',
  },
  h3: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  h4: {
    fontSize: 18,
  },
  h5: {
    fontSize: 16,
  },
  basketSummaryCustom: {
    // Add your custom styles here
  },
  alignItemsCenter: {
    alignItems: 'center',
  },
  hr: {
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    marginVertical: 10,
  },
  myAuto: {
    marginVertical: 'auto',
  },
  checkoutButton: {
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 5,
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
});

export default basketsummary;
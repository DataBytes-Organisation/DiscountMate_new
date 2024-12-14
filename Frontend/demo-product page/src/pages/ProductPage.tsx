import React from 'react';
import { useParams } from 'react-router-dom';
import { products } from '../services/products';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Get product ID from route
  const product = products.find((p) => p.id === Number(id)); // Find products by ID

  if (!product) {
    return <h1>Product not found</h1>; // If the product does not exist, an error message is displayed
  }

  return (
    <div style={{ padding: '16px', textAlign: 'center' }}>
      <img
        src={product.image}
        alt={product.name}
        style={{ width: '300px', height: '300px', marginBottom: '16px' }}
      />
      <h1>{product.name}</h1>
      <p style={{ fontSize: '18px', marginBottom: '8px' }}>Price: ${product.price.toFixed(2)}</p>
      <p style={{ fontSize: '16px', color: '#555' }}>{product.description}</p>
    </div>
  );
};

export default ProductPage;

import React, { useState } from 'react';
import { products } from '../services/products';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type Product = {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
};

const HomePage: React.FC = () => {
  const { addToCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Handling the "Add to Cart" Button
  const handleAddToCart = (product: Product) => {
    addToCart({ ...product, quantity: 1 });
    toast.success(`${product.name} has been added to the cart!`, {
      position: 'top-center',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  // Handling the "View Details" button
  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
  };

  // Close overlay interface
  const handleCloseDetails = () => {
    setSelectedProduct(null);
  };

  return (
    <div>
      {/* React Toastify Container */}
      <ToastContainer />

      {/* Product List */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            price={product.price}
            description={product.description}
            image={product.image}
            onAddToCart={() => handleAddToCart(product)}
            onViewDetails={() => handleViewDetails(product)}
          />
        ))}
      </div>

      {/* Pop-up overlay interface */}
      {selectedProduct && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              width: '400px',
              textAlign: 'center',
            }}
          >
            <h2>{selectedProduct.name}</h2>
            <img
              src={selectedProduct.image}
              alt={selectedProduct.name}
              style={{ width: '150px', height: '150px', marginBottom: '16px' }}
            />
            <p>{selectedProduct.description}</p>
            <p>Price: ${selectedProduct.price.toFixed(2)}</p>
            <button
              onClick={handleCloseDetails}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;

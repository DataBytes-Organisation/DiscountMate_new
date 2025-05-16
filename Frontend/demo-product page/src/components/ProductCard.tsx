import React from 'react';
import styled from 'styled-components';

type ProductCardProps = {
  name: string;
  price: number;
  description: string;
  image: string;
  onAddToCart: () => void;
  onViewDetails: () => void;
};

const Card = styled.div`
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 16px;
  margin: 16px;
  text-align: center;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Button = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 4px;
  margin: 8px;

  &:hover {
    background-color: #0056b3;
  }
`;

const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  description,
  image,
  onAddToCart,
  onViewDetails,
}) => (
  <Card>
    <img src={image} alt={name} style={{ width: '150px', height: '150px', marginBottom: '8px' }} />
    <h3>{name}</h3>
    <p>Price: ${price.toFixed(2)}</p>
    <div>
      <Button onClick={onAddToCart}>Add to Cart</Button>
      <Button onClick={onViewDetails}>View Details</Button>
    </div>
  </Card>
);

export default ProductCard;

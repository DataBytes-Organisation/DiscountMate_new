import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const NavbarContainer = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background-color: #007bff;
  color: white;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 16px;

  a {
    color: white;
    text-decoration: none;
    font-weight: bold;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const Navbar: React.FC = () => {
  return (
    <NavbarContainer>
      <h1>DiscountMate</h1>
      <NavLinks>
        <Link to="/">Home</Link>
        <Link to="/cart">Cart</Link>
      </NavLinks>
    </NavbarContainer>
  );
};

export default Navbar;

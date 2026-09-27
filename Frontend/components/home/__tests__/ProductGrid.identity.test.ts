import { mapApiProductToCard } from "../ProductGrid";

jest.mock("@react-native-async-storage/async-storage", () => ({
   getItem: jest.fn(),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("ProductGrid comparison identity", () => {
   it("preserves Mongo catalogue identity metadata for saved-list mapping", () => {
      const product = mapApiProductToCard({
         _id: "507f1f77bcf86cd799439099",
         product_name: "Devondale Full Cream Milk",
         product_code: "milk-2l",
         brand: "Devondale",
         gtin: "9300000000001",
         unit_per_prod: 2,
         measurement: "L",
         current_price: 3.49,
      });

      expect(product.id).toBe("507f1f77bcf86cd799439099");
      expect(product.brand).toBe("Devondale");
      expect(product.gtin).toBe("9300000000001");
      expect(product.packQuantity).toBe("2");
      expect(product.packUom).toBe("L");
   });
});

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, CartItemOption, Dish } from '@/types';

interface CartContextType {
  items: CartItem[];
  addToCart: (dish: Dish, options?: CartItemOption[], quantity?: number, instructions?: string) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'torisakura_cart_v2'; // Bumped key to completely purge old mock items

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      // Clear legacy storage key if exists
      localStorage.removeItem('torisakura_cart_v1');
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: CartItem[] = JSON.parse(saved);
        // Exclude any default mock items
        return parsed.filter((item) => !item.id.includes('default'));
      }
    } catch (e) {
      console.error('Failed to load cart from storage', e);
    }
    // Default: Strictly empty cart for production
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to storage', e);
    }
  }, [items]);

  // Listen to open-cart-drawer event from Navbar/MobileNav
  useEffect(() => {
    const handleOpen = () => setIsCartOpen(true);
    window.addEventListener('open-cart-drawer', handleOpen);
    return () => window.removeEventListener('open-cart-drawer', handleOpen);
  }, []);

  const addToCart = (
    dish: Dish,
    options: CartItemOption[] = [],
    quantity = 1,
    instructions?: string
  ) => {
    const optionIds = options.map((o) => o.optionId).sort().join('_');
    const compositeId = `${dish.id}-${optionIds || 'base'}`;
    const modifiersTotal = options.reduce((sum, opt) => sum + opt.priceAdjustment, 0);
    const unitPrice = dish.price + modifiersTotal;

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === compositeId);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          specialInstructions: instructions || next[existingIndex].specialInstructions,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: compositeId,
          dishId: dish.id,
          code: dish.code,
          name: dish.name,
          japaneseName: dish.japaneseName,
          imageUrl: dish.imageUrl,
          basePrice: dish.price,
          selectedOptions: options,
          modifiersPrice: modifiersTotal,
          totalUnitPrice: unitPrice,
          quantity,
          specialInstructions: instructions,
        },
      ];
    });

    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.totalUnitPrice * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

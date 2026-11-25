import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Product } from '../data/products';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

function getActivePromotion(product: Product) {
  const now = new Date();
  return product.promotions?.find((promotion) => {
    const starts = !promotion.validFrom || new Date(promotion.validFrom) <= now;
    const ends = !promotion.validUntil || new Date(promotion.validUntil) >= now;
    return promotion.isActive && starts && ends && Number(promotion.discountPercentage) > 0;
  });
}

function getProductPrice(product: Product): number {
  const price = Number(product.price ?? product.preco ?? 0);
  const promotion = getActivePromotion(product);
  return promotion ? price * (1 - Number(promotion.discountPercentage) / 100) : price;
}

export interface CartItem {
  id?: number;
  product: Product;
  size: string;
  quantity: number;
}

interface CartContextData {
  cartItems: CartItem[];
  cartLoading: boolean;
  cartError: string | null;
  reloadCart: () => void;
  addToCart: (product: Product, size: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string, size: string) => Promise<void>;
  updateQuantity: (productId: string, size: string, delta: number) => Promise<void>;
  clearCart: () => void;
  totalCartValue: number;
  cartCount: number;
}

interface CartProviderProps {
  children: ReactNode;
}

interface ServerCartItem {
  id: number;
  quantity: number;
  size?: string;
  Product?: Product;
  product?: Product;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartRequest, setCartRequest] = useState(0);
  const { user, isAuthenticated } = useAuth();

  const reloadCart = useCallback(() => {
    setCartRequest((request) => request + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCartItems([]);
      setCartError(null);
      setCartLoading(false);
      return;
    }

    let active = true;
    setCartLoading(true);
    setCartError(null);
    api.get('cart').then(({ data }) => {
      if (!active) return;
      const serverItems: ServerCartItem[] = Array.isArray(data) ? data : data.items ?? [];
      const mappedItems = serverItems.map((item): CartItem | null => {
        const product = item.product ?? item.Product;
        if (!product) return null;

        return {
          id: item.id,
          quantity: item.quantity,
          size: item.size ?? '',
          product,
        };
      }).filter((item): item is CartItem => item !== null);

      setCartItems(mappedItems);
    }).catch((error: unknown) => {
      if (!active) return;
      console.error('Não foi possível carregar o carrinho:', error);
      const requestError = error as { response?: { data?: { message?: string } } };
      setCartError(
        requestError.response?.data?.message
          ?? 'Falha de conexão ao carregar o carrinho. Tente novamente.',
      );
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar carrinho',
        text2: requestError.response?.data?.message ?? 'Não foi possível consultar seu carrinho.',
      });
    }).finally(() => {
      if (active) setCartLoading(false);
    });

    return () => { active = false; };
  }, [cartRequest, isAuthenticated, user?.id]);

  const addToCart = async (product: Product, size: string, quantity: number) => {
    const { data } = await api.post<{ id: number }>('cart', {
      productId: Number(product.id),
      quantity,
      size,
    });

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.size === size
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].id = data.id ?? updated[existingIndex].id;
        updated[existingIndex].quantity += quantity;
        return updated;
      }

      return [...prev, { id: data.id, product, size, quantity }];
    });
    setCartError(null);
  };

  const removeFromCart = async (productId: string, size: string) => {
    const item = cartItems.find((entry) => String(entry.product.id) === String(productId) && entry.size === size);
    if (item?.id) await api.delete(`cart/${item.id}`);

    setCartItems((prev) =>
      prev.filter(
        (item) => !(String(item.product.id) === String(productId) && item.size === size)
      )
    );
  };

  const updateQuantity = async (productId: string, size: string, delta: number) => {
    const item = cartItems.find((entry) => String(entry.product.id) === String(productId) && entry.size === size);
    if (!item?.id) return;
    const newQuantity = item.quantity + delta;

    if (newQuantity < 1) {
      await removeFromCart(productId, size);
      return;
    }

    await api.put(`cart/${item.id}`, { quantity: newQuantity });
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (String(item.product.id) === String(productId) && item.size === size) {
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalCartValue = cartItems.reduce(
    (sum, item) => sum + getProductPrice(item.product) * item.quantity,
    0
  );

  const cartCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartLoading,
        cartError,
        reloadCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCartValue,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  return context;
}
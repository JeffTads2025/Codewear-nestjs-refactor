import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';

import { Product } from '../data/products';
import { api, getApiAssetUrl } from '../services/api';
import { RootStackParamList } from '../routes';
import { ClientTabParamList } from '../routes/ClientTopTabs';
import { useCart } from '../context/CartContext';
import { sortSizes } from '../utils/sizes';
import { AuthUser, useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

type NavigationProp = CompositeNavigationProp<
  MaterialTopTabNavigationProp<ClientTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface ProductCardProps {
  product: Product;
  cardWidth: ViewStyle['width'];
  currentSize: string;
  currentQty: number;
  sizeTouched: boolean;
  imageUri?: string;
  imageFailed: boolean;
  onSelectSize: (productId: string, size: string) => void;
  onChangeQuantity: (product: Product, size: string, delta: number) => void;
  onBuy: (product: Product, size: string, quantity: number) => void;
  onOpenProduct: (product: Product) => void;
}

const ProductCard = memo(({
  product,
  cardWidth,
  currentSize,
  currentQty,
  sizeTouched,
  imageUri,
  imageFailed,
  onSelectSize,
  onChangeQuantity,
  onBuy,
  onOpenProduct,
}: ProductCardProps) => {
  const imageSource = imageUri && !imageFailed
    ? { uri: imageUri }
    : { uri: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23222%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2212%22%3EImagem não disponível%3C/text%3E%3C/svg%3E' };
  const productId = String(product.id);
  const price = Number(product.price ?? product.preco ?? 0);
  const stock = Number(product.stock ?? product.estoque ?? 0);
  const isOutOfStock = stock === 0;
  const activePromotion = product.promotions?.find((promotion) => {
    const now = new Date();
    return promotion.isActive
      && (!promotion.validFrom || new Date(promotion.validFrom) <= now)
      && (!promotion.validUntil || new Date(promotion.validUntil) >= now)
      && Number(promotion.discountPercentage) > 0;
  });
  const promotionalPrice = activePromotion
    ? price * (1 - Number(activePromotion.discountPercentage) / 100)
    : price;
  const hasSizeInventory = product.sizes?.some((entry) => typeof entry !== 'string') ?? false;
  const unavailableSelectedSize = product.sizes?.some(
    (entry) => typeof entry !== 'string' && entry.size === currentSize && Number(entry.stock) <= 0,
  ) ?? false;

  return (
    <View style={[styles.productCard, { width: cardWidth }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenProduct(product)}>
        <Image source={imageSource} style={styles.productImage} resizeMode="cover" />
      </TouchableOpacity>

      <View style={styles.cardDetails}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.promotionSlot}>
          {activePromotion && (
            <Text style={styles.promotionText}>
              {Number(activePromotion.discountPercentage)}% OFF
            </Text>
          )}
        </View>
        {isOutOfStock ? (
          <Text style={styles.outOfStockText}>❌ Esgotado</Text>
        ) : (
          <Text style={styles.inStockText}>✅ Disp: {stock} un</Text>
        )}
        <Text style={styles.productDescription} numberOfLines={2}>
          {(product.description && product.description.trim() !== '')
            ? product.description
            : 'Camiseta unissex, fabricada em algodão'}
        </Text>

        <View style={styles.sizeRow}>
          {sortSizes(product.sizes || ['P', 'M', 'G', 'GG']).map((size) => {
            const sizeName = typeof size === 'string' ? size : size.size;
            const sizeRecord = product.sizes?.find(
              (entry) => typeof entry !== 'string' && entry.size === sizeName,
            );
            const sizeStock = sizeRecord && typeof sizeRecord !== 'string'
              ? Number(sizeRecord.stock)
              : Number(product.stock ?? product.estoque ?? 0);
            const sizeUnavailable = hasSizeInventory && sizeStock <= 0;
            const isSelected = currentSize === sizeName;
            return (
              <TouchableOpacity
                key={sizeName}
                style={[
                  styles.sizeBtn,
                  isSelected && styles.sizeBtnSelected,
                  sizeUnavailable && styles.sizeBtnDisabled,
                ]}
                onPress={() => onSelectSize(productId, sizeName)}
                disabled={isOutOfStock}
              >
                <Text style={[styles.sizeBtnText, isSelected && styles.sizeBtnTextSelected]}>
                  {sizeName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {sizeTouched && unavailableSelectedSize && (
          <Text style={styles.sizeUnavailableText}>
            Estoque indisponível para o tamanho {currentSize}.
          </Text>
        )}

        <View style={styles.cardFooter}>
          <View>
            {activePromotion && (
              <Text style={styles.originalPrice}>R$ {price.toFixed(2).replace('.', ',')}</Text>
            )}
            <Text style={styles.productPrice} numberOfLines={1}>
              R$ {promotionalPrice.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.actionsContainerMobile}>
            <View style={styles.qtyControlMobile}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => onChangeQuantity(product, currentSize, -1)}
                disabled={isOutOfStock}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{currentQty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => onChangeQuantity(product, currentSize, 1)}
                disabled={isOutOfStock}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {isOutOfStock || unavailableSelectedSize ? (
              <View style={[styles.buyBtnMobile, styles.buyBtnDisabled]}>
                <Text style={styles.buyBtnTextDisabled}>Indisponível</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.buyBtnMobile}
                onPress={() => onBuy(product, currentSize, currentQty)}
              >
                <Text style={styles.buyBtnText}>Comprar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { addToCart, cartCount } = useCart();
  const { isAuthenticated, signOut, user: profile, setUser } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const isMobile = windowWidth < 600;
  const cardWidth = isMobile ? (windowWidth - 34) / 2 : '48.5%';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const [selectedSizes, setSelectedSizes] = useState<{ [key: string]: string }>({});
  const [selectedSizesTouched, setSelectedSizesTouched] = useState<{ [key: string]: boolean }>({});
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ products: Product[] } | Product[]>('products?limit=100');
      const productsFromApi = Array.isArray(response.data)
        ? response.data
        : response.data.products;

      setProductsError(null);
      setProducts(productsFromApi.filter((product) => product.isVisible !== false).map((product) => ({
        ...product,
        image: getApiAssetUrl(product.image ?? product.image_url),
        description: product.description ?? product.descricao,
        sizes: product.sizes?.length ? product.sizes : ['P', 'M', 'G', 'GG'],
      })));
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setProductsError('Não foi possível conectar à API para carregar os produtos. Verifique a rede e tente novamente.');
      Toast.show({ type: 'error', text1: 'Erro de conexão', text2: 'Não foi possível carregar os produtos.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadProducts();
    if (isAuthenticated) {
      api.get<AuthUser>('users/profile').then(({ data }) => setUser(data)).catch((error) => {
        console.warn('Não foi possível atualizar o perfil:', error);
      });
    }
  }, [isAuthenticated, loadProducts, setUser]));

  const avatarUrl = getApiAssetUrl(profile?.avatarUrl);
  const avatarSource = avatarUrl ? { uri: avatarUrl } : undefined;

  const stockedProducts = products.filter((product) => Number(product.stock ?? product.estoque ?? 0) > 0);

  useEffect(() => {
    if (stockedProducts.length < 2) return;
    const timer = setInterval(() => setCarouselIndex((current) => (current + 1) % stockedProducts.length), 3500);
    return () => clearInterval(timer);
  }, [stockedProducts.length]);

  const handleSelectSize = useCallback((productId: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
    setSelectedSizesTouched((prev) => ({ ...prev, [productId]: true }));
  }, []);

  const handleQuantityChange = useCallback((product: Product, selectedSize: string, delta: number) => {
    const productId = String(product.id);
    const selectedSizeRecord = product.sizes?.find((size) => typeof size !== 'string' && size.size === selectedSize);
    const availableStock = selectedSizeRecord && typeof selectedSizeRecord !== 'string'
      ? selectedSizeRecord.stock
      : Number(product.stock ?? product.estoque ?? 0);
    setQuantities((prev) => {
      const current = prev[productId] || 1;
      const next = current + delta;
      return { ...prev, [productId]: Math.max(1, Math.min(next, availableStock || 1)) };
    });
  }, []);

  const handleBuy = useCallback((product: Product, size: string, quantity: number) => {
    if (!isAuthenticated) {
      Toast.show({ type: 'info', text1: 'Faça login para comprar', text2: 'Entre na sua conta antes de acessar o carrinho.' });
      navigation.navigate('Login');
      return;
    }
    const sizeRecord = product.sizes?.find((item) => typeof item !== 'string' && item.size === size);
    const hasSizeInventory = product.sizes?.some((item) => typeof item !== 'string') ?? false;
    const stock = hasSizeInventory
      ? (sizeRecord && typeof sizeRecord !== 'string' ? Number(sizeRecord.stock) : 0)
      : Number(product.stock ?? product.estoque ?? 0);

    if (stock <= 0) {
      Toast.show({ type: 'error', text1: 'Estoque indisponível', text2: `O tamanho ${size} não está disponível.` });
      return;
    }

    const qty = Math.min(quantity, stock);
    void addToCart(product, size, qty)
      .then(() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('ClientApp', { screen: 'Cart' }))
      .catch((error: unknown) => {
        const requestError = error as { response?: { data?: { message?: string } } };
        Toast.show({ type: 'error', text1: 'Estoque indisponível', text2: requestError.response?.data?.message ?? `O tamanho ${size} não está disponível.` });
      });
  }, [addToCart, isAuthenticated, navigation]);

  const navigateToClientTab = (screen: 'Cart' | 'Orders') => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('ClientApp', { screen });
  };

  const getImageSource = useCallback((image?: string) => {
    const imageUrl = getApiAssetUrl(image);
    if (!imageUrl || failedImages.has(imageUrl)) {
      return { uri: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23222%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2212%22%3EImagem não disponível%3C/text%3E%3C/svg%3E' };
    }
    return { uri: imageUrl };
  }, [failedImages]);

  const handleLogout = async () => {
    await signOut();
    setMenuOpen(false);
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.reset({
      index: 0,
      routes: [{ name: 'ClientApp' }],
    });
  };

  const requireLogin = useCallback(() => {
    if (isAuthenticated) return true;
    Toast.show({ type: 'info', text1: 'Faça login para continuar', text2: 'Esta área é exclusiva para clientes autenticados.' });
    navigation.navigate('Login');
    return false;
  }, [isAuthenticated, navigation]);

  const handleOpenProduct = useCallback((product: Product) => {
    if (requireLogin()) navigation.navigate('ProductDetail', { product });
  }, [navigation, requireLogin]);

  const renderProduct = useCallback(({ item }: { item: Product }) => {
    const productId = String(item.id);
    const imageUri = getApiAssetUrl(item.image ?? item.image_url);
    return (
      <ProductCard
        product={item}
        cardWidth={cardWidth}
        currentSize={selectedSizes[productId] || 'M'}
        currentQty={quantities[item.id] || (Number(item.stock ?? item.estoque ?? 0) > 0 ? 1 : 0)}
        sizeTouched={!!selectedSizesTouched[productId]}
        imageUri={imageUri}
        imageFailed={!imageUri || failedImages.has(imageUri)}
        onSelectSize={handleSelectSize}
        onChangeQuantity={handleQuantityChange}
        onBuy={handleBuy}
        onOpenProduct={handleOpenProduct}
      />
    );
  }, [
    cardWidth,
    failedImages,
    handleBuy,
    handleOpenProduct,
    handleQuantityChange,
    handleSelectSize,
    quantities,
    selectedSizes,
    selectedSizesTouched,
  ]);

  const renderEmptyState = useCallback(() => {
    if (loading) return <ActivityIndicator color="#FFCC00" size="large" />;
    if (productsError) {
      return (
        <View style={styles.productLoadError}>
          <Text style={styles.emptyText}>{productsError}</Text>
          <TouchableOpacity onPress={() => void loadProducts()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <Text style={styles.emptyText}>Nenhum produto cadastrado.</Text>;
  }, [loadProducts, loading, productsError]);

  const carouselProduct = stockedProducts[carouselIndex % Math.max(stockedProducts.length, 1)];

  return (
    <SafeAreaView edges={['top']} style={styles.outerContainer}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <View style={styles.brandBar}>
        <Text style={styles.brandBarSymbol}>{'</>'}</Text>
        <Text style={styles.brandBarTitle}>CodeWear</Text>
      </View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.headerLeft}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity disabled={isAuthenticated} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.greeting} numberOfLines={1}>
              {isAuthenticated ? `Olá, ${profile?.name?.split(' ')[0] || 'cliente'} !` : 'FAÇA LOGIN!'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => requireLogin() && navigation.navigate('Profile')}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.avatarText}>
                  {profile?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => requireLogin() && navigateToClientTab('Cart')}
          >
            <Text style={styles.cartIcon}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[styles.container, styles.productListContent]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.carousel}
          disabled={!stockedProducts.length}
          onPress={() => {
            if (carouselProduct) handleOpenProduct(carouselProduct);
          }}
        >
          {stockedProducts.length && carouselProduct ? (
            <Image
              source={getImageSource(carouselProduct.image ?? carouselProduct.image_url)}
              style={styles.carouselImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.bannerSubtitle}>
              {productsError ? 'Falha ao conectar à API' : 'Nenhum produto em estoque'}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.dotsRow}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.sectionTitle}>Produtos em Destaque</Text>
        <View style={styles.gridContainer}>
          {loading || productsError || products.length === 0
            ? renderEmptyState()
            : products.map((item) => (
              <React.Fragment key={String(item.id)}>
                {renderProduct({ item })}
              </React.Fragment>
            ))}
        </View>
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.menuPanel}
          >
            <TouchableOpacity onPress={() => setMenuOpen(false)} style={styles.menuHeader}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                requireLogin() && navigation.navigate('Profile');
              }}
            >
              <Text style={styles.menuText}>Meu perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                requireLogin() && navigateToClientTab('Orders');
              }}
            >
              <Text style={styles.menuText}>Meus pedidos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                requireLogin() && navigateToClientTab('Cart');
              }}
            >
              <Text style={styles.menuText}>Carrinho</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                requireLogin() && navigation.navigate('Contact');
              }}
            >
              <Text style={styles.menuText}>Contato</Text>
            </TouchableOpacity>
            {profile?.role === 'admin' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  requireLogin() && navigation.navigate('AdminApp');
                }}
              >
                <Text style={styles.menuText}>Administração</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                handleLogout();
              }}
            >
              <Text style={styles.menuText}>Sair</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 40,
  },
  productListContent: {
    paddingBottom: 16,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    width: '100%',
    paddingBottom: 4,
    paddingHorizontal: 16,
    backgroundColor: '#0A0A0A',
  },
  brandBarSymbol: {
    color: '#C0C0C0',
    fontWeight: 'bold',
    fontSize: 21,
  },
  brandBarTitle: {
    color: '#C0C0C0',
    fontSize: 21,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 56,
    paddingHorizontal: 8,
    gap: 8,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    color: '#ffcc00',
    fontSize: 12,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  menuIcon: {
    color: '#ffcc00',
    fontSize: 22,
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  headerAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffcc00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14
  },
  cartButton: {
    position: 'relative',
    padding: 8,
    marginRight: 4,
  },
  cartIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  menuPanel: {
    width: 260,
    height: '100%',
    backgroundColor: '#171717',
    padding: 16,
  },
  menuHeader: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2b2b2b',
    alignItems: 'flex-start',
  },
  menuItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#2b2b2b',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  menuText: {
    color: '#fff',
    fontSize: 16
  },
  carousel: { height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: '#161616', marginBottom: 24, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  carouselImage: { width: '100%', height: 180 },
  carouselCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.62)' },
  bannerSubtitle: {
    color: '#888',
    fontSize: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#FFCC00',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  productCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
    minHeight: 550,
  },
  productImage: {
    width: '100%',
    height: 210,
    backgroundColor: '#1E1E1E',
  },
  cardDetails: {
    flex: 1,
    padding: 8,
  },
  productName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 3,
    minHeight: 30,
  },
  inStockText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  outOfStockText: {
    color: '#FF5252',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  productDescription: {
    color: '#888',
    fontSize: 10,
    marginVertical: 3,
    marginBottom: 6,
    lineHeight: 13,
    minHeight: 16,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: 2,
  },
  sizeBtn: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sizeBtnSelected: {
    backgroundColor: '#FFCC00',
    borderColor: '#FFCC00',
  },
  sizeBtnDisabled: {
    opacity: 0.4,
  },
  sizeBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sizeBtnTextSelected: {
    color: '#000',
  },
  sizeUnavailableText: {
    color: '#FF5252',
    fontSize: 10,
    marginBottom: 4,
  },
  productPrice: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  originalPrice: { color: '#888', fontSize: 11, textDecorationLine: 'line-through' },
  cardFooter: {
    marginTop: 'auto',
    paddingTop: 4,
  },
  actionsContainerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  qtyControlMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: '100%',
  },
  qtyBtn: {
    paddingHorizontal: 4,
  },
  qtyBtnText: {
    color: '#FFCC00',
    fontWeight: 'bold',
    fontSize: 14,
  },
  qtyText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  buyBtnMobile: {
    width: '100%',
    backgroundColor: '#FFCC00',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: '#2A2A2A',
  },
  buyBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  buyBtnTextDisabled: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    width: '100%',
    paddingVertical: 24,
  },
  productLoadError: {
    alignItems: 'center',
    width: '100%',
  },
  retryText: {
    color: '#FFCC00',
    fontWeight: 'bold',
    padding: 12,
  },
  promotionText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#173523',
    borderRadius: 4,
  },
  promotionSlot: {
    minHeight: 24,
    marginBottom: 1,
  },
});
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { CartItem, useCart } from '../context/CartContext';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';
import { ClientTabParamList } from '../routes/ClientTopTabs';

type NavigationProp = MaterialTopTabNavigationProp<ClientTabParamList, 'Cart'>;

export function CartScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    cartItems,
    cartLoading,
    cartError,
    reloadCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao'>('pix');
  const [address, setAddress] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);

  React.useEffect(() => {
    api.get('users/profile')
      .then(({ data }) => {
        setAddress(data.address || '');
        setProfileError(null);
      })
      .catch((error: unknown) => {
        console.error('Não foi possível carregar o endereço do perfil:', error);
        setProfileError('Falha de conexão ao carregar o endereço de entrega.');
      });
  }, []);

  const getImageSource = (image: string | undefined) => image && image.trim() !== ''
    ? { uri: image }
    : { uri: 'https://images.unsplash.com/photo-1521572267360-ee0c290a518?w=500' };

  const getPromotionalPrice = (item: CartItem) => {
    const price = Number(item.product.price ?? item.product.preco ?? 0);
    const now = new Date();
    const promotion = item.product.promotions?.find((candidate) => candidate.isActive
      && (!candidate.validFrom || new Date(candidate.validFrom) <= now)
      && (!candidate.validUntil || new Date(candidate.validUntil) >= now)
      && Number(candidate.discountPercentage) > 0);
    return { price, finalPrice: promotion ? price * (1 - Number(promotion.discountPercentage) / 100) : price, hasPromotion: Boolean(promotion) };
  };

  const subtotal = cartItems.reduce((sum, item) => sum + getPromotionalPrice(item).finalPrice * item.quantity, 0);
  const totalAmount = subtotal;

  const handleFinishPurchase = async () => {
    try {
      setLoadingPurchase(true);
      if (!address.trim()) {
        Toast.show({ type: 'info', text1: 'Endereço obrigatório', text2: 'Informe o endereço de entrega.' });
        return;
      }
      await api.post('checkout', { paymentMethod, address: address.trim() });
      Toast.show({ type: 'success', text1: 'Compra realizada', text2: 'Seu pedido foi criado com sucesso.' });
      clearCart();
      navigation.navigate('Home');
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Erro na compra', text2: requestError.response?.data?.message ?? 'Não foi possível finalizar a compra.' });
    } finally {
      setLoadingPurchase(false);
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Continuar Comprando</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seu Carrinho 🛒</Text>
        {cartLoading ? (
          <View style={styles.emptyContainer}><ActivityIndicator color="#ffcc00" /></View>
        ) : cartError ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.errorText}>{cartError}</Text>
            <TouchableOpacity onPress={reloadCart}><Text style={styles.retryText}>Tentar novamente</Text></TouchableOpacity>
          </View>
        ) : cartItems.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Seu carrinho está vazio.</Text></View> : <>
          <View style={styles.itemsList}>
            {cartItems.map((item) => {
              const { price, finalPrice, hasPromotion } = getPromotionalPrice(item);
              const productIdString = String(item.product.id);
              return <View key={`${item.product.id}-${item.size}`} style={styles.cartCard}>
                <Image source={getImageSource(item.product.image || item.product.image_url || item.product.imagemUrl)} style={styles.itemImage} resizeMode="cover" />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product.name ?? item.product.nome ?? 'Produto'}</Text>
                  <Text style={styles.itemSize}>Tamanho: {item.size}</Text>
                  <Text style={styles.itemPrice} numberOfLines={1}>
                    {hasPromotion && <Text style={styles.originalItemPrice}>R$ {price.toFixed(2).replace('.', ',')} </Text>}
                    R$ {finalPrice.toFixed(2).replace('.', ',')}
                  </Text>
                  <View style={styles.qtyContainer}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(productIdString, item.size, -1)}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(productIdString, item.size, 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(productIdString, item.size)}><Text style={styles.removeBtnText}>🗑 Rem</Text></TouchableOpacity>
              </View>;
            })}
          </View>
          <View style={styles.footer}>
            <Text style={styles.checkoutSectionTitle}>Forma de pagamento</Text>
            <View style={styles.paymentRow}>{(['pix', 'cartao'] as const).map((method) => <TouchableOpacity key={method} style={[styles.paymentButton, paymentMethod === method && styles.paymentButtonSelected]} onPress={() => setPaymentMethod(method)}><Text style={paymentMethod === method ? styles.paymentTextSelected : styles.paymentText}>{method === 'pix' ? 'PIX' : 'Cartão'}</Text></TouchableOpacity>)}</View>
            <Text style={styles.checkoutSectionTitle}>Endereço de entrega</Text>
            {profileError && <Text style={styles.errorText}>{profileError}</Text>}
            <TextInput style={styles.addressInput} placeholder="Rua, número, bairro e cidade" placeholderTextColor="#666" value={address} onChangeText={setAddress} multiline />
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total do Pedido:</Text><Text style={styles.totalValue} numberOfLines={1}>R$ {totalAmount.toFixed(2).replace('.', ',')}</Text></View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleFinishPurchase} disabled={loadingPurchase}>{loadingPurchase ? <ActivityIndicator color="#000" /> : <Text style={styles.checkoutBtnText}>Finalizar Compra</Text>}</TouchableOpacity>
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 960,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: '#FFCC00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  errorText: { color: '#ff7777', textAlign: 'center', marginTop: 16 },
  retryText: { color: '#ffcc00', fontWeight: 'bold', padding: 12 },
  itemsList: {
    width: '100%',
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  itemSize: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  itemPrice: {
    color: '#FFCC00',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  originalItemPrice: { color: '#888', fontSize: 11, textDecorationLine: 'line-through' },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 8,
  },
  qtyBtn: {
    paddingHorizontal: 4,
  },
  qtyBtnText: {
    color: '#FFCC00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  qtyValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  removeBtn: {
    padding: 8,
  },
  removeBtnText: {
    color: '#FF5252',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#222',
    paddingTop: 16,
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#FFCC00',
    fontSize: 22,
    fontWeight: 'bold',
  },
  checkoutBtn: {
    backgroundColor: '#FFCC00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutSectionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
  paymentRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  paymentButton: { flex: 1, borderWidth: 1, borderColor: '#444', borderRadius: 6, padding: 11, alignItems: 'center' },
  paymentButtonSelected: { borderColor: '#ffcc00', backgroundColor: '#2a260f' },
  paymentText: { color: '#aaa', fontWeight: 'bold' },
  paymentTextSelected: { color: '#ffcc00', fontWeight: 'bold' },
  addressInput: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#2b2b2b', color: '#fff', borderRadius: 6, padding: 10, minHeight: 48 },
});
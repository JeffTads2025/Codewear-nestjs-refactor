import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

interface OrderedProduct {
  name?: string;
  image_url?: string;
}

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  size?: string;
  Product?: OrderedProduct;
  product?: OrderedProduct;
}

interface CustomerOrder {
  id: number;
  createdAt: string;
  status: string;
  paymentMethod: string;
  address: string;
  totalValue: number;
  OrderItems?: OrderItem[];
  orderItems?: OrderItem[];
}

const OrderRow = memo(({ item }: { item: CustomerOrder }) => (
  <View style={styles.order}>
    <Text style={styles.title}>Pedido #{item.id}</Text>
    <Text style={styles.text}>Data: {new Date(item.createdAt).toLocaleString('pt-BR')}</Text>
    <Text style={styles.text}>Status: {item.status}</Text>
    <Text style={styles.text}>Pagamento: {item.paymentMethod}</Text>
    <Text style={styles.text}>Entrega: {item.address}</Text>
    <Text style={styles.total} numberOfLines={1}>R$ {Number(item.totalValue || 0).toFixed(2).replace('.', ',')}</Text>
    {(item.OrderItems || item.orderItems || []).map((orderItem) => (
      <View key={orderItem.id} style={styles.item}>
        <Image source={{ uri: orderItem.Product?.image_url || orderItem.product?.image_url }} style={styles.itemImage} />
        <Text style={styles.text}>
          Produto: {orderItem.Product?.name || orderItem.product?.name || `#${orderItem.productId}`} x {orderItem.quantity}{orderItem.size ? ` (${orderItem.size})` : ''}
        </Text>
      </View>
    ))}
  </View>
));

export function OrdersScreen() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigation = useNavigation();
  const renderOrder = useCallback(({ item }: { item: CustomerOrder }) => <OrderRow item={item} />, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get<{ orders: CustomerOrder[] }>('orders?limit=50');
      setOrders(data.orders);
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      setLoadError(
        requestError.response?.data?.message
          ?? 'Falha de conexão ao carregar seu histórico. Tente novamente.',
      );
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar pedidos',
        text2: requestError.response?.data?.message ?? 'Não foi possível consultar seu histórico.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#ffcc00" /></View>;
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError}</Text>
        <TouchableOpacity onPress={() => void loadOrders()}>
          <Text style={styles.retry}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Voltar para a loja</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <View style={styles.container}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Voltar para a loja</Text></TouchableOpacity><FlatList
    contentContainerStyle={styles.content}
    data={orders}
    keyExtractor={(item) => String(item.id)}
    renderItem={renderOrder}
    initialNumToRender={8}
    maxToRenderPerBatch={10}
    windowSize={5}
    removeClippedSubviews
    ListEmptyComponent={<Text style={styles.empty}>Você ainda não fez pedidos.</Text>}
  /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0d0d0d' }, content: { padding: 20 }, center: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center', padding: 20 }, back: { color: '#ffcc00', padding: 20, paddingBottom: 0 }, empty: { color: '#aaa', textAlign: 'center', marginTop: 40 }, error: { color: '#ff7777', textAlign: 'center' }, retry: { color: '#ffcc00', fontWeight: 'bold', padding: 16 }, order: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#2b2b2b', borderRadius: 8, padding: 16, marginBottom: 12 }, title: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 8 }, text: { color: '#aaa', marginBottom: 4, flex: 1 }, item: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, itemImage: { width: 42, height: 42, borderRadius: 5, marginRight: 8 }, total: { color: '#ffcc00', fontSize: 18, fontWeight: 'bold', marginTop: 10 } });

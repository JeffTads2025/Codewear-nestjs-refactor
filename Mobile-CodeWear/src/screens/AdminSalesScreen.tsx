import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

interface SalesOrderItem {
  id: number;
  productId: number;
  quantity: number;
  size?: string;
  Product?: { name?: string };
  product?: { name?: string };
}

interface SalesOrder {
  id: number;
  createdAt: string;
  totalValue: number;
  status: string;
  User?: { name?: string };
  user?: { name?: string };
  OrderItems?: SalesOrderItem[];
  orderItems?: SalesOrderItem[];
}

const SalesOrderRow = memo(({ item }: { item: SalesOrder }) => (
  <View style={styles.row}>
    <Text style={styles.itemText}>Pedido #{item.id} - {item.User?.name || item.user?.name || 'Cliente'}</Text>
    <Text style={styles.itemText}>{new Date(item.createdAt).toLocaleString('pt-BR')}</Text>
    <Text style={styles.itemText} numberOfLines={1}>R$ {Number(item.totalValue || 0).toFixed(2).replace('.', ',')}</Text>
    <Text style={styles.status}>{item.status}</Text>
    {(item.OrderItems || item.orderItems || []).map((orderItem) => (
      <Text style={styles.detail} key={orderItem.id}>
        {orderItem.Product?.name || orderItem.product?.name || `Produto #${orderItem.productId}`} x {orderItem.quantity}{orderItem.size ? ` (${orderItem.size})` : ''}
      </Text>
    ))}
  </View>
));

export function AdminSalesScreen() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, totalUsers: 0, totalOrders: 0, dailyRevenue: 0, monthlyRevenue: 0, yearlyRevenue: 0 });
  const [filterDate, setFilterDate] = useState({ day: '', month: '', year: String(new Date().getFullYear()) });
  const renderOrder = useCallback(({ item }: { item: SalesOrder }) => <SalesOrderRow item={item} />, []);

  useEffect(() => {
    loadDashboard();
    api.get<{ orders: SalesOrder[] }>('admin/all-orders?limit=50')
      .then(({ data }) => setOrders(data.orders ?? []))
      .catch((error: unknown) => {
        console.error('Erro ao carregar vendas:', error);
        const requestError = error as { response?: { data?: { message?: string } } };
        Toast.show({
          type: 'error',
          text1: 'Erro ao carregar vendas',
          text2: requestError.response?.data?.message ?? 'Não foi possível consultar os pedidos.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const loadDashboard = async () => {
    try {
      const params = new URLSearchParams({ year: filterDate.year });
      if (filterDate.month) params.set('month', filterDate.month);
      if (filterDate.day) params.set('day', filterDate.day);
      const { data } = await api.get(`admin/dashboard?${params.toString()}`);
      setStats(data);
    } catch (error: unknown) {
      console.error('Erro ao carregar indicadores:', error);
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar faturamento',
        text2: requestError.response?.data?.message ?? 'Não foi possível consultar as métricas.',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestão de Vendas</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Faturamento</Text><Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>R$ {Number(stats.totalRevenue).toFixed(2).replace('.', ',')}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Clientes</Text><Text style={styles.metricValue}>{stats.totalUsers}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Pedidos</Text><Text style={styles.metricValue}>{stats.totalOrders}</Text></View>
      </View>
      <View style={styles.filterRow}>
        {(['day', 'month', 'year'] as const).map((field) => <TextInput key={field} style={styles.filterInput} keyboardType="numeric" placeholder={field === 'day' ? 'Dia' : field === 'month' ? 'Mês' : 'Ano'} placeholderTextColor="#666" value={filterDate[field]} onChangeText={(value) => setFilterDate((current) => ({ ...current, [field]: value }))} />)}
        <TouchableOpacity style={styles.filterButton} onPress={loadDashboard}><Text style={styles.filterButtonText}>Filtrar</Text></TouchableOpacity>
      </View>
      <Text style={styles.periodTitle}>Resumo de Período</Text>
      <View style={styles.periodCardsRow}>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Hoje</Text>
          <Text style={styles.periodValue} numberOfLines={1} adjustsFontSizeToFit>R$ {Number(stats.dailyRevenue || 0).toFixed(2).replace('.', ',')}</Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Este Mês</Text>
          <Text style={styles.periodValue} numberOfLines={1} adjustsFontSizeToFit>R$ {Number(stats.monthlyRevenue || 0).toFixed(2).replace('.', ',')}</Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>Este Ano</Text>
          <Text style={styles.periodValue} numberOfLines={1} adjustsFontSizeToFit>R$ {Number(stats.yearlyRevenue || 0).toFixed(2).replace('.', ',')}</Text>
        </View>
      </View>
      {loading ? <ActivityIndicator color="#ffcc00" /> : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.subtitle}>Nenhum pedido encontrado.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', padding: 16 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  metricsRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  metricCard: { flex: 1, backgroundColor: '#161616', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#222' },
  metricLabel: { color: '#888', fontSize: 11 },
  metricValue: { color: '#00ff88', fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterInput: { flex: 1, backgroundColor: '#161616', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 6, padding: 9 },
  filterButton: { backgroundColor: '#0080ff', borderRadius: 6, justifyContent: 'center', paddingHorizontal: 12 },
  filterButtonText: { color: '#fff', fontWeight: 'bold' },
  periodTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginVertical: 12 },
  periodCardsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodCard: { flex: 1, backgroundColor: '#161616', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#222' },
  periodLabel: { color: '#888', fontSize: 11 },
  periodValue: { color: '#FFCC00', fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  subtitle: { color: '#888', marginTop: 8 },
  row: { borderBottomWidth: 1, borderBottomColor: '#222', paddingVertical: 14 },
  itemText: { color: '#fff', marginBottom: 4, flexWrap: 'wrap' },
  status: { color: '#00ff88', fontSize: 12 },
  detail: { color: '#aaa', fontSize: 12, marginTop: 3 },
});
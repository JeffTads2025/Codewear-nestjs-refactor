import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

interface Customer {
  id: number;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  address?: string;
  role?: string;
}

const CustomerRow = memo(({ customer, onPress }: { customer: Customer; onPress: (customer: Customer) => void }) => (
  <TouchableOpacity style={styles.row} onPress={() => onPress(customer)}>
    <Text style={styles.name}>{customer.name}</Text>
    <Text style={styles.subtitle}>{customer.email}</Text>
    {customer.phone && <Text style={styles.detail}>📱 {customer.phone}</Text>}
    {customer.cpf && <Text style={styles.detail}>📋 CPF: {customer.cpf}</Text>}
  </TouchableOpacity>
));

export function AdminCustomersScreen() {
  const [users, setUsers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Customer | null>(null);
  const handleSelectUser = useCallback((customer: Customer) => setSelectedUser(customer), []);
  const renderCustomer = useCallback(
    ({ item }: { item: Customer }) => <CustomerRow customer={item} onPress={handleSelectUser} />,
    [handleSelectUser],
  );

  useEffect(() => {
    api.get<{ users: Customer[] }>('admin/users?limit=50')
      .then(({ data }) => setUsers(data.users ?? []))
      .catch((error: unknown) => {
        console.error('Erro ao carregar clientes:', error);
        const requestError = error as { response?: { data?: { message?: string } } };
        Toast.show({
          type: 'error',
          text1: 'Erro ao carregar clientes',
          text2: requestError.response?.data?.message ?? 'Não foi possível consultar os clientes.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lista de Clientes Cadastrados</Text>
      {loading ? <ActivityIndicator color="#ffcc00" /> : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCustomer}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.subtitle}>Nenhum cliente encontrado.</Text>}
        />
      )}
      <Modal visible={!!selectedUser} transparent animationType="slide" onRequestClose={() => setSelectedUser(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.name}>Dados do cliente</Text>{selectedUser && Object.entries(selectedUser).filter(([key]) => !['password'].includes(key)).map(([key, value]) => <Text style={styles.detail} key={key}>{key}: {String(value ?? '-')}</Text>)}<TouchableOpacity onPress={() => setSelectedUser(null)}><Text style={styles.close}>Fechar</Text></TouchableOpacity></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', padding: 16 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 16 },
  subtitle: { color: '#888', marginTop: 8, fontSize: 12 },
  row: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  name: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  detail: { color: '#aaa', fontSize: 11, marginTop: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#171717', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  close: { color: '#ffcc00', marginTop: 20, textAlign: 'right', fontWeight: 'bold' },
});
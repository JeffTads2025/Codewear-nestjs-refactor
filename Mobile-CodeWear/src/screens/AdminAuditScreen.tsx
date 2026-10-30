import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

interface AuditLogEntry {
  id: number;
  action: string;
  adminName?: string;
  details: string;
  createdAt: string;
}

const auditActionLabels: Record<string, string> = {
  CREATE_PRODUCT: 'Produto criado',
  UPDATE_PRODUCT: 'Produto atualizado',
  DELETE_PRODUCT: 'Produto excluído',
  DELETE_ORDER: 'Pedido excluído',
};

const AuditLogRow = memo(({ item }: { item: AuditLogEntry }) => (
  <View style={styles.row}>
    <Text style={styles.action}>{auditActionLabels[item.action] ?? item.action}</Text>
    <Text style={styles.subtitle}>Por: {item.adminName || 'Administrador'}</Text>
    <Text style={styles.subtitle}>{item.details}</Text>
    <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('pt-BR')}</Text>
  </View>
));

export function AdminAuditScreen() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const renderLog = useCallback(({ item }: { item: AuditLogEntry }) => <AuditLogRow item={item} />, []);

  useEffect(() => {
    api.get<{ logs: AuditLogEntry[] }>('admin/logs?limit=50')
      .then(({ data }) => setLogs(data.logs ?? []))
      .catch((error: unknown) => {
        console.error('Erro ao carregar auditoria:', error);
        const requestError = error as { response?: { data?: { message?: string } } };
        Toast.show({
          type: 'error',
          text1: 'Erro ao carregar auditoria',
          text2: requestError.response?.data?.message ?? 'Não foi possível consultar os registros.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auditoria & Logs</Text>
      {loading ? <ActivityIndicator color="#ffcc00" /> : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLog}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.subtitle}>Nenhum registro encontrado.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', padding: 16 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  subtitle: { color: '#888', marginTop: 8 },
  row: { borderBottomWidth: 1, borderBottomColor: '#222', paddingVertical: 14 },
  action: { color: '#fff', fontWeight: 'bold' },
  date: { color: '#ffcc00', marginTop: 5, fontSize: 12 },
});
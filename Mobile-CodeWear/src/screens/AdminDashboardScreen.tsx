import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';
import { sortSizes } from '../utils/sizes';
import { Product } from '../data/products';
import { useFocusEffect } from '@react-navigation/native';

type StockSize = { id?: number; size: string; stock: number | string };
type ProductPromotion = { id?: number; productId?: number | null; discountPercentage: number | string; validFrom?: string; validUntil?: string; isActive: boolean };
type AdminProduct = Omit<Product, 'id' | 'name' | 'price' | 'stock' | 'sizes' | 'promotions'> & {
  id: number;
  name: string;
  price: number | string;
  stock: number | string;
  sizes?: StockSize[];
  promotions?: ProductPromotion[];
};

export function AdminDashboardScreen() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [promotionDiscount, setPromotionDiscount] = useState('0');
  const [promotionValidFrom, setPromotionValidFrom] = useState('');
  const [promotionValidUntil, setPromotionValidUntil] = useState('');
  const [storePromotionDiscount, setStorePromotionDiscount] = useState('0');
  const [storePromotionValidFrom, setStorePromotionValidFrom] = useState('');
  const [storePromotionValidUntil, setStorePromotionValidUntil] = useState('');
  const [savingStorePromotion, setSavingStorePromotion] = useState(false);
  const [sizeStocks, setSizeStocks] = useState({ P: '', M: '', G: '', GG: '' });
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [hidingProductId, setHidingProductId] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await api.get<{ products: AdminProduct[] } | AdminProduct[]>('products?limit=100');
      const productsFromApi = Array.isArray(data) ? data : data.products;
      setProducts(productsFromApi.filter((product) => product.isVisible !== false));
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadProducts();
  }, [loadProducts]));

  const formatDateBRtoISO = (value: string) => {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return undefined;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const formatDateForInput = (value?: string) => {
    if (!value) return '';
    if (!value.includes('T') && !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
  };

  const handleDateChange = (value: string, setter: (date: string) => void) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    setter(parts.join('/'));
  };

  const getPromotion = (product: AdminProduct): ProductPromotion | undefined =>
    product.promotions?.find((promotion) => promotion.productId === product.id);

  const updateProductPromotion = (productId: number, changes: Partial<ProductPromotion>) => {
    setProducts((current) => current.map((item) => {
      if (item.id !== productId) return item;
      const currentPromotion = getPromotion(item);
      const nextPromotion = {
        id: currentPromotion?.id,
        productId,
        discountPercentage: currentPromotion?.discountPercentage ?? 0,
        validFrom: currentPromotion?.validFrom,
        validUntil: currentPromotion?.validUntil,
        isActive: true,
        ...changes
      };
      return { ...item, promotions: [nextPromotion] };
    }));
  };

  const getStockSizes = (product: AdminProduct): StockSize[] => product.sizes?.length
    ? product.sizes
    : ['P', 'M', 'G', 'GG'].map((size) => ({ size, stock: 0 }));

  const getTotalStock = (sizes: StockSize[]) => sizes
    .filter((size) => ['P', 'M', 'G', 'GG'].includes(size.size.toUpperCase()))
    .reduce((total, size) => total + Math.max(0, Number(size.stock) || 0), 0);

  const updateStock = async (product: AdminProduct) => {
    setSavingProductId(product.id);
    try {
      const response = await api.put(`products/${product.id}`, {
        name: product.name,
        price: Math.max(0, Number(product.price) || 0),
        description: product.description,
        stock: getTotalStock(getStockSizes(product)),
        sizes: sortSizes(getStockSizes(product)).map((size) => ({
          size: size.size,
          stock: Math.max(0, Number(size.stock) || 0),
        })),
        promotions: (product.promotions || []).filter((promotion) => promotion.productId === product.id).map((promotion) => ({
          discountPercentage: Math.max(0, Math.min(100, Number(promotion.discountPercentage) || 0)),
          validFrom: formatDateBRtoISO(promotion.validFrom || ''),
          validUntil: formatDateBRtoISO(promotion.validUntil || ''),
          isActive: true,
        })),
      });
      setProducts((current) => current.map((item) => item.id === product.id ? response.data.product : item));
      Toast.show({ type: 'success', text1: 'Sucesso', text2: 'Estoque atualizado.' });
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Erro', text2: requestError.response?.data?.message ?? 'Não foi possível atualizar o estoque.' });
    } finally {
      setSavingProductId(null);
    }
  };

  const saveStorePromotion = async () => {
    setSavingStorePromotion(true);
    try {
      await api.put('promotions/store', {
        discountPercentage: Math.max(0, Math.min(100, Number(storePromotionDiscount.replace(',', '.')) || 0)),
        validFrom: formatDateBRtoISO(storePromotionValidFrom),
        validUntil: formatDateBRtoISO(storePromotionValidUntil),
        isActive: true,
      });
      Toast.show({ type: 'success', text1: 'Sucesso', text2: 'Promoção geral atualizada.' });
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Erro', text2: requestError.response?.data?.message ?? 'Não foi possível salvar a promoção geral.' });
    } finally {
      setSavingStorePromotion(false);
    }
  };

  const hideProduct = async (product: AdminProduct) => {
    setHidingProductId(product.id);
    try {
      await api.delete(`products/${product.id}`);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      Toast.show({ type: 'success', text1: 'Produto removido', text2: 'O produto não aparece mais no estoque nem na vitrine.' });
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Erro', text2: requestError.response?.data?.message ?? 'Não foi possível remover o produto.' });
    } finally {
      setHidingProductId(null);
    }
  };

  const confirmHideProduct = (product: AdminProduct) => {
    Alert.alert(
      'Remover do estoque?',
      'O produto deixará de aparecer no estoque e na vitrine. Pedidos anteriores serão preservados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => void hideProduct(product) },
      ]
    );
  };

  const handleCreateProduct = async () => {
    if (!name || !price) {
      Toast.show({ type: 'info', text1: 'Atenção', text2: 'Preencha os campos obrigatórios.' });
      return;
    }
    try {
      await api.post('products', {
        name,
        price: Number(price.replace(',', '.')),
        stock: Object.values(sizeStocks).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0),
        image_url: imageUrl || undefined,
        sizes: sortSizes(Object.entries(sizeStocks).map(([size, value]) => ({ size, stock: Number(value) || 0 }))),
        promotions: Number(promotionDiscount.replace(',', '.')) > 0 ? [{
          discountPercentage: Number(promotionDiscount.replace(',', '.')),
          validFrom: formatDateBRtoISO(promotionValidFrom),
          validUntil: formatDateBRtoISO(promotionValidUntil),
          isActive: true,
        }] : [],
      });
      Toast.show({ type: 'success', text1: 'Sucesso', text2: `Produto "${name}" cadastrado!` });
      setName(''); setPrice(''); setStock(''); setImageUrl(''); setPromotionDiscount('0'); setPromotionValidFrom(''); setPromotionValidUntil(''); setSizeStocks({ P: '', M: '', G: '', GG: '' });
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Erro', text2: requestError.response?.data?.message ?? 'Não foi possível cadastrar o produto.' });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Painel de Gestão</Text>

      <View style={styles.cardBox}>
        <Text style={styles.yellowTitle}>Promoção Geral da Loja</Text>
        <Text style={styles.label}>Percentual de Desconto (%)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={storePromotionDiscount} onChangeText={setStorePromotionDiscount} placeholder="0" placeholderTextColor="#555" />
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Data de Início</Text>
            <TextInput style={styles.input} value={storePromotionValidFrom} onChangeText={(value) => handleDateChange(value, setStorePromotionValidFrom)} placeholder="DD/MM/AAAA" placeholderTextColor="#555" keyboardType="numeric" maxLength={10} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Data de Término</Text>
            <TextInput style={styles.input} value={storePromotionValidUntil} onChangeText={(value) => handleDateChange(value, setStorePromotionValidUntil)} placeholder="DD/MM/AAAA" placeholderTextColor="#555" keyboardType="numeric" maxLength={10} />
          </View>
        </View>
        <TouchableOpacity style={styles.submitButton} onPress={saveStorePromotion} disabled={savingStorePromotion}>
          <Text style={styles.submitText}>{savingStorePromotion ? 'Salvando...' : 'Salvar Promoção Geral'}</Text>
        </TouchableOpacity>
      </View>

      {/* Formulário Novo Produto */}
      <View style={styles.cardBox}>
        <Text style={styles.yellowTitle}>+ Novo Produto</Text>

        <Text style={styles.label}>Nome do Produto</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Camiseta Dev" placeholderTextColor="#555" />

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Preço (R$)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor="#555" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Estoque total</Text>
            <TextInput style={styles.input} value={String(Object.values(sizeStocks).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0))} editable={false} />
          </View>
        </View>
        <Text style={styles.label}>Estoque por tamanho</Text>
        <View style={styles.row}>{Object.keys(sizeStocks).map((size) => <TextInput key={size} style={styles.sizeInput} keyboardType="numeric" placeholder={size} placeholderTextColor="#666" value={sizeStocks[size as keyof typeof sizeStocks]} onChangeText={(value) => setSizeStocks((current) => ({ ...current, [size]: value }))} />)}</View>

        <Text style={styles.label}>URL da Imagem</Text>
        <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." placeholderTextColor="#555" />

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Desconto (%)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={promotionDiscount} onChangeText={setPromotionDiscount} placeholder="10" placeholderTextColor="#555" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Data de Início</Text>
            <TextInput style={styles.input} value={promotionValidFrom} onChangeText={(value) => handleDateChange(value, setPromotionValidFrom)} placeholder="DD/MM/AAAA" placeholderTextColor="#555" keyboardType="numeric" maxLength={10} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Data de Término</Text>
            <TextInput style={styles.input} value={promotionValidUntil} onChangeText={(value) => handleDateChange(value, setPromotionValidUntil)} placeholder="DD/MM/AAAA" placeholderTextColor="#555" keyboardType="numeric" maxLength={10} />
          </View>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleCreateProduct}>
          <Text style={styles.submitText}>Cadastrar Produto</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Estoque atual</Text>
      {loadingProducts ? <ActivityIndicator color="#ffcc00" /> : products.map((product) => {
        const stockSizes = sortSizes(getStockSizes(product));
        return (
          <View style={styles.stockCard} key={product.id}>
            <View style={styles.productHeader}><Image source={{ uri: product.image_url }} style={styles.stockImage} /><Text style={styles.productTitle}>{product.name}</Text></View>
            <Text style={Number(product.stock) > 0 ? styles.inStock : styles.outOfStock}>
              {Number(product.stock) > 0 ? 'Em estoque' : 'Esgotado'}
            </Text>
            <Text style={styles.label}>Quantidade total</Text>
            <TextInput style={styles.input} value={String(getTotalStock(stockSizes))} editable={false} />
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={String(product.name || '')} onChangeText={(value) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, name: value } : item))} />
            <Text style={styles.label}>Descrição</Text>
            <TextInput style={styles.input} value={String(product.description || '')} onChangeText={(value) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, description: value } : item))} multiline />
            <Text style={styles.label}>Preço</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(product.price || 0)} onChangeText={(value) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price: value } : item))} />
            <Text style={styles.label}>Desconto (%)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(getPromotion(product)?.discountPercentage ?? 0)} onChangeText={(value) => updateProductPromotion(product.id, { discountPercentage: value })} />
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Data de Início</Text>
                <TextInput style={styles.input} value={formatDateForInput(getPromotion(product)?.validFrom)} onChangeText={(value) => updateProductPromotion(product.id, { validFrom: value })} placeholder="DD/MM/AAAA" placeholderTextColor="#555" keyboardType="numeric" maxLength={10} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.label}>Data de Término</Text>
                <TextInput style={styles.input} value={formatDateForInput(getPromotion(product)?.validUntil)} onChangeText={(value) => updateProductPromotion(product.id, { validUntil: value })} placeholder="DD/MM/AAAA" placeholderTextColor="#555" keyboardType="numeric" maxLength={10} />
              </View>
            </View>
            {stockSizes.map((size) => (
              <View style={styles.sizeRow} key={size.id || size.size}>
                <Text style={styles.sizeName}>Tamanho {size.size}</Text>
                <TextInput
                  style={styles.sizeInput}
                  keyboardType="numeric"
                  value={String(size.stock ?? 0)}
                  onChangeText={(value) => setProducts((current) => current.map((item) => item.id === product.id
                    ? { ...item, stock: getTotalStock((item.sizes?.length ? item.sizes : stockSizes).map((itemSize) => itemSize.size === size.size ? { ...itemSize, stock: value } : itemSize)), sizes: (item.sizes?.length ? item.sizes : stockSizes).map((itemSize) => itemSize.size === size.size ? { ...itemSize, stock: value } : itemSize) }
                    : item))}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.stockButton} disabled={savingProductId === product.id} onPress={() => updateStock(product)}>
              <Text style={styles.submitText}>{savingProductId === product.id ? 'Salvando...' : 'Atualizar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeButton} disabled={hidingProductId === product.id} onPress={() => confirmHideProduct(product)}>
              <Text style={styles.submitText}>{hidingProductId === product.id ? 'Removendo...' : 'Remover do estoque'}</Text>
            </TouchableOpacity>
          </View>


        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', padding: 16 },
  headerTitle: { fontSize: 22, color: '#fff', fontWeight: 'bold', marginBottom: 16 },
  cardBox: { backgroundColor: '#161616', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  yellowTitle: { color: '#ffcc00', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  label: { color: '#aaa', fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#2b2b2b', color: '#fff', borderRadius: 6, padding: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  submitButton: { backgroundColor: '#0080ff', borderRadius: 6, padding: 12, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, color: '#fff', fontWeight: 'bold', marginBottom: 10 },
  stockCard: { backgroundColor: '#161616', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#222', marginBottom: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stockImage: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#222' },
  productTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  subtitle: { color: '#888', marginTop: 8 },
  inStock: { color: '#00ff88', marginTop: 4 },
  outOfStock: { color: '#ff7777', marginTop: 4 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  sizeName: { color: '#aaa', width: 110 },
  sizeInput: { flex: 1, backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#2b2b2b', color: '#fff', borderRadius: 6, padding: 10 },
  stockButton: { backgroundColor: '#0080ff', borderRadius: 6, padding: 12, alignItems: 'center', marginTop: 14 },
  removeButton: { backgroundColor: '#b42318', borderRadius: 6, padding: 12, alignItems: 'center', marginTop: 8 },
});
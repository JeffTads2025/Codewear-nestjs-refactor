import React, { useState } from 'react';
import { Alert, View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../routes';

import { api } from '../services/api';
import { AuthUser, useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({ type: 'info', text1: 'Atenção', text2: 'Por favor, preencha o e-mail e a senha.' });
      return;
    }

    try {
      const response = await api.post<{ token: string; user: AuthUser }>('login', { email, password });
      await signIn(response.data.token, response.data.user);

      const user = response.data.user || response.data;

      if (user.role === 'admin') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminApp' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ClientApp' }],
        });
      }
    } catch (error: unknown) {
      const requestError = error as { response?: { status?: number; data?: { message?: string } } };
      if (requestError.response?.status === 401) {
        Alert.alert('Erro', 'Usuário ou senha inválidos');
        return;
      }
      const message = requestError.response?.data?.message ?? 'Não foi possível conectar ao servidor.';
      Toast.show({ type: 'error', text1: 'Erro ao entrar', text2: message });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Login</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>✉ E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite seu e-mail"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>🔒 Senha</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.inputPassword}
                placeholder="Digite sua senha"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.togglePasswordBtn}
              >
                <Text style={styles.togglePasswordIcon}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin}>
            <Text style={styles.btnPrimaryText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.btnSecondaryText}>Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboard: { flex: 1 },
  card: {
    backgroundColor: '#161616',
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: '#222',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#888',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  inputPassword: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  togglePasswordBtn: {
    padding: 8,
  },
  togglePasswordIcon: {
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: '#FFCC00',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFCC00',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnSecondaryText: {
    color: '#FFCC00',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
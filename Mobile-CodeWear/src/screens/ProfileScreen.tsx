import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { api, changePassword, getApiAssetUrl, uploadAvatarFile } from '../services/api';
import { AuthUser, useAuth } from '../context/AuthContext';

interface ProfileData extends AuthUser {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  address: string;
}

type EditableProfileField = 'name' | 'email' | 'cpf' | 'phone' | 'address';

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const profileFieldLabels: Record<EditableProfileField, string> = {
  name: 'Nome',
  email: 'E-mail',
  cpf: 'CPF',
  phone: 'Telefone',
  address: 'Endereço',
};

export function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData>({
    id: 0,
    name: '',
    email: '',
    cpf: '',
    phone: '',
    address: '',
    role: 'client',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const navigation = useNavigation();
  const { signOut, setUser, user } = useAuth();

  useEffect(() => {
    api.get<ProfileData>('users/profile')
      .then(({ data }) => {
        setProfile(data);
        setUser(data);
      })
      .catch(() => Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível carregar seu perfil.' }));
  }, [setUser]);

  const updateField = (field: EditableProfileField, value: string) => setProfile((current) => ({ ...current, [field]: value }));
  const chooseAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: 'error',
          text1: 'Permissão necessária',
          text2: 'Permita o acesso às fotos para escolher uma imagem.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;

      setUploading(true);
      const asset = result.assets[0];
      const extensionByMimeType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const extensionFromAsset = asset.fileName?.split('.').pop()?.toLowerCase();
      const mimeType = asset.mimeType ?? ({
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      }[extensionFromAsset ?? '']);
      const extension = mimeType ? extensionByMimeType[mimeType] : undefined;
      if (!mimeType || !extension) {
        Toast.show({
          type: 'error',
          text1: 'Formato não suportado',
          text2: 'Selecione uma imagem JPEG, PNG ou WEBP.',
        });
        return;
      }

      const fileName = `avatar-${Date.now()}.${extension}`;
      const avatarFile = asset.file ?? {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      };
      const { avatarUrl } = await uploadAvatarFile(avatarFile);
      setProfile((current) => ({ ...current, avatarUrl }));
      setUser({ ...(user ?? profile), avatarUrl });
      Toast.show({ type: 'success', text1: 'Foto atualizada' });
    } catch (error: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error instanceof Error
          ? error.message
          : 'Não foi possível selecionar ou enviar a foto.',
      });
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    if (!isValidEmail(profile.email)) {
      setEmailError('Informe um e-mail válido.');
      Toast.show({ type: 'error', text1: 'E-mail inválido', text2: 'Confira o formato do e-mail.' });
      return;
    }
    setEmailError('');
    try {
      setLoading(true);
      const { data } = await api.put<ProfileData>('users/profile', {
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        cpf: profile.cpf,
      });
      setProfile(data);
      setUser(data);
      Toast.show({ type: 'success', text1: 'Perfil atualizado' });
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Erro', text2: requestError.response?.data?.message ?? 'Não foi possível salvar.' });
    } finally { setLoading(false); }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword) {
      Toast.show({ type: 'error', text1: 'Campos obrigatórios', text2: 'Informe a senha atual e a nova senha.' });
      return;
    }

    try {
      setChangingPassword(true);
      const { data } = await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      Toast.show({ type: 'success', text1: 'Senha alterada', text2: data.message });
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: 'Não foi possível alterar a senha', text2: requestError.response?.data?.message ?? 'Tente novamente.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Sua conta será desativada e você não poderá mais acessá-la. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: () => { void confirmDeleteAccount(); },
        },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeleting(true);
      await api.delete('users/me');
      await signOut();
      navigation.navigate('Login' as never);
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } } };
      Toast.show({
        type: 'error',
        text1: 'Não foi possível excluir a conta',
        text2: requestError.response?.data?.message ?? 'Tente novamente.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return <ScrollView contentContainerStyle={styles.container}>
    <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Voltar</Text></TouchableOpacity>
    <Text style={styles.title}>Meu perfil</Text>
    <TouchableOpacity style={styles.avatarButton} onPress={chooseAvatar} disabled={uploading}>
      {profile.avatarUrl ? <Image source={{ uri: getApiAssetUrl(profile.avatarUrl) }} style={styles.avatar} resizeMode="cover" /> : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{profile.name?.charAt(0)?.toUpperCase() || '?'}</Text></View>}
      <Text style={styles.avatarAction}>{uploading ? 'Enviando...' : 'Alterar foto'}</Text>
    </TouchableOpacity>
    {(['name', 'email', 'cpf', 'phone', 'address'] as const).map((field) => <View key={field}>
      <Text style={styles.label}>{profileFieldLabels[field]}</Text>
      <TextInput
        style={[styles.input, field === 'email' && emailError ? styles.inputError : undefined]}
        value={profile[field] || ''}
        onChangeText={(value) => updateField(field, field === 'cpf' ? formatCpf(value) : field === 'phone' ? formatPhone(value) : value)}
        editable={field !== 'email'}
        keyboardType={field === 'cpf' ? 'number-pad' : field === 'phone' ? 'phone-pad' : field === 'email' ? 'email-address' : 'default'}
        multiline={field === 'address'}
      />
      {field === 'email' && emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
    </View>)}
    <TouchableOpacity style={styles.button} onPress={save} disabled={loading}><Text style={styles.buttonText}>{loading ? 'Salvando...' : 'Salvar alterações'}</Text></TouchableOpacity>
    <Text style={styles.sectionTitle}>Alterar senha</Text>
    <Text style={styles.label}>Senha atual</Text>
    <TextInput
      style={styles.input}
      value={currentPassword}
      onChangeText={setCurrentPassword}
      placeholder="Digite sua senha atual"
      placeholderTextColor="#777"
      secureTextEntry
      autoCapitalize="none"
    />
    <Text style={styles.label}>Nova senha</Text>
    <TextInput
      style={styles.input}
      value={newPassword}
      onChangeText={setNewPassword}
      placeholder="Digite sua nova senha"
      placeholderTextColor="#777"
      secureTextEntry
      autoCapitalize="none"
    />
    <TouchableOpacity style={styles.button} onPress={updatePassword} disabled={changingPassword || loading || uploading}>
      <Text style={styles.buttonText}>{changingPassword ? 'Alterando...' : 'Alterar senha'}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.deleteButton} onPress={deleteAccount} disabled={deleting || loading || uploading}>
      <Text style={styles.deleteButtonText}>{deleting ? 'Excluindo conta...' : 'Excluir minha conta'}</Text>
    </TouchableOpacity>
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { flexGrow: 1, backgroundColor: '#0d0d0d', padding: 20 }, back: { color: '#ffcc00', marginBottom: 18 }, title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }, avatarButton: { alignItems: 'center', marginBottom: 10 }, avatar: { width: 96, height: 96, borderRadius: 48 }, avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffcc00', alignItems: 'center', justifyContent: 'center' }, avatarLetter: { color: '#000', fontSize: 32, fontWeight: 'bold' }, avatarAction: { color: '#ffcc00', marginTop: 8 }, sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 30 }, label: { color: '#aaa', marginTop: 12, marginBottom: 5 }, input: { color: '#fff', backgroundColor: '#171717', borderColor: '#333', borderWidth: 1, borderRadius: 6, padding: 12 }, inputError: { borderColor: '#FF5252' }, errorText: { color: '#FF5252', fontSize: 11, marginTop: 4 }, button: { backgroundColor: '#ffcc00', padding: 14, alignItems: 'center', borderRadius: 6, marginTop: 22 }, buttonText: { color: '#000', fontWeight: 'bold' }, deleteButton: { borderColor: '#8f3030', borderWidth: 1, padding: 14, alignItems: 'center', borderRadius: 6, marginTop: 28, marginBottom: 24 }, deleteButtonText: { color: '#e57373', fontWeight: 'bold' } });

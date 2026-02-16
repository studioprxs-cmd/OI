import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';

export default function App() {
  const [tab, setTab] = useState('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const now = useMemo(() => new Date().toLocaleString('ko-KR'), []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>OI 테스트 앱</Text>
        <Text style={styles.sub}>배포 업데이트 확인용 · {now}</Text>
      </View>

      <View style={styles.tabs}>
        <TabButton label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
        <TabButton label="Login" active={tab === 'login'} onPress={() => setTab('login')} />
        <TabButton label="About" active={tab === 'about'} onPress={() => setTab('about')} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'home' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>홈</Text>
            <Text style={styles.cardText}>형님 앱 개발 계속 진행 중입니다 ✅</Text>
          </View>
        )}

        {tab === 'login' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>로그인 (데모)</Text>
            <TextInput
              style={styles.input}
              placeholder="email"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>로그인</Text>
            </Pressable>
          </View>
        )}

        {tab === 'about' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.cardText}>React Native Web + Vercel 배포 테스트 페이지</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f8fa' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { color: '#666', marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginVertical: 8 },
  tab: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: '#111827', borderColor: '#111827' },
  tabText: { color: '#222', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardText: { fontSize: 15, color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    marginTop: 4,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});

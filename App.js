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
  const [loggedIn, setLoggedIn] = useState(false);

  const [todoInput, setTodoInput] = useState('');
  const [todos, setTodos] = useState([
    { id: 1, text: '배포 성공 확인', done: true },
    { id: 2, text: '로그인 UI 붙이기', done: false },
    { id: 3, text: '메모 CRUD 붙이기', done: false },
  ]);

  const now = useMemo(() => new Date().toLocaleString('ko-KR'), []);

  const addTodo = () => {
    const v = todoInput.trim();
    if (!v) return;
    setTodos((prev) => [{ id: Date.now(), text: v, done: false }, ...prev]);
    setTodoInput('');
  };

  const toggleTodo = (id) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const onLogin = () => {
    if (!email.trim() || !password.trim()) return;
    setLoggedIn(true);
    setTab('home');
  };

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
            <Text style={styles.cardText}>
              상태: {loggedIn ? '로그인됨 ✅' : '로그인 필요'}
            </Text>

            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="할 일 추가"
                value={todoInput}
                onChangeText={setTodoInput}
              />
              <Pressable style={styles.smallBtn} onPress={addTodo}>
                <Text style={styles.smallBtnText}>추가</Text>
              </Pressable>
            </View>

            {todos.map((t) => (
              <View key={t.id} style={styles.todoRow}>
                <Pressable style={{ flex: 1 }} onPress={() => toggleTodo(t.id)}>
                  <Text style={[styles.todoText, t.done && styles.todoDone]}>
                    {t.done ? '✅ ' : '⬜ '} {t.text}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeTodo(t.id)}>
                  <Text style={styles.delete}>삭제</Text>
                </Pressable>
              </View>
            ))}
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
            <Pressable style={styles.button} onPress={onLogin}>
              <Text style={styles.buttonText}>로그인</Text>
            </Pressable>
          </View>
        )}

        {tab === 'about' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.cardText}>React Native Web + Vercel 배포 페이지</Text>
            <Text style={styles.cardText}>다음: Supabase 실연동 예정</Text>
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
  row: { flexDirection: 'row', gap: 8 },
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
  smallBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  todoText: { fontSize: 15 },
  todoDone: { textDecorationLine: 'line-through', color: '#777' },
  delete: { color: '#dc2626', fontWeight: '700' },
});

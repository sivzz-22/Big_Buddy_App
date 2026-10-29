import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { router, Link } from 'expo-router';
import { useTheme } from '../constants/ThemeContext';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userDataJson = await AsyncStorage.getItem('userData');
        if (token && userDataJson) {
          const userData = JSON.parse(userDataJson);
          // Route based on role
          if (userData.role === 'member') {
            router.replace('/(user)/(tabs)');
          } else {
            router.replace('/(drawer)/(tabs)');
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkLogin();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
      <Text style={styles.title}>BIG BUDDY</Text>
      <Text style={styles.subtitle}>GYM E-LOG BOOK</Text>
      <Link href="/login" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoImage: {
    width: 140,
    height: 140,
    borderRadius: 28,
    marginBottom: 20,
  },
  title: {
    fontSize: 44,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondary,
    marginBottom: 40,
    letterSpacing: 4,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 44,
    borderRadius: 30,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: colors.buttonPrimaryText,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

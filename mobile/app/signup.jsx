import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { router, Link } from 'expo-router';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, GOOGLE_WEB_CLIENT_ID } from '../constants/Config';

let GoogleSignin = null;
let statusCodes = {};
try {
  const gModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = gModule.GoogleSignin;
  statusCodes = gModule.statusCodes || {};
  if (GoogleSignin?.configure) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  }
} catch (e) {
  // RNGoogleSignin native module is not present in Expo Go
}


const Signup = () => {
    const { colors } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const styles = getStyles(colors);

    const [loading, setLoading] = useState(false);

    const handleSignup = async () => {
        if (!name || !email || !password || !confirmPassword) {
            alert("Please fill all fields");
            return;
        }
        if (password !== confirmPassword) {
            alert("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/auth/signup`, {
                name,
                email,
                password,
            });

            if (response.data.token) {
                await AsyncStorage.setItem('userToken', response.data.token);
                await AsyncStorage.setItem('userData', JSON.stringify(response.data));
                router.replace('/(drawer)/(tabs)');
            }
        } catch (error) {
            console.log("Signup error:", error.response?.data?.message || error.message);
            alert(error.response?.data?.message || "Signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        if (!GoogleSignin) {
            Alert.alert(
                "Notice",
                "Google Sign-In requires a custom native build (it is not supported inside Expo Go). Please sign up with your email and password."
            );
            return;
        }
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const user = userInfo.user || userInfo.data?.user || userInfo;

            const res = await axios.post(`${API_URL}/auth/google`, {
                name: user.name,
                email: user.email,
                googleId: user.id
            });

            if (res.data.token) {
                await AsyncStorage.setItem('userToken', res.data.token);
                await AsyncStorage.setItem('userData', JSON.stringify(res.data));
                router.replace('/(drawer)/(tabs)');
            }
        } catch (error) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('User cancelled the login flow');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                console.log('Sign in is in progress already');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert("Error", "Play services are not available or outdated.");
            } else {
                console.log("Google Auth error:", error);
                Alert.alert("Error", "Google authentication failed.");
            }
        } finally {
            setLoading(false);
        }
    };


    return (
        <View style={styles.container}>
            <Text style={styles.header}>CREATE ACCOUNT</Text>
            <Text style={styles.subHeader}>Admin Registration (Requires @bigbuddy.com)</Text>
            <Text style={styles.infoText}>Members: Please ask your gym admin to create your account.</Text>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>FULL NAME</Text>
                <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={colors.secondary}
                    value={name}
                    onChangeText={setName}
                />

                <Text style={styles.label}>EMAIL</Text>
                <TextInput
                    style={styles.input}
                    placeholder="admin@bigbuddy.com"
                    placeholderTextColor={colors.secondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                />

                <Text style={styles.label}>PASSWORD</Text>
                <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.secondary}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.secondary}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                />
            </View>

            <Pressable
                style={[styles.signupButton, loading && { opacity: 0.7 }]}
                onPress={handleSignup}
                disabled={loading}
            >
                <Text style={styles.signupButtonText}>{loading ? 'SIGNING UP...' : 'SIGN UP'}</Text>
            </Pressable>

            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.googleButton} onPress={handleGoogleSignup}>
                <Ionicons name="logo-google" size={20} color={colors.text} style={{ marginRight: 10 }} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>


            <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/login" asChild>
                    <Pressable>
                        <Text style={styles.link}>Login</Text>
                    </Pressable>
                </Link>
            </View>
        </View>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 10,
        textAlign: 'center',
    },
    subHeader: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
    },
    infoText: {
        fontSize: 12,
        color: colors.secondary,
        textAlign: 'center',
        marginBottom: 30,
        fontStyle: 'italic',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 30,
    },
    label: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
        marginTop: 15,
    },
    input: {
        backgroundColor: colors.surface,
        color: colors.text,
        padding: 15,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    signupButton: {
        backgroundColor: colors.primary,
        padding: 18,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    signupButtonText: {
        color: colors.buttonPrimaryText,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    footerText: {
        color: colors.secondary,
        fontSize: 14,
    },
    link: {
        color: colors.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    dividerText: {
        marginHorizontal: 15,
        color: colors.secondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    googleButton: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    googleButtonText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
});

export default Signup;


import { Drawer } from 'expo-router/drawer';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';

import { useTheme } from '../../constants/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';


function DrawerItemRow({ label, icon, onPress, colors }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginHorizontal: 10,
                borderRadius: 8,
                backgroundColor: pressed ? (colors.primary + '20') : 'transparent',
                gap: 16,
            })}
        >
            <Ionicons name={icon} size={22} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        </Pressable>
    );
}

function CustomDrawerContent(props) {
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const data = await AsyncStorage.getItem('userData');
                if (data) {
                    setUserData(JSON.parse(data));
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadUserData();
    }, []);


    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            router.replace('/login');
        } catch (e) {
            console.error(e);
        }
    };


    const styles = getStyles(colors);

    return (
        <DrawerContentScrollView {...props} style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.drawerContent}>
            <Pressable onPress={() => router.push('/(drawer)/(tabs)/profile')}>
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{userData?.name ? userData.name.charAt(0).toUpperCase() : 'A'}</Text>
                    </View>
                    <Text style={styles.name}>{userData?.name || 'Admin User'}</Text>
                    <Text style={styles.role}>{userData?.role === 'admin' ? 'Trainer / Owner' : 'Member'}</Text>

                </View>
            </Pressable>

            <View style={styles.itemsContainer}>
                <DrawerItemRow
                    key="profile"
                    label="Gym Profile"
                    icon="business-outline"
                    onPress={() => router.push('/(drawer)/(tabs)/profile')}
                    colors={colors}
                />
                <DrawerItemRow
                    key="dashboard"
                    label="Dashboard"
                    icon="home-outline"
                    onPress={() => router.push('/(drawer)/(tabs)')}
                    colors={colors}
                />

                <View key="sep1" style={styles.separator} />

                <DrawerItemRow
                    key="membership"
                    label="Membership Plans"
                    icon="card-outline"
                    onPress={() => router.push('/membership-plans')}
                    colors={colors}
                />
                <DrawerItemRow
                    key="workout"
                    label="Workout Plans"
                    icon="barbell-outline"
                    onPress={() => router.push('/workout-plans')}
                    colors={colors}
                />
                <DrawerItemRow
                    key="diet"
                    label="Diet Plans"
                    icon="restaurant-outline"
                    onPress={() => router.push('/diet-plans')}
                    colors={colors}
                />

                <View key="sep2" style={styles.separator} />

                <View key="darkmode" style={styles.preferenceRow}>
                    <View style={styles.preferenceLabel}>
                        <Ionicons name="moon-outline" size={20} color={colors.secondary} />
                        <Text style={styles.preferenceText}>Dark Mode</Text>
                    </View>
                    <Switch
                        value={isDarkMode}
                        onValueChange={toggleTheme}
                        thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
                        trackColor={{ false: '#767577', true: colors.primary + '80' }}
                    />
                </View>

                <View key="notif" style={styles.preferenceRow}>
                    <View style={styles.preferenceLabel}>
                        <Ionicons name="notifications-outline" size={20} color={colors.secondary} />
                        <Text style={styles.preferenceText}>Notifications</Text>
                    </View>
                    <Switch
                        value={notificationsEnabled}
                        onValueChange={setNotificationsEnabled}
                        thumbColor={notificationsEnabled ? colors.primary : '#f4f3f4'}
                        trackColor={{ false: '#767577', true: colors.primary + '80' }}
                    />
                </View>
            </View>

            <View style={styles.footer}>
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color={colors.error} />
                    <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
            </View>
        </DrawerContentScrollView>
    );
}

export default function DrawerLayout() {
    const { colors } = useTheme();
    return (
        <Drawer
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerStyle: {
                    backgroundColor: colors.surface,
                    width: 280,
                },
                drawerLabelStyle: {
                    color: colors.secondary,
                },
                drawerActiveTintColor: colors.primary,
                drawerInactiveTintColor: colors.secondary,
            }}
        >
            <Drawer.Screen
                name="(tabs)"
                options={{
                    drawerLabel: 'Dashboard',
                    headerTitle: 'BIGBUDDY',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
                    ),
                    headerRight: () => (
                        <Pressable onPress={() => router.push('/notifications')} style={{ marginRight: 15 }}>
                            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                        </Pressable>
                    ),
                }}
            />
        </Drawer>
    );
}

const getStyles = (colors) => StyleSheet.create({
    drawerContent: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 10,
        alignItems: 'center',
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatarText: {
        color: colors.primary,
        fontSize: 28,
        fontWeight: 'bold',
    },
    name: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    role: {
        color: colors.secondary,
        fontSize: 14,
        marginTop: 2,
    },
    itemsContainer: {
        flex: 1,
        paddingTop: 10,
    },
    itemLabel: {
        color: colors.secondary,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 10,
        marginHorizontal: 15,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoutText: {
        color: colors.error,
        marginLeft: 15,
        fontSize: 16,
        fontWeight: 'bold',
    },
    preferenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    preferenceLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    preferenceText: {
        color: colors.secondary,
        fontSize: 14,
    },
});

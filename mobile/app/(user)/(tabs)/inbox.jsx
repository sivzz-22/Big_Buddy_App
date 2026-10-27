import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkTheme } from '../../../constants/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import { useFocusEffect } from 'expo-router';

const TYPE_COLORS = {
    expired: '#F44336',
    absent: '#FF9800',
    birthday: '#E91E63',
    invoice: '#00BCD4',
    invoices: '#00BCD4',
    plans: '#9C27B0',
    general: '#2196F3',
    balance: '#FF5722',
    warning: '#FF9800',
};

const TYPE_ICONS = {
    expired: 'warning-outline',
    absent: 'time-outline',
    birthday: 'gift-outline',
    invoice: 'receipt-outline',
    invoices: 'receipt-outline',
    plans: 'barbell-outline',
    general: 'mail-outline',
    balance: 'cash-outline',
    warning: 'alert-circle-outline',
};

export default function UserInbox() {
    const colors = darkTheme;
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [memberId, setMemberId] = useState(null);

    const styles = getStyles(colors);

    const memberIdRef = useRef(null);

    const fetchInbox = useCallback(async () => {
        try {
            const userJson = await AsyncStorage.getItem('userData');
            const user = JSON.parse(userJson);
            if (!memberIdRef.current) {
                const memberRes = await axios.get(`${API_URL}/members/${user.email || user._id}`);
                memberIdRef.current = memberRes.data._id;
            }
            setMemberId(memberIdRef.current);
            const res = await axios.get(`${API_URL}/messages/inbox/${memberIdRef.current}`);
            setMessages(res.data);
        } catch (e) {
            console.error('Inbox fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Re-fetch every time user navigates to this screen
    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchInbox();
        }, [fetchInbox])
    );

    const onRefresh = () => { setRefreshing(true); fetchInbox(); };

    const markAllRead = async () => {
        if (!memberId) return;
        try {
            await axios.put(`${API_URL}/messages/read-all/${memberId}`);
            setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
        } catch (e) {
            Alert.alert('Error', 'Could not mark messages as read.');
        }
    };

    const markRead = async (messageId) => {
        try {
            await axios.put(`${API_URL}/messages/read/${messageId}`);
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isRead: true } : m));
        } catch (e) {
            // silently fail
        }
    };

    const unreadCount = messages.filter(m => !m.isRead).length;

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = (now - d) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return d.toLocaleDateString();
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header bar */}
            <View style={styles.headerBar}>
                <View>
                    <Text style={styles.headerTitle}>Inbox</Text>
                    <Text style={styles.headerSub}>
                        {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </Text>
                </View>
                {unreadCount > 0 && (
                    <Pressable style={styles.markAllBtn} onPress={markAllRead}>
                        <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </Pressable>
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="mail-open-outline" size={80} color={colors.secondary} />
                        <Text style={styles.emptyTitle}>No Messages Yet</Text>
                        <Text style={styles.emptySub}>Messages from your gym manager will appear here.</Text>
                    </View>
                ) : (
                    messages.map((msg) => {
                        const typeKey = msg.type || 'general';
                        const accentColor = TYPE_COLORS[typeKey] || '#2196F3';
                        const icon = TYPE_ICONS[typeKey] || 'mail-outline';
                        return (
                            <Pressable
                                key={msg._id}
                                style={[
                                    styles.messageCard,
                                    { borderLeftColor: accentColor },
                                    !msg.isRead && styles.unreadCard
                                ]}
                                onPress={() => !msg.isRead && markRead(msg._id)}
                            >
                                <View style={[styles.iconBubble, { backgroundColor: accentColor + '20' }]}>
                                    <Ionicons name={icon} size={22} color={accentColor} />
                                </View>
                                <View style={styles.msgBody}>
                                    <View style={styles.msgTopRow}>
                                        <Text style={styles.senderName}>{msg.senderName || 'BigBuddy Admin'}</Text>
                                        <Text style={styles.msgTime}>{formatDate(msg.date || msg.createdAt)}</Text>
                                    </View>
                                    <Text style={[styles.msgText, !msg.isRead && styles.msgTextUnread]}>
                                        {msg.message}
                                    </Text>
                                    {!msg.isRead && (
                                        <View style={styles.unreadDot} />
                                    )}
                                </View>
                            </Pressable>
                        );
                    })
                )}
                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, paddingBottom: 15,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    headerSub: { fontSize: 12, color: colors.secondary, marginTop: 2 },
    markAllBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: colors.primary + '15', paddingHorizontal: 12,
        paddingVertical: 7, borderRadius: 20,
    },
    markAllText: { color: colors.primary, fontSize: 12, fontWeight: 'bold' },
    scrollContent: { padding: 16 },
    messageCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: colors.surface, borderRadius: 16,
        padding: 15, marginBottom: 12,
        borderWidth: 1, borderColor: colors.border,
        borderLeftWidth: 4, gap: 12, position: 'relative',
    },
    unreadCard: {
        backgroundColor: colors.primary + '08',
        borderColor: colors.primary + '30',
    },
    iconBubble: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    msgBody: { flex: 1 },
    msgTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    senderName: { fontSize: 13, fontWeight: 'bold', color: colors.text },
    msgTime: { fontSize: 11, color: colors.secondary },
    msgText: { fontSize: 14, color: colors.secondary, lineHeight: 20 },
    msgTextUnread: { color: colors.text, fontWeight: '500' },
    unreadDot: {
        position: 'absolute', top: 0, right: 0,
        width: 9, height: 9, borderRadius: 5,
        backgroundColor: colors.primary,
    },
    emptyState: {
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 80, gap: 12,
    },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    emptySub: {
        fontSize: 14, color: colors.secondary,
        textAlign: 'center', paddingHorizontal: 40, lineHeight: 22,
    },
});

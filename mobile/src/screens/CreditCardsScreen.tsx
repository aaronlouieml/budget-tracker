import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, FAB, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { listCreditCards, type CreditCard } from '../api/creditCards';
import { ApiError } from '../api/client';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/cardStatus';
import { formatCurrency, formatShortDate } from '../utils/format';
import type { CreditCardsStackParamList } from '../navigation/CreditCardsNavigator';

type Props = NativeStackScreenProps<CreditCardsStackParamList, 'CreditCardList'>;

export default function CreditCardsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const theme = useTheme();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await listCreditCards(token);
      setCards(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load credit cards.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
        <Button mode="contained" onPress={loadCards} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={cards.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={isLoading}
        onRefresh={loadCards}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No credit cards yet. Tap + to add one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => navigation.navigate('CreditCardDetail', { cardId: item.id })}>
            <Card.Content>
              <View style={styles.headerRow}>
                <View style={styles.titleGroup}>
                  <Text variant="titleMedium">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.bank}>
                    {item.bank}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                  <Text variant="labelSmall" style={styles.statusText}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text variant="bodyMedium">Unpaid: {formatCurrency(item.unpaid)}</Text>
                <Text variant="bodyMedium">Due: {formatShortDate(item.next_due_date)}</Text>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('CreditCardForm', undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
  card: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleGroup: {
    flex: 1,
  },
  bank: {
    opacity: 0.6,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

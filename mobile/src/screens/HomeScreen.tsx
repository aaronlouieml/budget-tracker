import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, List, Text, useTheme } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';

import { dashboardService, type DashboardData } from '../services/dashboardService';
import { ServiceError } from '../services/errors';
import { PAYMENT_METHODS } from '../constants/expenseOptions';
import { colorForCategory } from '../constants/categoryColors';
import { formatCurrency, formatDate } from '../utils/format';
import { useChartTheme } from '../hooks/useChartTheme';

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export default function HomeScreen() {
  const theme = useTheme();
  const { chartConfig, legendFontColor } = useChartTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const data = await dashboardService.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Unable to load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !dashboard) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
          {error ?? 'Unable to load dashboard.'}
        </Text>
        <Button mode="contained" onPress={loadDashboard} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const pieData = dashboard.categoryTotals.map((c) => ({
    name: c.category,
    amount: Number(c.total),
    color: colorForCategory(c.category),
    legendFontColor,
    legendFontSize: 13,
  }));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        Budget Tracker
      </Text>

      <Card style={styles.card}>
        <Card.Title title="Total Expenses" subtitle="This month" />
        <Card.Content>
          <Text variant="displaySmall">{formatCurrency(dashboard.totalExpenses)}</Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Recent Expenses" />
        <Card.Content style={styles.noPadding}>
          {dashboard.recentExpenses.length === 0 ? (
            <Text variant="bodyMedium" style={styles.emptyText}>
              No expenses yet.
            </Text>
          ) : (
            dashboard.recentExpenses.map((item, index) => (
              <View key={item.id}>
                <List.Item
                  title={item.category}
                  description={`${item.merchant ? item.merchant + ' · ' : ''}${formatDate(item.date)}${
                    item.payment_method ? ' · ' + (PAYMENT_METHOD_LABELS[item.payment_method] ?? item.payment_method) : ''
                  }`}
                  right={() => (
                    <Text variant="titleMedium" style={styles.rowAmount}>
                      {formatCurrency(item.amount)}
                    </Text>
                  )}
                />
                {index < dashboard.recentExpenses.length - 1 && <Divider />}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Spending by Category" subtitle="This month" />
        <Card.Content>
          {dashboard.categoryTotals.length === 0 ? (
            <Text variant="bodyMedium" style={styles.emptyText}>
              No expenses yet this month.
            </Text>
          ) : (
            <>
              <PieChart
                data={pieData}
                width={screenWidth - 64}
                height={180}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="0"
                chartConfig={chartConfig}
                hasLegend={false}
              />
              <View style={styles.categoryList}>
                {dashboard.categoryTotals.map((c) => (
                  <View key={c.category} style={styles.categoryRow}>
                    <View style={styles.categoryLabel}>
                      <View style={[styles.swatch, { backgroundColor: colorForCategory(c.category) }]} />
                      <Text variant="bodyMedium">{c.category}</Text>
                    </View>
                    <Text variant="bodyMedium">{formatCurrency(c.total)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    marginBottom: 8,
  },
  card: {
    marginBottom: 4,
  },
  noPadding: {
    paddingHorizontal: 0,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
  },
  rowAmount: {
    alignSelf: 'center',
  },
  categoryList: {
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  categoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
});

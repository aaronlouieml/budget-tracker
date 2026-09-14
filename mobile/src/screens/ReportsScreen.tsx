import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Button, Card, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth/AuthContext';
import { fetchReport, type ReportData, type ReportPeriod } from '../api/reports';
import { ApiError } from '../api/client';
import { colorForCategory } from '../constants/categoryColors';
import { formatCurrency } from '../utils/format';
import { useChartTheme } from '../hooks/useChartTheme';

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export default function ReportsScreen() {
  const { token } = useAuth();
  const theme = useTheme();
  const { chartConfig, legendFontColor } = useChartTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(
    async (p: ReportPeriod) => {
      if (!token) return;
      setError(null);
      setIsLoading(true);
      try {
        const data = await fetchReport(token, p);
        setReport(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load report.');
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      loadReport(period);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadReport, period])
  );

  const pieData =
    report?.categoryTotals.map((c) => ({
      name: c.category,
      amount: Number(c.total),
      color: colorForCategory(c.category),
      legendFontColor,
      legendFontSize: 13,
    })) ?? [];

  const barData = {
    labels: report?.spendingOverTime.map((p) => p.label) ?? [],
    datasets: [{ data: report?.spendingOverTime.map((p) => p.total) ?? [0] }],
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SegmentedButtons
        value={period}
        onValueChange={(value) => setPeriod(value as ReportPeriod)}
        buttons={PERIOD_OPTIONS}
        style={styles.segmented}
      />

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centered}>
          <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
          <Button mode="contained" onPress={() => loadReport(period)} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      )}

      {!isLoading && !error && report && (
        <>
          <Card style={styles.card}>
            <Card.Title title="Total Expenses" subtitle={`This ${report.period}`} />
            <Card.Content>
              <Text variant="displaySmall">{formatCurrency(report.totalExpenses)}</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Title title="Spending by Category" />
            <Card.Content>
              {report.categoryTotals.length === 0 ? (
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No expenses in this period.
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
                    {report.categoryTotals.map((c) => (
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

          <Card style={styles.card}>
            <Card.Title title="Spending Over Time" />
            <Card.Content>
              {report.spendingOverTime.every((p) => p.total === 0) ? (
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No expenses in this period.
                </Text>
              ) : (
                <BarChart
                  data={barData}
                  width={screenWidth - 64}
                  height={220}
                  yAxisLabel="₱"
                  yAxisSuffix=""
                  fromZero
                  chartConfig={chartConfig}
                  style={styles.barChart}
                  verticalLabelRotation={period === 'year' ? 60 : 0}
                  showValuesOnTopOfBars
                />
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  segmented: {
    marginBottom: 4,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    marginBottom: 4,
  },
  emptyText: {
    opacity: 0.6,
    paddingVertical: 8,
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
  barChart: {
    borderRadius: 8,
    marginLeft: -16,
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
  },
});

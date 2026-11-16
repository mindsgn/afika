import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSync } from '@/state/sync';
import { colors, radius, space } from '@/theme/colors';
import { Button, Card, SectionTitle } from '@/ui/components';

function formatTime(value: number | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

/**
 * Sync status and conflict screen.
 *
 * The till stays offline-first: every sale, product and stock change is written
 * locally first and queued in the outbox. This screen drains that queue to the
 * POS API, pulls the server's change feed, and shows anything the server
 * rejected so the merchant can retry it.
 */
export default function SyncScreen() {
  const { status, result, pending, state, conflictRows, sync, retry } = useSync();
  const busy = status === 'syncing';

  return (
    <ScrollView testID="sync-screen" contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Card testID="sync-status" style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {busy ? <ActivityIndicator color={colors.ink} /> : null}
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>
            {busy ? 'Syncing…' : status === 'error' ? 'Sync needs attention' : status === 'done' ? 'Up to date' : 'Ready to sync'}
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Sales and stock are stored on this device first. Sync copies them to your online ledger and pulls changes
          from your other devices. It is safe to keep selling with no connection.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Stat testID="sync-pending-count" label="Queued changes" value={String(pending)} />
        <Stat label="Pull cursor" value={String(state.cursor)} />
      </View>

      <View style={{ marginTop: space.md }}>
        <Button
          testID="sync-now"
          variant="lime"
          disabled={busy}
          label={busy ? 'Syncing…' : 'Sync now'}
          onPress={() => void sync()}
        />
      </View>

      <View style={{ marginTop: space.sm }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Last sync: {formatTime(state.lastSyncAt)} · Device {state.deviceId}
        </Text>
        {result ? (
          <Text testID="sync-result" style={{ color: result.ok ? colors.green : colors.red, fontSize: 12, marginTop: 4 }}>
            {result.skipped
              ? 'Set up your business before syncing.'
              : `${result.pushed} pushed · ${result.pulled} pulled${result.error ? ` · ${result.error}` : ''}`}
          </Text>
        ) : null}
        {state.lastError ? (
          <Text style={{ color: colors.red, fontSize: 12, marginTop: 4 }}>{state.lastError}</Text>
        ) : null}
      </View>

      <SectionTitle>Conflicts</SectionTitle>
      <Card testID="sync-conflicts">
        {conflictRows.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Nothing waiting. Rejected changes stay here until they are retried, so a sale is never silently dropped.
          </Text>
        ) : (
          conflictRows.map((row) => (
            <View
              key={row.id}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 }}
            >
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>
                {row.entity} · {row.operation}
              </Text>
              <Text style={{ color: colors.red, fontSize: 12 }}>{row.lastError}</Text>
              <Pressable
                testID={`sync-retry-${row.id}`}
                onPress={() => void retry(row.id)}
                disabled={busy}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12, textDecorationLine: 'underline' }}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
        padding: space.md,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

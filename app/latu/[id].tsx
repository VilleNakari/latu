import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CareChips } from '../../src/components/Care';
import { Button, SectionTitle, StatusPill } from '../../src/components/ui';
import { WeatherCard } from '../../src/components/Weather';
import { displayName, useStore } from '../../src/data/store';
import { colors, fonts } from '../../src/theme';
import { initials, km, timeAgo } from '../../src/utils';

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { trackById, ensureTrack, reportsFor, latestFor, deleteReport, flagReport, blockAuthor, refresh, refreshing } = useStore();
  const track = trackById(id);
  useEffect(() => {
    if (!track && id) ensureTrack(id);
  }, [track, id, ensureTrack]);
  if (!track) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const confirmDelete = (reportId: string) =>
    Alert.alert('Poista raportti?', 'Raportti ja sen kuvat poistetaan.', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => deleteReport(reportId).catch((e: Error) => Alert.alert('Poisto epäonnistui', e.message)),
      },
    ]);

  const confirmFlag = (reportId: string) =>
    Alert.alert('Ilmoita asiaton raportti?', 'Raportti piilotetaan, jos useampi käyttäjä ilmoittaa siitä, ja ylläpito tarkistaa sen.', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Ilmoita',
        style: 'destructive',
        onPress: () =>
          flagReport(reportId)
            .then(() => Alert.alert('Kiitos!', 'Ilmoitus on vastaanotettu.'))
            .catch((e: Error) => Alert.alert('Ilmoitus epäonnistui', e.message)),
      },
    ]);

  const confirmBlock = (reportId: string) =>
    Alert.alert('Piilota kirjoittajan raportit?', 'Et näe enää tämän kirjoittajan raportteja. Voit palauttaa piilotetut kirjoittajat Ladut-listan alareunasta.', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Piilota',
        style: 'destructive',
        onPress: () => blockAuthor(reportId).catch((e: Error) => Alert.alert('Piilotus epäonnistui', e.message)),
      },
    ]);

  const reportActions = (reportId: string) =>
    Alert.alert('Raportti', undefined, [
      { text: 'Ilmoita asiaton raportti', onPress: () => confirmFlag(reportId) },
      { text: 'Piilota kirjoittajan raportit', onPress: () => confirmBlock(reportId) },
      { text: 'Peruuta', style: 'cancel' },
    ]);

  const reports = reportsFor(track.id);
  const latest = latestFor(track.id);
  const heroPhoto = reports.find((r) => r.photos.length)?.photos[0];
  const heroReport = reports.find((r) => r.photos.length);
  const features = [track.classic && 'Perinteinen', track.skate && 'Vapaa', track.lit && 'Valaistu', track.lengthKm ? km(track.lengthKm) : null].filter(Boolean) as string[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <View style={styles.hero}>
          {heroPhoto ? (
            <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} accessibilityLabel={`Käyttäjän kuva ladulta ${track.name}`} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
              <Feather name="camera" size={28} color={colors.muted} />
              <Text style={styles.heroEmptyText}>Ei vielä kuvia – ota ensimmäinen!</Text>
            </View>
          )}
          <View style={[styles.heroTop, { top: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Takaisin">
              <Feather name="chevron-left" size={22} color={colors.ink} />
            </Pressable>
          </View>
          {heroReport && (
            <Text style={styles.photoCredit}>
              Kuva: {displayName(heroReport)} · {timeAgo(heroReport.createdAt)}
            </Text>
          )}
        </View>

        <View style={styles.body}>
          <View style={{ gap: 8 }}>
            <StatusPill level={latest?.level ?? null} />
            <Text style={styles.h1}>{track.name}</Text>
            <Text style={styles.meta}>
              {[track.city, latest ? `päivitetty ${timeAgo(latest.createdAt)}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <CareChips trackId={track.id} />

          <View style={styles.tags}>
            {features.map((f) => (
              <Text key={f} style={styles.tag}>
                {f}
              </Text>
            ))}
          </View>

          <WeatherCard track={track} />

          <SectionTitle right={<Text style={styles.meta}>{reports.length} kpl</Text>}>Hiihtäjien raportit</SectionTitle>

          {reports.length === 0 && <Text style={styles.meta}>Tältä ladulta ei ole vielä raportteja.</Text>}

          {reports.map((r) => {
            const name = displayName(r);
            const mine = r.mine;
            return (
              <View key={r.id} style={styles.report}>
                <View style={[styles.avatar, !r.authorName && { backgroundColor: colors.lineSoft }]}>
                  {r.authorName ? (
                    <Text style={styles.avatarText}>{initials(name)}</Text>
                  ) : (
                    <Feather name="eye-off" size={16} color={colors.muted} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.reportName} numberOfLines={1}>
                      {name}
                      {mine ? ' (sinä)' : ''} <Text style={styles.reportTime}>· {timeAgo(r.createdAt)}</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <StatusPill level={r.level} small />
                      {mine ? (
                        <Pressable
                          onPress={() => confirmDelete(r.id)}
                          hitSlop={8}
                          style={styles.trash}
                          accessibilityRole="button"
                          accessibilityLabel="Poista oma raporttisi"
                        >
                          <Feather name="trash-2" size={16} color={colors.muted} />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => reportActions(r.id)}
                          hitSlop={8}
                          style={styles.trash}
                          accessibilityRole="button"
                          accessibilityLabel="Ilmoita tai piilota raportti"
                        >
                          <Feather name="more-horizontal" size={18} color={colors.muted} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  {r.comment ? <Text style={styles.reportText}>{r.comment}</Text> : null}
                  {r.tags.length > 0 && <Text style={styles.reportTags}>{r.tags.join(' · ')}</Text>}
                  {r.photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {r.photos.map((p, i) => (
                        <Image key={p} source={{ uri: p }} style={styles.thumb} accessibilityLabel={`Kuva ${i + 1} raportista`} />
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            );
          })}
          <Text style={styles.source}>Latutiedot: LIPAS, Jyväskylän yliopisto</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button
          label="Päivitä latutilanne"
          icon={<Feather name="camera" size={20} color="#FFFFFF" />}
          onPress={() => router.push(`/raportoi/${track.id}`)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, backgroundColor: '#C7D6E4' },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroEmptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  heroTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  photoCredit: { position: 'absolute', left: 16, bottom: 36, backgroundColor: 'rgba(11,23,38,0.75)', color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  body: { marginTop: -24, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 18 },
  h1: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft, backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, overflow: 'hidden' },
  report: { flexDirection: 'row', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: '#0B3D91' },
  reportName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  reportTime: { fontFamily: fonts.regular, color: colors.muted },
  reportText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  reportTags: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  trash: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  source: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4 },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: colors.bg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#E1E7EE' },
});

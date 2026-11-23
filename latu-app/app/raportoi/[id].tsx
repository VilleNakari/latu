import { Feather } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Label } from '../../src/components/ui';
import { useStore } from '../../src/data/store';
import { colors, fonts, levels, reportTags } from '../../src/theme';
import type { Level } from '../../src/types';

const MAX_PHOTOS = 3;
const MAX_NICK = 24;

/** Pienentää kuvan ja tallentaa sen uudelleen JPEG:nä – samalla EXIF-metatiedot (mm. GPS-sijainti) poistuvat. */
async function cleanPhoto(uri: string, width?: number) {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > 1600) ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { tracks, profile, addReport, updateProfile } = useStore();
  const track = tracks.find((t) => t.id === id);

  const [level, setLevel] = useState<Level | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [anonymous, setAnonymous] = useState(profile.defaultAnonymous || !profile.nickname);
  const [nickname, setNickname] = useState(profile.nickname);
  const [done, setDone] = useState(false);

  if (!track) return null;

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const addPhoto = async (source: 'camera' | 'library') => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Lupa puuttuu', source === 'camera' ? 'Salli kameran käyttö asetuksista kuvataksesi latua.' : 'Salli pääsy kuviin asetuksista.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, exif: false };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const asset = res.assets[0];
      const uri = await cleanPhoto(asset.uri, asset.width);
      setPhotos((p) => [...p, uri].slice(0, MAX_PHOTOS));
    } catch {
      Alert.alert('Kuvan käsittely epäonnistui', 'Yritä uudelleen.');
    } finally {
      setBusy(false);
    }
  };

  const choosePhotoSource = () => {
    Alert.alert('Lisää kuva', undefined, [
      { text: 'Ota kuva', onPress: () => addPhoto('camera') },
      { text: 'Valitse kuvista', onPress: () => addPhoto('library') },
      { text: 'Peruuta', style: 'cancel' },
    ]);
  };

  const nick = nickname.trim();
  const canSubmit = level !== null && (anonymous || nick.length >= 2) && !busy;

  const submit = async () => {
    if (!level) return;
    setBusy(true);
    try {
      // Muistetaan valinta seuraavaa raporttia varten.
      await updateProfile({ defaultAnonymous: anonymous, ...(anonymous ? {} : { nickname: nick }) });
      await addReport({
        trackId: track.id,
        level,
        tags,
        comment: comment.trim(),
        photos,
        authorName: anonymous ? null : nick,
      });
      setDone(true);
    } catch (e) {
      Alert.alert('Raportin lähetys epäonnistui', e instanceof Error ? e.message : 'Yritä uudelleen.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.done, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.doneIcon}>
          <Feather name="check" size={40} color="#0B3D91" />
        </View>
        <Text style={styles.doneTitle}>Kiitos, raportti julkaistu!</Text>
        <Text style={styles.doneText}>
          {anonymous ? 'Raporttisi näkyy muille nimellä “Anonyymi hiihtäjä”.' : `Raporttisi näkyy muille nimimerkillä ${nick}.`}
        </Text>
        <Button label="Takaisin latuun" variant="dark" style={{ alignSelf: 'stretch', marginTop: 12 }} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 20 : insets.top + 12 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel="Sulje">
            <Feather name="x" size={20} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Miltä latu näyttää?</Text>
            <Text style={styles.sub}>{track.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Label>Kunto</Label>
          <View style={styles.levelRow}>
            {([1, 2, 3, 4] as const).map((l) => {
              const on = level === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLevel(l)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={levels[l].label}
                  style={[styles.level, on && styles.levelOn]}
                >
                  <View style={[styles.levelDot, { backgroundColor: on && l === 1 ? colors.accentOnDark : levels[l].dot }]} />
                  <Text style={[styles.levelText, on && { color: colors.surface }]}>{levels[l].short}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Label>Tyyli ja lumi</Label>
          <View style={styles.wrap}>
            {reportTags.map((t) => (
              <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggleTag(t)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Label>
            Kuvat ({photos.length}/{MAX_PHOTOS})
          </Label>
          <View style={styles.photoRow}>
            {photos.length < MAX_PHOTOS && (
              <Pressable onPress={choosePhotoSource} style={styles.addPhoto} accessibilityRole="button" accessibilityLabel="Lisää kuva" disabled={busy}>
                {busy ? <ActivityIndicator color={colors.accent} /> : <Feather name="camera" size={24} color={colors.accent} />}
                <Text style={styles.addPhotoText}>Ota kuva</Text>
              </Pressable>
            )}
            {photos.map((p, i) => (
              <View key={p} style={styles.photo}>
                <Image source={{ uri: p }} style={StyleSheet.absoluteFill} accessibilityLabel={`Kuva ${i + 1}`} />
                <Pressable
                  onPress={() => setPhotos((cur) => cur.filter((x) => x !== p))}
                  style={styles.removePhoto}
                  accessibilityRole="button"
                  accessibilityLabel={`Poista kuva ${i + 1}`}
                  hitSlop={10}
                >
                  <Feather name="x" size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>Kuvista poistetaan sijainti- ja laitetiedot ennen julkaisua.</Text>
        </View>

        <View style={styles.section}>
          <Label>Kommentti</Label>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Esim. pito, urien kunto, valaistus, esteet…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={styles.textarea}
            accessibilityLabel="Kommentti"
          />
        </View>

        <View style={styles.section}>
          <Label>Julkaise</Label>
          <View style={styles.segment} accessibilityRole="radiogroup">
            <Segment label="Anonyymisti" icon="eye-off" on={anonymous} onPress={() => setAnonymous(true)} />
            <Segment label="Nimimerkillä" icon="user" on={!anonymous} onPress={() => setAnonymous(false)} />
          </View>
          {!anonymous && (
            <TextInput
              value={nickname}
              onChangeText={(t) => setNickname(t.slice(0, MAX_NICK))}
              placeholder="Nimimerkki (vähintään 2 merkkiä)"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Nimimerkki"
            />
          )}
          <Text style={styles.hint}>
            Näkyy muille: <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{anonymous ? 'Anonyymi hiihtäjä' : nick || '–'}</Text>
            {'\n'}Emme pyydä nimeä, sähköpostia tai puhelinnumeroa.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button label={level ? 'Julkaise raportti' : 'Valitse ensin kunto'} onPress={submit} disabled={!canSubmit} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Segment({ label, icon, on, onPress }: { label: string; icon: 'eye-off' | 'user'; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.segItem, on && styles.segOn]}>
      <Feather name={icon} size={16} color={on ? colors.surface : colors.ink} />
      <Text style={[styles.segText, on && { color: colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  section: { gap: 10 },
  levelRow: { flexDirection: 'row', gap: 8 },
  level: { flex: 1, height: 64, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6 },
  levelOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoRow: { flexDirection: 'row', gap: 8 },
  addPhoto: { width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accent },
  photo: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.lineSoft },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(11,23,38,0.7)', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  textarea: { minHeight: 96, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top' },
  input: { height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.bg },
  done: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#DCE8FF', alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, textAlign: 'center' },
  doneText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
});

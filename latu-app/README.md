# Latu – latutilanne koko Suomesta (prototyyppi)

Expo / React Native -prototyyppi, jossa hiihtäjät raportoivat latujen kunnon ja lisäävät kuvia **anonyymisti tai nimimerkillä**.

## Käynnistys

Tarvitset Node.js:n (LTS) ja puhelimeen **Expo Go** -sovelluksen.

```bash
npm install
npx expo install --fix     # lukitsee kirjastot Expo SDK:n kanssa yhteensopiviin versioihin
npx expo start             # skannaa QR-koodi Expo Go:lla
```

> Jos puhelimesi Expo Go tukee eri SDK-versiota kuin `package.json` (`expo ~58`), vaihda `expo`-versio siihen ja aja `npx expo install --fix` uudelleen.

## Mitä prototyypissä on

| Näkymä | Tiedosto | Sisältö |
|---|---|---|
| Ladut ⇄ Kartta | `app/(tabs)/_layout.tsx` | Pyyhkäistävät välilehdet alareunassa |
| Ladut | `app/(tabs)/index.tsx` | Haku, suodattimet, lähin latu (sijainnin perusteella), muut ladut kuntomerkinnöin |
| Kartta | `app/(tabs)/kartta.tsx` | Ladut kunnon mukaan värjättyinä nastoina, alapaneeli valitulle ladulle |
| Latu | `app/latu/[id].tsx` | Käyttäjäkuva, tiedot, raporttivirta kuvineen, omien raporttien poisto |
| Raportoi | `app/raportoi/[id].tsx` | Kunto, tyyli/lumi, kamera tai galleria (max 3), kommentti, **anonyymi / nimimerkki** (valinta muistetaan) |

## Eleet

- **Ladut → Kartta**: pyyhkäise vasemmalle listan päällä.
- **Kartta → Ladut**: pyyhkäise oikealle alapaneelin päällä tai napauta välilehteä. Kartan päällä sivuttaisveto liikuttaa karttaa.
- **Takaisin ladun sivulta tai lomakkeelta**: iOS:llä pyyhkäise oikealle mistä tahansa kohdasta, Androidilla käytä järjestelmän takaisin-elettä.

## Yksityisyys

- Ei rekisteröitymistä, sähköpostia tai puhelinnumeroa.
- Anonyymi raportti näkyy nimellä ”Anonyymi hiihtäjä”. Nimimerkin voi valita raporttikohtaisesti.
- Laitteelle luodaan satunnainen tunniste (`deviceId`) omien raporttien hallintaan. Sitä ei näytetä muille.
- Kuvat pienennetään ja tallennetaan uudelleen JPEG:nä (`expo-image-manipulator`), jolloin EXIF-tiedot, kuten GPS-sijainti, poistuvat.
- Käyttäjän sijaintia käytetään vain lähimpien latujen järjestämiseen, eikä sitä tallenneta.

## Rakenne

```
app/                expo-router -näkymät
src/data/store.tsx  tietovarasto (Supabase tai testitila)
src/data/supabase.ts Supabase-yhteys ja anonyymi kirjautuminen
src/config.ts       Supabase-osoite ja avain, tietosuojaselosteen linkki
src/data/seed.ts    esimerkkiladut ja -raportit
src/theme.ts        värit, fontit, kuntoluokat
src/components/     yhteiset UI-komponentit
supabase/schema.sql luonnos tietokannasta jaettua taustapalvelua varten
```

## Supabase (jaettu tietokanta)

Sovellus käyttää Supabasea, kun `src/config.ts`:ssä on `SUPABASE_URL` ja `SUPABASE_KEY` (publishable key). Ilman niitä sovellus toimii testitilassa esimerkkidatalla.

Tietokanta luodaan ajamalla `supabase/schema.sql` Supabasen SQL Editorissa. Lisäksi kohdassa *Authentication → Sign In / Providers* pitää sallia **anonymous sign-ins**.

- Käyttäjät kirjautuvat automaattisesti anonyymisti, eikä tiliä tarvita.
- Raportin tekijän tunniste on erillisessä taulussa (`report_owners`), jota sovellus ei pysty lukemaan.
- Yksi laite voi lähettää enintään 10 raporttia tunnissa.
- Raportti piilotetaan automaattisesti, kun siitä tulee kolme ilmoitusta (lippukuvake).
- Kuvat tallennetaan julkiseen `report-photos`-säiliöön (JPEG, enintään 3 Mt).

## Julkaisu

Katso vaiheittainen ohje keskustelusta. Lyhyesti: koodi GitHubiin (julkinen repositorio) → launch.expo.dev → *Launch to App Store* → testaus TestFlightissa → App Store Connectissa kauppasivu ja *Submit for Review*.

Ennen julkaisua täydennä:
- `app.json`: `ios.bundleIdentifier` ja `android.package` (`fi.villenakari.latu`)
- `src/config.ts`: `SUPABASE_URL` ja `PRIVACY_URL`
- `PRIVACY.md`: nimesi ja sähköpostiosoitteesi

Kirjastoversiot on lukittu Expo SDK 58:n mukaisiksi.

# Próba: havi műsor-PDF táblázatából előadáslista (PyMuPDF kell hozzá)
# Futtatás: python -I pdf_feldolgoz.py <pdf> [web json az összevetéshez]
import json, re, sys
from itertools import combinations
from pathlib import Path
import pymupdf

HONAPOK = {'JANUÁR': 1, 'FEBRUÁR': 2, 'MÁRCIUS': 3, 'ÁPRILIS': 4, 'MÁJUS': 5, 'JÚNIUS': 6, 'JÚLIUS': 7,
           'AUGUSZTUS': 8, 'SZEPTEMBER': 9, 'OKTÓBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12}
SZINPADOK = {'NAGYSZÍNHÁZ': 'Nagyszínház', 'KISFALUDY': 'Kisfaludy terem', 'PADLÁSSZÍNHÁZ': 'Padlásszínház'}
IDO = re.compile(r'^(\d{1,2})(?::|\.{1,2})(\d{2})$')
CIMMERET = 6.2  # A címek 6,36 pontosak, az alcímek 5,76 pontosak (novemberi PDF)


def szavak_merettel(page):
    # Minden szóhoz hozzáteszi a betűméretét: (x0, y0, x1, y1, szöveg, méret)
    spanok = [(pymupdf.Rect(s['bbox']), s['size']) for b in page.get_text('dict')['blocks']
              for l in b.get('lines', []) for s in l['spans']]
    eredmeny = []
    for w in page.get_text('words'):
        kozep = pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
        meret = next((m for r, m in spanok if r.contains(kozep)), 0)
        eredmeny.append((*w[:5], meret))
    return eredmeny


def sorok(szavak, tures=3):
    # Szavak sorokba rendezése függőleges helyzet szerint
    eredmeny = []
    for w in sorted(szavak, key=lambda w: (round(w[1]), w[0])):
        if eredmeny and abs(eredmeny[-1]['y'] - w[1]) <= tures:
            eredmeny[-1]['w'].append(w)
        else:
            eredmeny.append({'y': w[1], 'y1': w[3], 'w': [w]})
    for s in eredmeny:
        s['w'].sort(key=lambda w: w[0])
        s['szoveg'] = ' '.join(w[4] for w in s['w'])
        s['y1'] = max(w[3] for w in s['w'])
    return eredmeny


def cella(szavak, rect):
    benne = [w for w in szavak if rect.x0 - 1 <= (w[0] + w[2]) / 2 <= rect.x1 + 1 and rect.y0 - 1 <= (w[1] + w[3]) / 2 <= rect.y1 + 1]
    idok = [w for w in benne if IDO.match(w[4]) and int(IDO.match(w[4])[1]) < 24]
    if not idok:
        return [], (sorok(benne)[0]['szoveg'] if benne else None)
    hatar = min(w[0] for w in idok)
    bal = sorok([w for w in benne if w[2] <= hatar + 1])
    # Címblokkok: nagyobb függőleges hézag, vagy alcím utáni nagyobb betűs (cím) sor új előadást jelent
    blokkok = []
    for s in bal:
        s['cimsor'] = max(w[5] for w in s['w']) >= CIMMERET
        if blokkok and s['y'] - blokkok[-1][-1]['y1'] < 4 and not (s['cimsor'] and not blokkok[-1][-1]['cimsor']):
            blokkok[-1].append(s)
        else:
            blokkok.append([s])
    idok.sort(key=lambda w: w[1])
    if len(blokkok) < len(idok):
        # Egymás alatti címek hézag nélkül (pl. kétszer "Líra és Epika"): minden címsor külön előadás, ha így kijön a darabszám
        bontott = []
        for b in blokkok:
            for s in b:
                if s['cimsor'] or not bontott:
                    bontott.append([s])
                else:
                    bontott[-1].append(s)
        if len(bontott) == len(idok):
            blokkok = bontott
        else:
            # Többsoros címek (pl. "Tom Sawyer / kalandjai" + "Még egy kört / mindenkinek"): új cím csak nagy betűvel
            # kezdődő címsornál kezdődhet; a vágásokat úgy választjuk, hogy a címek az időpontjuk magasságában legyenek.
            # Ha nincs elég ilyen sor, egy cím tartozik több időponthoz (pl. Fonák 15:30 és 19:00).
            osszes = [s for b in blokkok for s in b]
            jeloltek = [i for i, s in enumerate(osszes) if i and s['cimsor'] and s['szoveg'][:1].isupper()]
            legjobb = None
            for vagasok in combinations(jeloltek, len(idok) - 1):
                hatarok = [0, *vagasok, len(osszes)]
                csop = [osszes[a:b] for a, b in zip(hatarok, hatarok[1:])]
                koltseg = sum(abs((g[0]['y'] + g[-1]['y1']) / 2 - (t[1] + t[3]) / 2) for g, t in zip(csop, idok))
                if legjobb is None or koltseg < legjobb[0]:
                    legjobb = (koltseg, csop)
            if legjobb:
                blokkok = legjobb[1]
    parok, gyanus = [], False
    if len(blokkok) in (1, len(idok)):
        parok = [(ido, blokkok[0] if len(blokkok) == 1 else blokkok[i]) for i, ido in enumerate(idok)]
    else:
        # Különben a függőlegesen legközelebbi cím; gyanús, ha valamelyik cím időpont nélkül marad
        def tav(b, ido):
            return abs((b[0]['y'] + b[-1]['y1']) / 2 - (ido[1] + ido[3]) / 2)
        parok = [(ido, min(blokkok, key=lambda b: tav(b, ido)) if blokkok else []) for ido in idok]
        gyanus = len({id(b) for _, b in parok}) < len(blokkok)
    eloadasok = []
    for ido, blokk in parok:
        m = IDO.match(ido[4])
        jobb = sorok([w for w in benne if w[0] > ido[2] and abs((w[1] + w[3]) / 2 - (ido[1] + ido[3]) / 2) < 7])
        megj = ' '.join(s['szoveg'] for s in jobb) or None
        # Cím: a blokk eleji nagyobb betűs sorok, alcím: a többi
        idx = next((j for j, s in enumerate(blokk) if not s['cimsor'] or s['szoveg'].startswith('-')), len(blokk))
        cim = ' '.join(s['szoveg'] for s in blokk[:idx])
        al = ' '.join(s['szoveg'].lstrip('- ') for s in blokk[idx:])
        eloadasok.append({'kezdes': f'{int(m[1]):02d}:{m[2]}', 'cim': cim.lstrip('*') or None, 'alcim': al or None,
                          'megjegyzes': megj, 'modositott': cim.startswith('*'), 'ellenorizendo': gyanus or not cim})
    return eloadasok, None


def feldolgoz(pdf):
    doc = pymupdf.open(pdf)
    page = doc[0]
    szavak = szavak_merettel(page)
    fejszoveg = page.get_text()
    # A lap tetején álló hónapnév a fő hónap; a táblázatban később jöhet egy következő hónap (pl. JANUÁR)
    honap = min((w for w in szavak if w[4] in HONAPOK), key=lambda w: w[1])[4]
    kiadva = re.search(r'kiadva:\s*([^\n]+)', fejszoveg)
    modositva = re.findall(r'módosítva:\s*([^\n]+)', fejszoveg)
    ev = int(re.search(r'(\d{4})\.', kiadva[1])[1])  # a kiadás éve; ha a hónap korábbi, a következő év
    tabla = page.find_tables().tables[0]
    oszlopok = None
    aktualis, nap = HONAPOK[honap], None
    tetelek, kulon = [], []
    for sor in tabla.rows:
        cellak = [pymupdf.Rect(c) if c else None for c in sor.cells]
        sor_szavak = [w[4] for w in szavak if pymupdf.Rect(sor.bbox).contains(pymupdf.Rect(w[:4]))]
        if oszlopok is None:
            if 'NAGYSZÍNHÁZ' in sor_szavak:
                # A fejléc után a színpadoszlopok x-tartománya
                xk = {SZINPADOK[w[4]]: w[0] for w in szavak if w[4] in SZINPADOK}
                oszlopok = sorted(xk.items(), key=lambda kv: kv[1])
            continue
        uj_honap = [HONAPOK[s] for s in sor_szavak if s in HONAPOK]
        if uj_honap:
            aktualis, nap = uj_honap[0], None
            continue
        nap_szavak = [w[4] for w in szavak if cellak[0] and cellak[0].contains(pymupdf.Rect(w[:4]).irect.tl) and w[4][:1].isdigit()]
        if nap_szavak:
            nap = int(re.match(r'\d+', nap_szavak[0])[0])
        # Több színpadoszlopon átívelő cella (fesztiválnév, ünnepi üdvözlet) nem előadás.
        # Hiányzó cella lehet egy fölötte lévő, lefelé összevont cella miatt, az nem baj.
        szinpad_cellak = [c for c in cellak[1:] if c is not None]
        ativelo = any(sum(c.x0 - 2 <= x < c.x1 for _, x in oszlopok) > 1 for c in szinpad_cellak)
        if nap is None or ativelo:
            if sor_szavak:
                kulon.append(' '.join(s for s in sor_szavak if s not in nap_szavak))
            continue
        datum = f'{ev + (aktualis < HONAPOK[honap] - 6)}-{aktualis:02d}-{nap:02d}'
        for c in szinpad_cellak:
            kozep = (c.x0 + c.x1) / 2
            szinpad = max((n for n, x in oszlopok if x <= kozep), key=lambda n: dict(oszlopok)[n], default=oszlopok[0][0])
            eloadasok, csak_szoveg = cella(szavak, c)
            for e in eloadasok:
                tetelek.append({'datum': datum, 'szinpad': szinpad, **e})
            if csak_szoveg and csak_szoveg.strip('*'):
                tetelek.append({'datum': datum, 'szinpad': szinpad, 'kezdes': None, 'cim': csak_szoveg, 'ellenorizendo': True})
    for lap in list(doc)[1:]:
        tetelek += tajelőadasok(lap, f'{ev}-{HONAPOK[honap]:02d}')
    return {'honap': f'{ev}-{HONAPOK[honap]:02d}', 'kiadva': kiadva[1].strip(), 'modositva': modositva,
            'oldalak': len(doc), 'kulon_sorok': kulon, 'tetelek': tetelek}


def tajelőadasok(lap, honap):
    # "SZÉKHELYEN KÍVÜLI ELŐADÁSOK" lap: nap | cím + alcím | időpont | helyszín
    szavak = szavak_merettel(lap)
    if 'SZÉKHELYEN' not in [w[4] for w in szavak]:
        return []
    eredmeny = []
    for tabla in lap.find_tables().tables:
        for sor in tabla.rows:
            r = pymupdf.Rect(sor.bbox)
            benne = [w for w in szavak if r.contains(pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2))]
            idok = [w for w in benne if IDO.match(w[4])]
            nap = [w for w in benne if re.fullmatch(r'\d{1,2}\.', w[4]) and w[0] < r.x0 + 30]
            if len(idok) != 1 or not nap:
                continue
            ido = idok[0]
            bal = sorok([w for w in benne if nap[0][2] + 30 < w[0] < ido[0] - 5])
            m = IDO.match(ido[4])
            eredmeny.append({'datum': f"{honap}-{int(nap[0][4][:-1]):02d}", 'szinpad': 'Székhelyen kívül',
                             'kezdes': f'{int(m[1]):02d}:{m[2]}',
                             'cim': ' '.join(s['szoveg'] for s in bal if not s['szoveg'].startswith('-')) or None,
                             'alcim': ' '.join(s['szoveg'].lstrip('- ') for s in bal if s['szoveg'].startswith('-')) or None,
                             'megjegyzes': ' '.join(w[4] for w in benne if w[0] > ido[2]) or None,
                             'modositott': False, 'ellenorizendo': False})
    return eredmeny


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    e = feldolgoz(sys.argv[1])
    print('hónap', e['honap'], 'kiadva', e['kiadva'], 'módosítva', e['modositva'], 'oldalak', e['oldalak'])
    print('külön sorok', e['kulon_sorok'])
    for t in e['tetelek']:
        jel = ('!' if t['ellenorizendo'] else ' ') + ('*' if t.get('modositott') else ' ')
        print(f"{t['datum']} {t['szinpad'][:9]:9} {t['kezdes'] or '--:--'} {jel} {t['cim']} | {t.get('alcim') or ''} | {t.get('megjegyzes') or ''}")
    Path(sys.argv[1]).with_suffix('.json').write_text(json.dumps(e, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
